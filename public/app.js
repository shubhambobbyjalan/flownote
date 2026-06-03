// ═══════════════════════════════════════════════════════════════════
// FlowNote — app.js  v3.1  (Supabase auth, global onclick compatible)
// ═══════════════════════════════════════════════════════════════════

// Load Supabase via CDN (ESM) — injected dynamically so no module type needed
(async () => {
  // ── Load Supabase ──────────────────────────────────────────────
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  const SUPABASE_URL  = 'https://twwlwvlsrheyfiexmfvo.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

  // ── State ──────────────────────────────────────────────────────
  let currentUser   = null;
  let currentNote   = null;
  let notes         = [];
  let todos         = [];
  let calEvents     = [];
  let profile       = null;
  let activeTag     = null;
  let todayOffset   = 0;
  let lightMode     = false;

  // ── DOM helpers ────────────────────────────────────────────────
  const qs    = s => document.querySelector(s);
  const qsAll = s => [...document.querySelectorAll(s)];
  const val   = s => qs(s)?.value?.trim() ?? '';
  const on    = (s, ev, fn) => qs(s)?.addEventListener(ev, fn);

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL AUTH FUNCTIONS (called by onclick in index.html)
  // ═══════════════════════════════════════════════════════════════
  window.authGoogle = async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) showAuthError(error.message);
  };

  window.authLogin = async () => {
    const email    = val('#login-email');
    const password = val('#login-password');
    if (!email || !password) return showAuthError('Please enter email and password.');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) showAuthError(error.message);
  };

  window.authSignup = async () => {
    const name     = val('#signup-fname');
    const nickname = val('#signup-nick');
    const email    = val('#signup-email');
    const password = val('#signup-password');
    if (!name || !email || !password) return showAuthError('Please fill in all fields.');
    if (password.length < 8) return showAuthError('Password must be at least 8 characters.');
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, nickname } }
    });
    if (error) showAuthError(error.message);
    else showAuthError('✅ Check your email to confirm your account!');
  };

  window.authSignOut = async () => {
    await sb.auth.signOut();
  };

  window.switchAuthTab = (tab, btn) => {
    qs('#auth-login').style.display  = tab === 'login'  ? '' : 'none';
    qs('#auth-signup').style.display = tab === 'signup' ? '' : 'none';
    qsAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  function showAuthError(msg) {
    const el = qs('#auth-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTH STATE
  // ═══════════════════════════════════════════════════════════════
  async function onSignedIn(user) {
    currentUser = user;
    // Hide auth overlay
    const overlay = qs('#auth-overlay');
    if (overlay) overlay.style.display = 'none';
    // Load data
    await loadProfile();
    await Promise.all([loadNotes(), loadTodos(), loadCalEvents()]);
    renderAll();
    incrementStreakToday();
  }

  function onSignedOut() {
    currentUser = null; profile = null;
    notes = []; todos = []; calEvents = [];
    const overlay = qs('#auth-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  // Boot: check existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await onSignedIn(session.user);
  } else {
    // Show auth overlay
    const overlay = qs('#auth-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  // Listen for auth changes (OAuth redirect callback)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) {
      await onSignedIn(session.user);
    }
    if (event === 'SIGNED_OUT') onSignedOut();
  });

  // ═══════════════════════════════════════════════════════════════
  // PROFILE & STREAK
  // ═══════════════════════════════════════════════════════════════
  async function loadProfile() {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) { profile = data; lightMode = data.settings?.lightmode ?? false; applyTheme(); }
  }

  async function incrementStreakToday() {
    await sb.rpc('increment_streak', { uid: currentUser.id });
    await loadProfile();
    renderStreak();
  }

  function renderStreak() {
    const count = profile?.streak_count ?? 0;
    qsAll('.streak-num').forEach(el => el.textContent = count);
    const flame = qs('#header-streak');
    if (flame) flame.textContent = '🔥 ' + count + ' day streak';
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════════════════════════
  async function loadNotes() {
    const { data } = await sb.from('notes').select('*')
      .eq('user_id', currentUser.id).order('modified_at', { ascending: false });
    notes = data ?? [];
  }

  async function saveNote() {
    if (!currentNote) return;
    const payload = {
      user_id: currentUser.id,
      title: currentNote.title || '',
      content: currentNote.content || '',
      tag: currentNote.tag || null,
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
    showToast('✓ Saved');
  }

  async function deleteNote(id) {
    await sb.from('notes').delete().eq('id', id);
    currentNote = null;
    await loadNotes();
    renderNotesList();
    renderEditor();
  }

  function renderNotesList() {
    const list = qs('#notes-list');
    if (!list) return;
    const filtered = activeTag ? notes.filter(n => n.tag === activeTag) : notes;
    const countEl  = qs('#notes-count');
    if (countEl) countEl.textContent = notes.length;

    list.innerHTML = filtered.length === 0
      ? '<div style="padding:20px;color:var(--text3);text-align:center;">No notes yet — hit ＋</div>'
      : filtered.map(n => `
          <div class="note-row ${currentNote?.id === n.id ? 'active' : ''}" data-id="${n.id}">
            <div class="note-row-title">${esc(n.title || 'Untitled')}</div>
            <div class="note-row-preview">${esc((n.content||'').slice(0,55))}</div>
            ${n.tag ? `<span class="ntag ntag-${n.tag}">● ${n.tag}</span>` : ''}
          </div>`).join('');

    list.querySelectorAll('.note-row').forEach(el =>
      el.addEventListener('click', () => {
        const n = notes.find(x => x.id == el.dataset.id);
        if (n) { currentNote = { ...n }; renderNotesList(); renderEditor(); }
      }));
  }

  function renderEditor() {
    const title   = qs('#note-title');
    const content = qs('#note-content');
    const delBtn  = qs('#btn-del-note');
    if (!currentNote) {
      if (title)   title.value   = '';
      if (content) content.value = '';
      if (delBtn)  delBtn.style.display = 'none';
      return;
    }
    if (title)   title.value   = currentNote.title   || '';
    if (content) content.value = currentNote.content || '';
    if (delBtn)  delBtn.style.display = '';
    qsAll('.tag-pill').forEach(b =>
      b.classList.toggle('active', b.dataset.tag === currentNote.tag));
  }

  // Wire note editor
  on('#btn-new-note',  'click', () => { currentNote = { title:'', content:'', tag:null }; renderEditor(); renderNotesList(); });
  on('#btn-save-note', 'click', saveNote);
  on('#btn-del-note',  'click', () => currentNote?.id && deleteNote(currentNote.id));
  on('#note-title',    'input', e => { if (currentNote) currentNote.title   = e.target.value; });
  on('#note-content',  'input', e => { if (currentNote) currentNote.content = e.target.value; });

  qsAll('.tag-pill').forEach(btn => btn.addEventListener('click', () => {
    if (!currentNote) return;
    currentNote.tag = currentNote.tag === btn.dataset.tag ? null : btn.dataset.tag;
    qsAll('.tag-pill').forEach(b => b.classList.toggle('active', b.dataset.tag === currentNote.tag));
  }));

  qsAll('.filter-tag').forEach(btn => btn.addEventListener('click', () => {
    activeTag = activeTag === btn.dataset.tag ? null : btn.dataset.tag;
    qsAll('.filter-tag').forEach(b => b.classList.toggle('active', b.dataset.tag === activeTag));
    renderNotesList();
  }));

  // ═══════════════════════════════════════════════════════════════
  // TODOS
  // ═══════════════════════════════════════════════════════════════
  async function loadTodos() {
    const { data } = await sb.from('todos').select('*')
      .eq('user_id', currentUser.id).order('created_at', { ascending: false });
    todos = data ?? [];
  }

  async function addTodo(text, priority) {
    if (!text.trim()) return;
    await sb.from('todos').insert({ user_id: currentUser.id, text: text.trim(), priority: priority || '2' });
    await loadTodos(); renderTodos();
  }

  async function toggleTodo(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    await sb.from('todos').update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq('id', id);
    if (!t.done) { playDone(); await incrementStreakToday(); }
    await loadTodos(); renderTodos();
  }

  async function deleteTodo(id) {
    await sb.from('todos').delete().eq('id', id);
    await loadTodos(); renderTodos();
  }

  function renderTodos() {
    const list = qs('#todos-list');
    if (!list) return;
    const open = todos.filter(t => !t.done);
    const done = todos.filter(t =>  t.done);
    const pct  = todos.length ? Math.round(done.length / todos.length * 100) : 0;

    const countEl = qs('#todos-count');
    if (countEl) countEl.textContent = open.length;
    const progEl  = qs('#todo-progress-pct');
    if (progEl)  progEl.textContent  = pct + '%';
    const barEl   = qs('#todo-progress-bar');
    if (barEl)   barEl.style.width   = pct + '%';

    const frogEl  = qs('#frog-task-text');
    const frog    = todos.find(t => t.priority === 'frog' && !t.done);
    if (frogEl)  frogEl.textContent  = frog ? frog.text : '';

    list.innerHTML = [...open, ...done].map(t => `
      <div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
        <span class="todo-cb" data-id="${t.id}">${t.done ? '✓' : '○'}</span>
        <span class="todo-txt">${esc(t.text)}</span>
        ${t.priority === 'frog' ? '<span style="font-size:14px;">🐸</span>' : ''}
        <span class="todo-del" data-id="${t.id}">🗑</span>
      </div>`).join('');

    list.querySelectorAll('.todo-cb').forEach(el =>
      el.addEventListener('click', () => toggleTodo(Number(el.dataset.id))));
    list.querySelectorAll('.todo-del').forEach(el =>
      el.addEventListener('click', () => deleteTodo(Number(el.dataset.id))));
  }

  on('#btn-add-todo', 'click', () => {
    const inp = qs('#todo-input');
    const pri = qs('#todo-priority')?.value || '2';
    if (inp?.value.trim()) { addTodo(inp.value, pri); inp.value = ''; }
  });
  on('#todo-input', 'keydown', e => { if (e.key === 'Enter') qs('#btn-add-todo')?.click(); });

  // ═══════════════════════════════════════════════════════════════
  // CALENDAR
  // ═══════════════════════════════════════════════════════════════
  async function loadCalEvents() {
    const { data } = await sb.from('cal_events').select('*')
      .eq('user_id', currentUser.id).order('event_date', { ascending: true });
    calEvents = data ?? [];
  }

  async function saveCalEvent(ev) {
    await sb.from('cal_events').insert({ ...ev, user_id: currentUser.id });
    await loadCalEvents(); renderCalendar();
    showToast('✓ Event saved');
  }

  async function deleteCalEvent(id) {
    await sb.from('cal_events').delete().eq('id', id);
    await loadCalEvents(); renderCalendar();
  }

  function renderCalendar() {
    const list = qs('#cal-events-list');
    if (!list) return;
    const d = new Date();
    d.setDate(d.getDate() + todayOffset);
    const dateStr  = d.toISOString().split('T')[0];
    const labelEl  = qs('#cal-date-label');
    if (labelEl) labelEl.textContent = d.toLocaleDateString('en-IN', { weekday:'long', month:'long', day:'numeric' });

    const todayEvs = calEvents.filter(e => e.event_date === dateStr);
    list.innerHTML = todayEvs.length === 0
      ? '<div style="padding:20px;color:var(--text3);text-align:center;">No events today</div>'
      : todayEvs.map(e => `
          <div class="cal-ev" style="border-left:3px solid var(--accent)">
            <div class="cal-ev-title">${esc(e.title)}</div>
            ${e.start_hour != null ? `<div class="cal-ev-time">${fmtHour(e.start_hour)} – ${fmtHour(e.end_hour)}</div>` : ''}
            <span class="cal-ev-del" data-id="${e.id}">✕</span>
          </div>`).join('');

    list.querySelectorAll('.cal-ev-del').forEach(el =>
      el.addEventListener('click', () => deleteCalEvent(Number(el.dataset.id))));

    const upEl = qs('#cal-upcoming');
    if (upEl) {
      const upcoming = calEvents.filter(e => e.event_date > dateStr).slice(0, 5);
      upEl.innerHTML = upcoming.map(e =>
        `<div class="upcoming-ev"><span>${esc(e.title)}</span><span>${e.event_date}</span></div>`
      ).join('') || '<div style="color:var(--text3);padding:10px 0;">No upcoming events</div>';
    }
  }

  on('#btn-cal-prev',  'click', () => { todayOffset--; renderCalendar(); });
  on('#btn-cal-next',  'click', () => { todayOffset++; renderCalendar(); });
  on('#btn-cal-today', 'click', () => { todayOffset = 0; renderCalendar(); });

  on('#btn-new-event', 'click', () => {
    const m = qs('#event-modal');
    if (m) m.style.display = 'flex';
  });
  on('#btn-cancel-event', 'click', () => {
    const m = qs('#event-modal');
    if (m) m.style.display = 'none';
  });
  on('#btn-save-event', 'click', async () => {
    const title = val('#event-title');
    const date  = val('#event-date');
    if (!title || !date) return showToast('Title and date required', true);
    const toH = t => { if (!t) return null; const [h,m] = t.split(':').map(Number); return h + m/60; };
    await saveCalEvent({
      title, event_date: date,
      start_hour: toH(val('#event-start')),
      end_hour:   toH(val('#event-end')),
      color: qs('#event-color')?.value || 'blue',
      notes: val('#event-notes')
    });
    const m = qs('#event-modal');
    if (m) m.style.display = 'none';
    ['#event-title','#event-date','#event-start','#event-end','#event-notes']
      .forEach(s => { const el = qs(s); if (el) el.value = ''; });
  });

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════
  async function saveSetting(key, value) {
    if (!profile) return;
    const settings = { ...profile.settings, [key]: value };
    await sb.from('profiles').update({ settings }).eq('id', currentUser.id);
    profile.settings = settings;
  }

  on('#toggle-theme', 'click', async () => {
    lightMode = !lightMode; applyTheme();
    await saveSetting('lightmode', lightMode);
  });

  on('#btn-export', 'click', () => {
    const blob = new Blob([JSON.stringify({ notes, todos, calEvents }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'flownote-export.json' });
    a.click();
  });

  on('#btn-reset-streak', 'click', async () => {
    if (!confirm('Reset your streak? Cannot be undone.')) return;
    await sb.from('profiles').update({ streak_count: 0, streak_last_active: null }).eq('id', currentUser.id);
    await loadProfile(); renderStreak(); showToast('Streak reset');
  });

  on('#btn-use-freeze', 'click', () => showToast('❄️ Freeze used! Streak protected'));

  on('#btn-signout', 'click', () => sb.auth.signOut());

  // Settings toggles
  [['#toggle-reminder','reminder'],['#toggle-motivation','motivation'],
   ['#toggle-autoblock','autoblock'],['#toggle-meetingprep','meetingprep'],
   ['#toggle-vibration','vibration'],['#toggle-sound','sound']]
  .forEach(([sel, key]) => on(sel, 'change', e => saveSetting(key, e.target.checked)));

  // ═══════════════════════════════════════════════════════════════
  // QUICK CAPTURE
  // ═══════════════════════════════════════════════════════════════
  on('#btn-fab', 'click', () => {
    const p = qs('#quick-capture');
    if (p) { const open = p.classList.toggle('open'); if (open) qs('#quick-input')?.focus(); }
  });
  on('#btn-close-quick', 'click', () => qs('#quick-capture')?.classList.remove('open'));
  on('#btn-quick-save',  'click', async () => {
    const text = val('#quick-input');
    if (!text) return;
    await addTodo(text, '2');
    qs('#quick-input').value = '';
    qs('#quick-capture')?.classList.remove('open');
  });
  on('#quick-input', 'keydown', e => {
    if (e.key === 'Enter') qs('#btn-quick-save')?.click();
    if (e.key === 'Escape') qs('#quick-capture')?.classList.remove('open');
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER ALL
  // ═══════════════════════════════════════════════════════════════
  function renderAll() {
    renderStreak();
    renderNotesList();
    renderEditor();
    renderTodos();
    renderCalendar();
    renderSettingsProfile();
  }

  function renderSettingsProfile() {
    const el = qs('#profile-name');
    if (el) el.textContent = profile?.name || currentUser?.email || '';
    const s = qs('#profile-streak-val');
    if (s) s.textContent = profile?.streak_count ?? 0;
    // Sync toggles
    const map = { '#toggle-reminder':'reminder','#toggle-motivation':'motivation',
      '#toggle-autoblock':'autoblock','#toggle-meetingprep':'meetingprep',
      '#toggle-vibration':'vibration','#toggle-sound':'sound' };
    const settings = profile?.settings || {};
    Object.entries(map).forEach(([sel, key]) => {
      const el = qs(sel); if (el) el.checked = settings[key] ?? true;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function applyTheme() { document.body.classList.toggle('light-mode', lightMode); }

  function playDone() {
    if (!profile?.settings?.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  function showToast(msg, isError = false) {
    let t = qs('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent,#6c63ff);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;transition:opacity .3s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isError ? '#e74c3c' : 'var(--accent, #6c63ff)';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.style.opacity = '0', 2500);
  }

  function fmtHour(h) {
    if (h == null) return '';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${hh % 12 || 12}:${mm.toString().padStart(2,'0')} ${hh >= 12 ? 'PM' : 'AM'}`;
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

})();
