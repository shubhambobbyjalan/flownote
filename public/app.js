// ═══════════════════════════════════════════════════════════════════
// FlowNote — app.js  v4.0
// Fixes: light mode default, skip button, scrollable left panel,
//        responsive/mobile, sliding left panel
// ═══════════════════════════════════════════════════════════════════

(async () => {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  const SUPABASE_URL  = 'https://twwlwvlsrheyfiexmfvo.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

  // ── State ──────────────────────────────────────────────────────
  let currentUser = null, currentNote = null, profile = null;
  let notes = [], todos = [], calEvents = [];
  let activeTag = null, todayOffset = 0;
  let lightMode = true; // DEFAULT: light mode

  // ── DOM helpers ────────────────────────────────────────────────
  const qs    = s => document.querySelector(s);
  const qsAll = s => [...document.querySelectorAll(s)];
  const val   = s => qs(s)?.value?.trim() ?? '';
  const on    = (s, ev, fn) => qs(s)?.addEventListener(ev, fn);

  // ═══════════════════════════════════════════════════════════════
  // INJECT STYLES (responsive + slider panel + fixes)
  // ═══════════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.textContent = `
    /* ── Light mode as default ── */
    body { background:#f5f5f7; color:#1a1a2e; }
    body.dark-mode { background:#0c0d10; color:#e8e8f0; }

    /* ── Left panel slider ── */
    #left-panel {
      position: fixed; top: 0; left: 0; height: 100vh;
      width: 280px; z-index: 200;
      background: #fff;
      box-shadow: 2px 0 20px rgba(0,0,0,0.12);
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(.4,0,.2,1);
      overflow-y: auto;
      padding: 16px 0 80px;
      display: flex; flex-direction: column;
    }
    body.dark-mode #left-panel { background: #13141a; }
    #left-panel.open { transform: translateX(0); }

    #panel-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.35); z-index: 199;
    }
    #panel-overlay.show { display: block; }

    /* ── Panel toggle button ── */
    #btn-panel-toggle {
      position: fixed; top: 16px; left: 16px; z-index: 300;
      background: var(--accent, #6c63ff); color: #fff;
      border: none; border-radius: 10px;
      width: 40px; height: 40px; font-size: 20px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(108,99,255,0.3);
    }

    /* ── Main content area ── */
    #main-content {
      margin-left: 0 !important;
      padding: 16px;
      min-height: 100vh;
      padding-top: 70px;
    }

    /* ── Auth modal ── */
    .auth-overlay {
      position: fixed; inset: 0; z-index: 500;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .auth-card {
      background: #fff; border-radius: 20px;
      padding: 32px 28px; width: 100%; max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      max-height: 90vh; overflow-y: auto;
    }
    body.dark-mode .auth-card { background: #1a1b26; }

    /* ── Skip button ── */
    .auth-skip {
      display: block; width: 100%; margin-top: 12px;
      background: transparent; border: 1.5px dashed #ccc;
      border-radius: 10px; padding: 10px;
      color: #888; font-size: 13px; cursor: pointer;
      transition: all 0.2s;
    }
    .auth-skip:hover { border-color: #6c63ff; color: #6c63ff; }

    /* ── Toast ── */
    #toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      background: #6c63ff; color: #fff;
      padding: 10px 24px; border-radius: 10px;
      font-size: 14px; z-index: 9999;
      opacity: 0; transition: opacity 0.3s;
      pointer-events: none;
    }
    #toast.show { opacity: 1; }

    /* ── Responsive: tablet ── */
    @media (min-width: 768px) {
      #left-panel { width: 300px; }
      #main-content { padding: 24px 32px; padding-top: 80px; }
    }

    /* ── Responsive: desktop — panel always visible ── */
    @media (min-width: 1100px) {
      #left-panel {
        position: fixed; transform: translateX(0) !important;
        box-shadow: none; border-right: 1px solid rgba(0,0,0,0.08);
      }
      body.dark-mode #left-panel { border-color: rgba(255,255,255,0.06); }
      #main-content { margin-left: 300px !important; }
      #panel-overlay { display: none !important; }
      #btn-panel-toggle { display: none; }
    }

    /* ── Mobile nav bottom bar ── */
    #mobile-nav {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #fff; border-top: 1px solid #eee;
      z-index: 150; padding: 8px 0 12px;
      justify-content: space-around;
    }
    body.dark-mode #mobile-nav { background: #13141a; border-color: #2a2a3d; }
    @media (max-width: 1099px) { #mobile-nav { display: flex; } }
    .mobile-nav-btn {
      display: flex; flex-direction: column; align-items: center;
      gap: 2px; font-size: 10px; color: #888;
      background: none; border: none; cursor: pointer; padding: 4px 12px;
    }
    .mobile-nav-btn .icon { font-size: 20px; }
    .mobile-nav-btn.active { color: #6c63ff; }

    /* ── Section panels ── */
    .section-panel { display: none; }
    .section-panel.active { display: block; }

    /* ── Note list ── */
    .note-row {
      padding: 12px; border-radius: 10px; cursor: pointer;
      margin-bottom: 6px; border: 1.5px solid transparent;
      background: rgba(0,0,0,0.03);
    }
    body.dark-mode .note-row { background: rgba(255,255,255,0.04); }
    .note-row:hover { border-color: #6c63ff44; }
    .note-row.active { border-color: #6c63ff; background: #6c63ff11; }
    .note-row-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
    .note-row-preview { font-size: 12px; color: #888; }

    /* ── Todo items ── */
    .todo-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 10px; margin-bottom: 6px;
      background: rgba(0,0,0,0.03);
    }
    body.dark-mode .todo-item { background: rgba(255,255,255,0.04); }
    .todo-item.done .todo-txt { text-decoration: line-through; opacity: 0.5; }
    .todo-cb { cursor: pointer; font-size: 18px; flex-shrink: 0; color: #6c63ff; }
    .todo-txt { flex: 1; font-size: 14px; }
    .todo-del { cursor: pointer; opacity: 0.4; font-size: 14px; }
    .todo-del:hover { opacity: 1; color: #e74c3c; }

    /* ── Cal events ── */
    .cal-ev {
      padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;
      background: rgba(108,99,255,0.08); border-left: 3px solid #6c63ff;
      display: flex; align-items: center; gap: 8px;
    }
    .cal-ev-title { flex: 1; font-weight: 500; font-size: 14px; }
    .cal-ev-time { font-size: 12px; color: #888; }
    .cal-ev-del { cursor: pointer; opacity: 0.4; font-size: 13px; }
    .cal-ev-del:hover { opacity: 1; }

    /* ── Progress bar ── */
    .progress-track {
      background: rgba(0,0,0,0.08); border-radius: 99px;
      height: 6px; margin: 8px 0;
    }
    body.dark-mode .progress-track { background: rgba(255,255,255,0.1); }
    #todo-progress-bar {
      height: 6px; border-radius: 99px;
      background: linear-gradient(90deg,#6c63ff,#a78bfa);
      width: 0%; transition: width 0.4s ease;
    }

    /* ── Guest banner ── */
    #guest-banner {
      background: linear-gradient(135deg,#6c63ff22,#a78bfa22);
      border: 1.5px solid #6c63ff44;
      border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;
      font-size: 13px; display: flex; align-items: center; gap: 10px;
    }
    #guest-banner button {
      margin-left: auto; background: #6c63ff; color: #fff;
      border: none; border-radius: 8px; padding: 6px 14px;
      font-size: 12px; cursor: pointer;
    }

    /* ── Utility ── */
    .empty-state { color: #888; text-align: center; padding: 24px; font-size: 14px; }
    .btn-primary {
      background: #6c63ff; color: #fff; border: none;
      border-radius: 10px; padding: 10px 18px;
      font-size: 14px; cursor: pointer; font-weight: 500;
    }
    .btn-primary:hover { background: #5a52e0; }
    .btn-ghost {
      background: transparent; border: 1.5px solid #ddd;
      border-radius: 10px; padding: 8px 14px;
      font-size: 13px; cursor: pointer;
    }
    body.dark-mode .btn-ghost { border-color: #333; color: #ccc; }
    input[type=text], input[type=email], input[type=password],
    input[type=date], input[type=time], textarea, select {
      width: 100%; border: 1.5px solid #ddd; border-radius: 10px;
      padding: 10px 12px; font-size: 14px; background: #fff;
      color: #1a1a2e; box-sizing: border-box;
    }
    body.dark-mode input, body.dark-mode textarea, body.dark-mode select {
      background: #1e1f2e; border-color: #333; color: #e8e8f0;
    }
    input:focus, textarea:focus, select:focus {
      outline: none; border-color: #6c63ff;
    }
    h2 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
    h3 { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════
  // INJECT UI STRUCTURE
  // ═══════════════════════════════════════════════════════════════
  function buildShell() {
    // Panel toggle button
    if (!qs('#btn-panel-toggle')) {
      const btn = document.createElement('button');
      btn.id = 'btn-panel-toggle';
      btn.innerHTML = '☰';
      btn.title = 'Toggle menu';
      document.body.appendChild(btn);
    }

    // Panel overlay
    if (!qs('#panel-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'panel-overlay';
      document.body.appendChild(overlay);
    }

    // Toast
    if (!qs('#toast')) {
      const t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }

    // Mobile bottom nav
    if (!qs('#mobile-nav')) {
      const nav = document.createElement('div');
      nav.id = 'mobile-nav';
      nav.innerHTML = `
        <button class="mobile-nav-btn active" data-section="notes">
          <span class="icon">📝</span><span>Notes</span>
        </button>
        <button class="mobile-nav-btn" data-section="todos">
          <span class="icon">✓</span><span>To-Do</span>
        </button>
        <button class="mobile-nav-btn" data-section="calendar">
          <span class="icon">📅</span><span>Calendar</span>
        </button>
        <button class="mobile-nav-btn" data-section="settings">
          <span class="icon">⚙</span><span>Settings</span>
        </button>
      `;
      document.body.appendChild(nav);
    }

    // Skip button in auth card
    if (!qs('.auth-skip')) {
      const authCard = qs('.auth-card');
      if (authCard) {
        const skip = document.createElement('button');
        skip.className = 'auth-skip';
        skip.textContent = '👀 Just exploring? Skip sign-in →';
        authCard.appendChild(skip);
        skip.addEventListener('click', enterGuestMode);
      }
    }

    // Mark left panel
    const leftPanel = qs('#left-panel') || qs('.sidebar') || qs('aside') || qs('nav');
    if (leftPanel && leftPanel.id !== 'left-panel') leftPanel.id = 'left-panel';
  }

  // ═══════════════════════════════════════════════════════════════
  // PANEL OPEN/CLOSE
  // ═══════════════════════════════════════════════════════════════
  function openPanel() {
    qs('#left-panel')?.classList.add('open');
    qs('#panel-overlay')?.classList.add('show');
  }
  function closePanel() {
    qs('#left-panel')?.classList.remove('open');
    qs('#panel-overlay')?.classList.remove('show');
  }

  function setupPanelListeners() {
    on('#btn-panel-toggle', 'click', () => {
      qs('#left-panel')?.classList.contains('open') ? closePanel() : openPanel();
    });
    on('#panel-overlay', 'click', closePanel);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  function switchSection(section) {
    qsAll('.section-panel').forEach(el =>
      el.classList.toggle('active', el.dataset.panel === section));
    qsAll('[data-section]').forEach(el =>
      el.classList.toggle('active', el.dataset.section === section));
    // On mobile, close panel after nav
    if (window.innerWidth < 1100) closePanel();
  }

  function setupNavListeners() {
    qsAll('[data-section]').forEach(el =>
      el.addEventListener('click', () => switchSection(el.dataset.section)));
  }

  // ═══════════════════════════════════════════════════════════════
  // GUEST MODE
  // ═══════════════════════════════════════════════════════════════
  function enterGuestMode() {
    hideAuthOverlay();
    // Show guest banner
    const main = qs('#main-content') || qs('main') || document.body;
    if (!qs('#guest-banner')) {
      const banner = document.createElement('div');
      banner.id = 'guest-banner';
      banner.innerHTML = `
        <span>👋 Exploring as guest — data won't be saved</span>
        <button onclick="window.showAuthOverlay()">Sign in to save</button>
      `;
      main.prepend(banner);
    }
    switchSection('notes');
    showToast('👀 Guest mode — explore freely!');
  }

  window.showAuthOverlay = () => {
    const o = qs('#auth-overlay');
    if (o) o.style.display = 'flex';
  };

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL AUTH FUNCTIONS (called by onclick in index.html)
  // ═══════════════════════════════════════════════════════════════
  window.authGoogle = async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://flownote-two.vercel.app' }
    });
    if (error) showAuthError(error.message);
  };

  window.authLogin = async () => {
    const email = val('#login-email'), password = val('#login-password');
    if (!email || !password) return showAuthError('Please enter email and password.');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) showAuthError(error.message);
    else showToast('✅ Signed in!');
  };

  window.authSignup = async () => {
    const name = val('#signup-fname'), nickname = val('#signup-nick');
    const email = val('#signup-email'), password = val('#signup-password');
    if (!name || !email || !password) return showAuthError('Please fill all fields.');
    if (password.length < 8) return showAuthError('Password must be 8+ characters.');
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, nickname } }
    });
    if (error) showAuthError(error.message);
    else showAuthError('✅ Check your email to confirm!');
  };

  window.authSignOut = async () => { await sb.auth.signOut(); };

  window.switchAuthTab = (tab, btn) => {
    qs('#auth-login').style.display  = tab === 'login'  ? '' : 'none';
    qs('#auth-signup').style.display = tab === 'signup' ? '' : 'none';
    qsAll('.auth-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
  };

  function showAuthError(msg) {
    const el = qs('#auth-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function hideAuthOverlay() {
    const o = qs('#auth-overlay');
    if (o) o.style.display = 'none';
    qs('#guest-banner')?.remove();
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTH STATE
  // ═══════════════════════════════════════════════════════════════
  async function onSignedIn(user) {
    currentUser = user;
    hideAuthOverlay();
    qs('#guest-banner')?.remove();
    await loadProfile();
    await Promise.all([loadNotes(), loadTodos(), loadCalEvents()]);
    renderAll();
    incrementStreakToday();
  }

  function onSignedOut() {
    currentUser = null; profile = null;
    notes = []; todos = []; calEvents = [];
    window.showAuthOverlay();
  }

  // ═══════════════════════════════════════════════════════════════
  // PROFILE & STREAK
  // ═══════════════════════════════════════════════════════════════
  async function loadProfile() {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      profile = data;
      lightMode = data.settings?.lightmode ?? true;
      applyTheme();
    }
  }

  async function incrementStreakToday() {
    try { await sb.rpc('increment_streak', { uid: currentUser.id }); } catch(e) {}
    await loadProfile(); renderStreak();
  }

  function renderStreak() {
    const count = profile?.streak_count ?? 0;
    qsAll('.streak-num').forEach(el => el.textContent = count);
    const h = qs('#header-streak');
    if (h) h.textContent = '🔥 ' + count + ' day streak';
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
      user_id: currentUser.id, title: currentNote.title || '',
      content: currentNote.content || '', tag: currentNote.tag || null,
      modified_at: new Date().toISOString()
    };
    if (currentNote.id) {
      await sb.from('notes').update(payload).eq('id', currentNote.id);
    } else {
      const { data } = await sb.from('notes').insert(payload).select().single();
      if (data) currentNote.id = data.id;
    }
    await loadNotes(); renderNotesList(); showToast('✓ Note saved');
  }

  async function deleteNote(id) {
    await sb.from('notes').delete().eq('id', id);
    currentNote = null; await loadNotes(); renderNotesList(); renderEditor();
  }

  function renderNotesList() {
    const list = qs('#notes-list');
    if (!list) return;
    const filtered = activeTag ? notes.filter(n => n.tag === activeTag) : notes;
    const countEl = qs('#notes-count');
    if (countEl) countEl.textContent = notes.length;
    list.innerHTML = filtered.length === 0
      ? '<div class="empty-state">No notes yet — hit ＋</div>'
      : filtered.map(n => `
          <div class="note-row ${currentNote?.id === n.id ? 'active' : ''}" data-id="${n.id}">
            <div class="note-row-title">${esc(n.title || 'Untitled')}</div>
            <div class="note-row-preview">${esc((n.content||'').slice(0,55))}</div>
            ${n.tag ? `<span style="font-size:11px;color:#6c63ff;">● ${n.tag}</span>` : ''}
          </div>`).join('');
    list.querySelectorAll('.note-row').forEach(el =>
      el.addEventListener('click', () => {
        const n = notes.find(x => x.id == el.dataset.id);
        if (n) { currentNote = {...n}; renderNotesList(); renderEditor(); }
      }));
  }

  function renderEditor() {
    const title = qs('#note-title'), content = qs('#note-content');
    const delBtn = qs('#btn-del-note');
    if (!currentNote) {
      if (title) title.value = ''; if (content) content.value = '';
      if (delBtn) delBtn.style.display = 'none'; return;
    }
    if (title) title.value = currentNote.title || '';
    if (content) content.value = currentNote.content || '';
    if (delBtn) delBtn.style.display = '';
    qsAll('.tag-pill').forEach(b =>
      b.classList.toggle('active', b.dataset.tag === currentNote.tag));
  }

  on('#btn-new-note',  'click', () => { currentNote = {title:'',content:'',tag:null}; renderEditor(); renderNotesList(); });
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
    await sb.from('todos').insert({ user_id: currentUser.id, text: text.trim(), priority: priority||'2' });
    await loadTodos(); renderTodos();
  }

  async function toggleTodo(id) {
    const t = todos.find(x => x.id === id); if (!t) return;
    await sb.from('todos').update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq('id', id);
    if (!t.done) { playDone(); await incrementStreakToday(); }
    await loadTodos(); renderTodos();
  }

  async function deleteTodo(id) {
    await sb.from('todos').delete().eq('id', id);
    await loadTodos(); renderTodos();
  }

  function renderTodos() {
    const list = qs('#todos-list'); if (!list) return;
    const open = todos.filter(t => !t.done), done = todos.filter(t => t.done);
    const pct = todos.length ? Math.round(done.length/todos.length*100) : 0;
    const countEl = qs('#todos-count'); if (countEl) countEl.textContent = open.length;
    const pctEl = qs('#todo-progress-pct'); if (pctEl) pctEl.textContent = pct + '%';
    const barEl = qs('#todo-progress-bar'); if (barEl) barEl.style.width = pct + '%';
    const frog = todos.find(t => t.priority==='frog' && !t.done);
    const frogEl = qs('#frog-task-text'); if (frogEl) frogEl.textContent = frog ? frog.text : '';
    list.innerHTML = [...open,...done].map(t => `
      <div class="todo-item ${t.done?'done':''}" data-id="${t.id}">
        <span class="todo-cb" data-id="${t.id}">${t.done?'✓':'○'}</span>
        <span class="todo-txt">${esc(t.text)}</span>
        ${t.priority==='frog'?'<span>🐸</span>':''}
        <span class="todo-del" data-id="${t.id}">🗑</span>
      </div>`).join('');
    list.querySelectorAll('.todo-cb').forEach(el =>
      el.addEventListener('click', () => toggleTodo(Number(el.dataset.id))));
    list.querySelectorAll('.todo-del').forEach(el =>
      el.addEventListener('click', () => deleteTodo(Number(el.dataset.id))));
  }

  on('#btn-add-todo', 'click', () => {
    const inp = qs('#todo-input'), pri = qs('#todo-priority')?.value||'2';
    if (inp?.value.trim()) { addTodo(inp.value, pri); inp.value=''; }
  });
  on('#todo-input', 'keydown', e => { if (e.key==='Enter') qs('#btn-add-todo')?.click(); });

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
    await loadCalEvents(); renderCalendar(); showToast('✓ Event saved');
  }

  async function deleteCalEvent(id) {
    await sb.from('cal_events').delete().eq('id', id);
    await loadCalEvents(); renderCalendar();
  }

  function renderCalendar() {
    const list = qs('#cal-events-list'); if (!list) return;
    const d = new Date(); d.setDate(d.getDate() + todayOffset);
    const dateStr = d.toISOString().split('T')[0];
    const labelEl = qs('#cal-date-label');
    if (labelEl) labelEl.textContent = d.toLocaleDateString('en-IN', { weekday:'long', month:'long', day:'numeric' });
    const todayEvs = calEvents.filter(e => e.event_date === dateStr);
    list.innerHTML = todayEvs.length === 0
      ? '<div class="empty-state">No events today — hit ＋</div>'
      : todayEvs.map(e => `
          <div class="cal-ev">
            <div class="cal-ev-title">${esc(e.title)}</div>
            ${e.start_hour!=null?`<div class="cal-ev-time">${fmtHour(e.start_hour)}–${fmtHour(e.end_hour)}</div>`:''}
            <span class="cal-ev-del" data-id="${e.id}">✕</span>
          </div>`).join('');
    list.querySelectorAll('.cal-ev-del').forEach(el =>
      el.addEventListener('click', () => deleteCalEvent(Number(el.dataset.id))));
    const upEl = qs('#cal-upcoming');
    if (upEl) {
      const upcoming = calEvents.filter(e => e.event_date > dateStr).slice(0,5);
      upEl.innerHTML = upcoming.map(e =>
        `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;">
          <span>${esc(e.title)}</span><span style="color:#888;">${e.event_date}</span>
        </div>`).join('') || '<div class="empty-state">No upcoming events</div>';
    }
  }

  on('#btn-cal-prev',  'click', () => { todayOffset--; renderCalendar(); });
  on('#btn-cal-next',  'click', () => { todayOffset++; renderCalendar(); });
  on('#btn-cal-today', 'click', () => { todayOffset=0; renderCalendar(); });
  on('#btn-new-event', 'click', () => { const m=qs('#event-modal'); if(m) m.style.display='flex'; });
  on('#btn-cancel-event','click', () => { const m=qs('#event-modal'); if(m) m.style.display='none'; });
  on('#btn-save-event','click', async () => {
    const title=val('#event-title'), date=val('#event-date');
    if (!title||!date) return showToast('Title and date required', true);
    const toH = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h+m/60; };
    await saveCalEvent({
      title, event_date: date,
      start_hour: toH(val('#event-start')), end_hour: toH(val('#event-end')),
      color: qs('#event-color')?.value||'blue', notes: val('#event-notes')
    });
    const m=qs('#event-modal'); if(m) m.style.display='none';
    ['#event-title','#event-date','#event-start','#event-end','#event-notes']
      .forEach(s => { const el=qs(s); if(el) el.value=''; });
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

  on('#toggle-theme','click', async () => {
    lightMode = !lightMode; applyTheme();
    await saveSetting('lightmode', lightMode);
  });
  on('#btn-export','click', () => {
    const blob = new Blob([JSON.stringify({notes,todos,calEvents},null,2)],{type:'application/json'});
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'flownote-export.json'}).click();
  });
  on('#btn-reset-streak','click', async () => {
    if (!confirm('Reset streak?')) return;
    await sb.from('profiles').update({streak_count:0,streak_last_active:null}).eq('id',currentUser.id);
    await loadProfile(); renderStreak(); showToast('Streak reset');
  });
  on('#btn-use-freeze','click', () => showToast('❄️ Freeze used! Streak protected'));
  on('#btn-signout','click', () => sb.auth.signOut());
  [['#toggle-reminder','reminder'],['#toggle-motivation','motivation'],
   ['#toggle-autoblock','autoblock'],['#toggle-meetingprep','meetingprep'],
   ['#toggle-vibration','vibration'],['#toggle-sound','sound']]
  .forEach(([sel,key]) => on(sel,'change', e => saveSetting(key, e.target.checked)));

  // ═══════════════════════════════════════════════════════════════
  // QUICK CAPTURE
  // ═══════════════════════════════════════════════════════════════
  on('#btn-fab','click', () => {
    const p=qs('#quick-capture');
    if(p){const open=p.classList.toggle('open'); if(open) qs('#quick-input')?.focus();}
  });
  on('#btn-close-quick','click', () => qs('#quick-capture')?.classList.remove('open'));
  on('#btn-quick-save','click', async () => {
    const text=val('#quick-input'); if(!text) return;
    if (currentUser) await addTodo(text,'2');
    else showToast('Sign in to save tasks!', true);
    const inp=qs('#quick-input'); if(inp) inp.value='';
    qs('#quick-capture')?.classList.remove('open');
  });
  on('#quick-input','keydown', e => {
    if(e.key==='Enter') qs('#btn-quick-save')?.click();
    if(e.key==='Escape') qs('#quick-capture')?.classList.remove('open');
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER ALL
  // ═══════════════════════════════════════════════════════════════
  function renderAll() {
    renderStreak(); renderNotesList(); renderEditor();
    renderTodos(); renderCalendar(); renderSettingsProfile();
  }

  function renderSettingsProfile() {
    const el=qs('#profile-name');
    if(el) el.textContent = profile?.name || currentUser?.email || '';
    const s=qs('#profile-streak-val');
    if(s) s.textContent = profile?.streak_count ?? 0;
    const settings = profile?.settings || {};
    [['#toggle-reminder','reminder'],['#toggle-motivation','motivation'],
     ['#toggle-autoblock','autoblock'],['#toggle-meetingprep','meetingprep'],
     ['#toggle-vibration','vibration'],['#toggle-sound','sound']]
    .forEach(([sel,key]) => { const el=qs(sel); if(el) el.checked=settings[key]??true; });
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function applyTheme() {
    document.body.classList.toggle('dark-mode', !lightMode);
  }

  function playDone() {
    if (!profile?.settings?.sound) return;
    try {
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+0.1);
      gain.gain.setValueAtTime(0.3,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      osc.start(); osc.stop(ctx.currentTime+0.3);
    } catch(e) {}
  }

  function showToast(msg, isError=false) {
    const t = qs('#toast'); if (!t) return;
    t.textContent = msg;
    t.style.background = isError ? '#e74c3c' : '#6c63ff';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function fmtHour(h) {
    if (h==null) return '';
    const hh=Math.floor(h), mm=Math.round((h-hh)*60);
    return `${hh%12||12}:${mm.toString().padStart(2,'0')} ${hh>=12?'PM':'AM'}`;
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ═══════════════════════════════════════════════════════════════
  // BOOT
  // ═══════════════════════════════════════════════════════════════
  applyTheme(); // Apply light mode immediately
  buildShell();
  setupPanelListeners();
  setupNavListeners();

  // Show first section
  switchSection('notes');

  // Check session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await onSignedIn(session.user);
  } else {
    const overlay = qs('#auth-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && !currentUser) await onSignedIn(session.user);
    if (event === 'SIGNED_OUT') onSignedOut();
  });

})();
