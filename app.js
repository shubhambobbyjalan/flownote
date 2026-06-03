// ═══════════════════════════════════════════════════════════════════
// FlowNote — app.js  v3.0  (Supabase auth + real-time data sync)
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── Config ───────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://twwlwvlsrheyfiexmfvo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── State ─────────────────────────────────────────────────────────────
let currentUser   = null;
let currentNote   = null;   // { id, title, content, tag }
let notes         = [];
let todos         = [];
let calEvents     = [];
let profile       = null;
let activeSection = 'notes';
let activeTag     = null;
let todayOffset   = 0;      // for calendar week nav
let lightMode     = false;

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  setupNavListeners();
  setupAuthFormListeners();
  setupNoteEditorListeners();
  setupTodoListeners();
  setupCalListeners();
  setupSettingsListeners();
  setupQuickCapture();

  // Handle OAuth redirect (Google sign-in callback)
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await onSignedIn(session.user);
  } else {
    showAuthModal();
  }

  // Listen for auth state changes (e.g. after Google OAuth redirect)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await onSignedIn(session.user);
    }
    if (event === 'SIGNED_OUT') {
      onSignedOut();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════
async function onSignedIn(user) {
  currentUser = user;
  hideAuthModal();
  await loadProfile();
  await loadNotes();
  await loadTodos();
  await loadCalEvents();
  renderAll();
  incrementStreakToday();
}

function onSignedOut() {
  currentUser = null;
  profile     = null;
  notes       = [];
  todos       = [];
  calEvents   = [];
  showAuthModal();
}

// ── Auth modal visibility ─────────────────────────────────────────
function showAuthModal() {
  const modal = qs('#auth-modal');
  if (modal) modal.style.display = 'flex';
  const app = qs('#app');
  if (app) app.style.display = 'none';
}

function hideAuthModal() {
  const modal = qs('#auth-modal');
  if (modal) modal.style.display = 'none';
  const app = qs('#app');
  if (app) app.style.display = '';
}

// ── Auth form listeners ───────────────────────────────────────────
function setupAuthFormListeners() {
  // Tab switching: sign-in ↔ create account
  onAll('.auth-tab', 'click', e => {
    const tab = e.currentTarget.dataset.tab;
    qsAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    qsAll('.auth-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  });

  // Sign in with email/password
  on('#btn-signin', 'click', async () => {
    const email    = val('#signin-email');
    const password = val('#signin-password');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) showToast('❌ ' + error.message, 'error');
  });

  // Create account
  on('#btn-signup', 'click', async () => {
    const name     = val('#signup-name');
    const nickname = val('#signup-nickname');
    const email    = val('#signup-email');
    const password = val('#signup-password');
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, nickname } }
    });
    if (error) showToast('❌ ' + error.message, 'error');
    else showToast('✅ Check your email to confirm your account!');
  });

  // Google OAuth
  onAll('.btn-google', 'click', async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) showToast('❌ ' + error.message, 'error');
  });

  // Sign out
  on('#btn-signout', 'click', async () => {
    await sb.auth.signOut();
  });
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE & STREAK
// ═══════════════════════════════════════════════════════════════════
async function loadProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) {
    profile   = data;
    lightMode = data.settings?.lightmode ?? false;
    applyTheme();
  }
}

async function incrementStreakToday() {
  if (!currentUser) return;
  await sb.rpc('increment_streak', { uid: currentUser.id });
  // Reload profile to get updated streak
  await loadProfile();
  renderStreak();
}

function renderStreak() {
  const count = profile?.streak_count ?? 0;
  qsAll('.streak-count').forEach(el => el.textContent = count);
  qsAll('.streak-label').forEach(el => el.textContent = count + ' days in a row');
  // Flame emoji in header
  const flame = qs('#streak-flame');
  if (flame) flame.textContent = '🔥 ' + count + ' day streak';
}

// ═══════════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════════
async function loadNotes() {
  if (!currentUser) return;
  const { data } = await sb.from('notes')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('modified_at', { ascending: false });
  notes = data ?? [];
}

async function saveNote() {
  if (!currentUser || !currentNote) return;
  const payload = {
    user_id    : currentUser.id,
    title      : currentNote.title   || '',
    content    : currentNote.content || '',
    tag        : currentNote.tag     || null,
    modified_at: new Date().toISOString()
  };
  if (currentNote.id) {
    await sb.from('notes').update(payload).eq('id', currentNote.id);
  } else {
    const { data } = await sb.from('notes').insert(payload).select().single();
    if (data) currentNote.id = data.id;
  }
  await loadNotes();
  renderNotesList();
  showToast('✓ Note saved');
}

async function deleteNote(id) {
  await sb.from('notes').delete().eq('id', id);
  if (currentNote?.id === id) currentNote = null;
  await loadNotes();
  renderNotesList();
  renderNoteEditor();
}

function renderNotesList() {
  const container = qs('#notes-list');
  if (!container) return;
  const filtered = activeTag ? notes.filter(n => n.tag === activeTag) : notes;
  const count    = qs('#notes-count');
  if (count) count.textContent = notes.length;

  container.innerHTML = filtered.length === 0
    ? '<p class="empty-state">No notes yet. Hit ＋ to start.</p>'
    : filtered.map(n => `
        <div class="note-item ${currentNote?.id === n.id ? 'active' : ''}" data-id="${n.id}">
          <div class="note-item-title">${escHtml(n.title || 'Untitled')}</div>
          <div class="note-item-preview">${escHtml((n.content || '').slice(0, 60))}</div>
          ${n.tag ? `<span class="tag tag-${n.tag}">● ${n.tag}</span>` : ''}
        </div>`).join('');

  container.querySelectorAll('.note-item').forEach(el => {
    el.addEventListener('click', () => {
      const note = notes.find(n => n.id == el.dataset.id);
      if (note) { currentNote = { ...note }; renderNoteEditor(); renderNotesList(); }
    });
  });
}

function renderNoteEditor() {
  const titleEl   = qs('#note-title');
  const contentEl = qs('#note-content');
  const tagEls    = qsAll('.tag-btn');
  const deleteBtn = qs('#btn-delete-note');

  if (!currentNote) {
    if (titleEl)   titleEl.value = '';
    if (contentEl) contentEl.value = '';
    tagEls.forEach(b => b.classList.remove('active'));
    if (deleteBtn) deleteBtn.style.display = 'none';
    return;
  }
  if (titleEl)   titleEl.value = currentNote.title   || '';
  if (contentEl) contentEl.value = currentNote.content || '';
  tagEls.forEach(b => b.classList.toggle('active', b.dataset.tag === currentNote.tag));
  if (deleteBtn) deleteBtn.style.display = '';
}

function setupNoteEditorListeners() {
  on('#btn-new-note', 'click', () => {
    currentNote = { title: '', content: '', tag: null };
    renderNoteEditor();
    renderNotesList();
  });

  on('#btn-save-note', 'click', saveNote);

  on('#btn-delete-note', 'click', () => {
    if (currentNote?.id) deleteNote(currentNote.id);
  });

  on('#note-title', 'input', e => { if (currentNote) currentNote.title = e.target.value; });
  on('#note-content', 'input', e => { if (currentNote) currentNote.content = e.target.value; });

  onAll('.tag-btn', 'click', e => {
    const tag = e.currentTarget.dataset.tag;
    if (currentNote) {
      currentNote.tag = currentNote.tag === tag ? null : tag;
      qsAll('.tag-btn').forEach(b => b.classList.toggle('active', b.dataset.tag === currentNote.tag));
    }
  });

  onAll('.filter-tag', 'click', e => {
    const tag = e.currentTarget.dataset.tag;
    activeTag = activeTag === tag ? null : tag;
    qsAll('.filter-tag').forEach(b => b.classList.toggle('active', b.dataset.tag === activeTag));
    renderNotesList();
  });

  // Formatting toolbar
  on('#fmt-bold',   'click', () => wrapSelection('**', '**'));
  on('#fmt-italic', 'click', () => wrapSelection('_', '_'));
  on('#fmt-ul',     'click', () => prefixLine('• '));
  on('#fmt-check',  'click', () => prefixLine('☑ '));
  on('#fmt-code',   'click', () => wrapSelection('`', '`'));
}

// ═══════════════════════════════════════════════════════════════════
// TODOS
// ═══════════════════════════════════════════════════════════════════
async function loadTodos() {
  if (!currentUser) return;
  const { data } = await sb.from('todos')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  todos = data ?? [];
}

async function addTodo(text, priority) {
  if (!currentUser || !text.trim()) return;
  await sb.from('todos').insert({
    user_id : currentUser.id,
    text    : text.trim(),
    priority: priority || '2'
  });
  await loadTodos();
  renderTodos();
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  await sb.from('todos').update({
    done   : !todo.done,
    done_at: !todo.done ? new Date().toISOString() : null
  }).eq('id', id);
  if (!todo.done) {
    playDoneSound();
    await incrementStreakToday();
  }
  await loadTodos();
  renderTodos();
}

async function deleteTodo(id) {
  await sb.from('todos').delete().eq('id', id);
  await loadTodos();
  renderTodos();
}

function renderTodos() {
  const container = qs('#todos-list');
  if (!container) return;

  const frog  = todos.filter(t => t.priority === 'frog' && !t.done);
  const open  = todos.filter(t => t.priority !== 'frog' && !t.done);
  const done  = todos.filter(t => t.done);
  const total = todos.filter(t => !t.done).length;
  const pct   = todos.length ? Math.round((done.length / todos.length) * 100) : 0;

  const qs2   = qs('#todos-count');
  if (qs2) qs2.textContent = total;
  const prog  = qs('#todo-progress');
  if (prog) prog.textContent = `Today's focus ${pct}%`;
  const bar   = qs('#todo-progress-bar');
  if (bar) bar.style.width = pct + '%';

  // Frog task
  const frogEl = qs('#frog-task');
  if (frogEl) frogEl.textContent = frog.length ? frog[0].text : '';
  const frogCount = qs('#frog-count');
  if (frogCount) frogCount.textContent = frog.length;

  container.innerHTML = [...frog, ...open, ...done].map(t => `
    <div class="todo-item ${t.done ? 'done' : ''} priority-${t.priority}" data-id="${t.id}">
      <span class="todo-check" data-id="${t.id}">${t.done ? '✓' : '○'}</span>
      <span class="todo-text">${escHtml(t.text)}</span>
      ${t.priority === 'frog' ? '<span class="frog-badge">🐸</span>' : ''}
      <span class="todo-delete" data-id="${t.id}">🗑</span>
    </div>`).join('');

  container.querySelectorAll('.todo-check').forEach(el =>
    el.addEventListener('click', () => toggleTodo(Number(el.dataset.id))));
  container.querySelectorAll('.todo-delete').forEach(el =>
    el.addEventListener('click', () => deleteTodo(Number(el.dataset.id))));
}

function setupTodoListeners() {
  on('#btn-add-todo', 'click', () => {
    const input    = qs('#todo-input');
    const priority = qs('#todo-priority')?.value || '2';
    if (input?.value.trim()) {
      addTodo(input.value, priority);
      input.value = '';
    }
  });

  on('#todo-input', 'keydown', e => {
    if (e.key === 'Enter') qs('#btn-add-todo')?.click();
  });
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR EVENTS
// ═══════════════════════════════════════════════════════════════════
async function loadCalEvents() {
  if (!currentUser) return;
  const { data } = await sb.from('cal_events')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('event_date', { ascending: true });
  calEvents = data ?? [];
}

async function saveCalEvent(ev) {
  if (!currentUser) return;
  const payload = { ...ev, user_id: currentUser.id };
  if (ev.id) {
    await sb.from('cal_events').update(payload).eq('id', ev.id);
  } else {
    await sb.from('cal_events').insert(payload);
  }
  await loadCalEvents();
  renderCalendar();
  showToast('✓ Event saved to Google Calendar');
}

async function deleteCalEvent(id) {
  await sb.from('cal_events').delete().eq('id', id);
  await loadCalEvents();
  renderCalendar();
}

function renderCalendar() {
  const container = qs('#cal-events-list');
  if (!container) return;

  const today = new Date();
  today.setDate(today.getDate() + todayOffset);
  const dateStr = today.toISOString().split('T')[0];

  const todayEvents = calEvents.filter(e => e.event_date === dateStr);
  const upcoming    = calEvents.filter(e => e.event_date > dateStr).slice(0, 5);

  const dateLabel = qs('#cal-date-label');
  if (dateLabel) dateLabel.textContent = today.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

  container.innerHTML = todayEvents.length === 0
    ? '<p class="empty-state">No events today. Hit ＋ to add one.</p>'
    : todayEvents.map(e => `
        <div class="cal-event color-${e.color}" data-id="${e.id}">
          <div class="cal-event-title">${escHtml(e.title)}</div>
          ${e.start_hour ? `<div class="cal-event-time">${formatHour(e.start_hour)} – ${formatHour(e.end_hour)}</div>` : ''}
          <span class="cal-event-delete" data-id="${e.id}">✕</span>
        </div>`).join('');

  container.querySelectorAll('.cal-event-delete').forEach(el =>
    el.addEventListener('click', () => deleteCalEvent(Number(el.dataset.id))));

  // Upcoming
  const upEl = qs('#cal-upcoming');
  if (upEl) {
    upEl.innerHTML = upcoming.map(e => `
      <div class="upcoming-event">
        <span>${escHtml(e.title)}</span>
        <span>${e.event_date}</span>
      </div>`).join('') || '<p class="empty-state">No upcoming events.</p>';
  }
}

function setupCalListeners() {
  on('#btn-cal-prev', 'click', () => { todayOffset--; renderCalendar(); });
  on('#btn-cal-next', 'click', () => { todayOffset++; renderCalendar(); });
  on('#btn-cal-today', 'click', () => { todayOffset = 0; renderCalendar(); });

  on('#btn-new-event', 'click', () => {
    const modal = qs('#event-modal');
    if (modal) modal.style.display = 'flex';
  });

  on('#btn-cancel-event', 'click', () => {
    const modal = qs('#event-modal');
    if (modal) modal.style.display = 'none';
  });

  on('#btn-save-event', 'click', async () => {
    const title      = val('#event-title');
    const date       = val('#event-date');
    const startRaw   = val('#event-start');
    const endRaw     = val('#event-end');
    const colorEl    = qs('#event-color');
    const notesVal   = val('#event-notes');
    if (!title || !date) return showToast('Title and date required', 'error');

    const toHour = t => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h + m / 60;
    };

    await saveCalEvent({
      title     : title,
      event_date: date,
      start_hour: toHour(startRaw),
      end_hour  : toHour(endRaw),
      color     : colorEl?.value || 'blue',
      notes     : notesVal
    });
    const modal = qs('#event-modal');
    if (modal) modal.style.display = 'none';
    // Clear form
    ['#event-title','#event-date','#event-start','#event-end','#event-notes']
      .forEach(sel => { const el = qs(sel); if (el) el.value = ''; });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════
async function saveSettings(key, value) {
  if (!currentUser || !profile) return;
  const settings = { ...profile.settings, [key]: value };
  await sb.from('profiles').update({ settings }).eq('id', currentUser.id);
  profile.settings = settings;
}

function setupSettingsListeners() {
  on('#toggle-theme', 'click', async () => {
    lightMode = !lightMode;
    applyTheme();
    await saveSettings('lightmode', lightMode);
  });

  on('#btn-export', 'click', () => {
    const data = JSON.stringify({ notes, todos, calEvents }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'flownote-export.json';
    a.click();
  });

  on('#btn-reset-streak', 'click', async () => {
    if (!confirm('Reset your streak? This cannot be undone.')) return;
    await sb.from('profiles').update({ streak_count: 0, streak_last_active: null }).eq('id', currentUser.id);
    await loadProfile();
    renderStreak();
    showToast('Streak reset.');
  });

  on('#btn-use-freeze', 'click', async () => {
    showToast('❄️ Freeze used! Your streak is safe for today.');
  });

  // Toggle settings switches
  const toggleMap = {
    '#toggle-reminder'   : 'reminder',
    '#toggle-motivation' : 'motivation',
    '#toggle-autoblock'  : 'autoblock',
    '#toggle-meetingprep': 'meetingprep',
    '#toggle-vibration'  : 'vibration',
    '#toggle-sound'      : 'sound'
  };
  Object.entries(toggleMap).forEach(([sel, key]) => {
    on(sel, 'change', e => saveSettings(key, e.target.checked));
  });
}

// ═══════════════════════════════════════════════════════════════════
// QUICK CAPTURE (FAB)
// ═══════════════════════════════════════════════════════════════════
function setupQuickCapture() {
  on('#btn-quick-frog', 'click', async () => {
    const text = val('#quick-input');
    if (!text) return;
    await addTodo(text, 'frog');
    qs('#quick-input').value = '';
    closeQuickCapture();
  });

  on('#btn-quick-note', 'click', async () => {
    const text = val('#quick-input');
    if (!text) return;
    currentNote = { title: text.slice(0, 40), content: text, tag: null };
    await saveNote();
    qs('#quick-input').value = '';
    closeQuickCapture();
    switchSection('notes');
  });

  on('#btn-quick-task', 'click', async () => {
    const text = val('#quick-input');
    if (!text) return;
    await addTodo(text, '2');
    qs('#quick-input').value = '';
    closeQuickCapture();
  });

  on('#btn-quick-save', 'click', () => {
    const text = val('#quick-input');
    if (text) qs('#btn-quick-task')?.click();
  });

  on('#quick-input', 'keydown', e => {
    if (e.key === 'Enter') qs('#btn-quick-save')?.click();
    if (e.key === 'Escape') closeQuickCapture();
  });

  on('#btn-fab', 'click', () => {
    const panel = qs('#quick-capture');
    if (panel) {
      const open = panel.classList.toggle('open');
      if (open) qs('#quick-input')?.focus();
    }
  });

  on('#btn-close-quick', 'click', closeQuickCapture);
}

function closeQuickCapture() {
  qs('#quick-capture')?.classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function setupNavListeners() {
  onAll('[data-section]', 'click', e => {
    switchSection(e.currentTarget.dataset.section);
  });
}

function switchSection(section) {
  activeSection = section;
  qsAll('[data-section]').forEach(el =>
    el.classList.toggle('active', el.dataset.section === section));
  qsAll('.section-panel').forEach(el =>
    el.classList.toggle('active', el.dataset.panel === section));
}

// ═══════════════════════════════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════════════════════════════
function renderAll() {
  renderStreak();
  renderNotesList();
  renderNoteEditor();
  renderTodos();
  renderCalendar();
  renderSettingsProfile();
}

function renderSettingsProfile() {
  const nameEl = qs('#profile-name');
  if (nameEl) nameEl.textContent = profile?.name || currentUser?.email || '';
  const streakEl = qs('#profile-streak');
  if (streakEl) streakEl.textContent = profile?.streak_count ?? 0;

  // Sync settings toggles to saved values
  const s = profile?.settings || {};
  const m = {
    '#toggle-reminder'   : 'reminder',
    '#toggle-motivation' : 'motivation',
    '#toggle-autoblock'  : 'autoblock',
    '#toggle-meetingprep': 'meetingprep',
    '#toggle-vibration'  : 'vibration',
    '#toggle-sound'      : 'sound'
  };
  Object.entries(m).forEach(([sel, key]) => {
    const el = qs(sel);
    if (el) el.checked = s[key] ?? true;
  });
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function applyTheme() {
  document.body.classList.toggle('light-mode', lightMode);
}

function playDoneSound() {
  if (!profile?.settings?.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* audio not available */ }
}

function showToast(msg, type = 'success') {
  const toast = qs('#toast');
  if (!toast) {
    const t = document.createElement('div');
    t.id        = 'toast';
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
    return;
  }
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatHour(h) {
  if (h == null) return '';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${mm.toString().padStart(2,'0')} ${ampm}`;
}

function wrapSelection(before, after) {
  const el = qs('#note-content');
  if (!el) return;
  const start = el.selectionStart, end = el.selectionEnd;
  const sel   = el.value.slice(start, end);
  el.value    = el.value.slice(0, start) + before + sel + after + el.value.slice(end);
  el.focus();
  if (currentNote) currentNote.content = el.value;
}

function prefixLine(prefix) {
  const el = qs('#note-content');
  if (!el) return;
  const lines     = el.value.split('\n');
  const pos       = el.selectionStart;
  let  chars      = 0, lineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    chars += lines[i].length + 1;
    if (chars >= pos) { lineIdx = i; break; }
  }
  lines[lineIdx]  = prefix + lines[lineIdx];
  el.value        = lines.join('\n');
  if (currentNote) currentNote.content = el.value;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// DOM shortcuts
const qs     = s => document.querySelector(s);
const qsAll  = s => [...document.querySelectorAll(s)];
const val    = s => qs(s)?.value?.trim() ?? '';
const on     = (s, ev, fn) => qs(s)?.addEventListener(ev, fn);
const onAll  = (s, ev, fn) => qsAll(s).forEach(el => el.addEventListener(ev, fn));
