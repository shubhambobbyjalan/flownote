// ═══════════════════════════════════════════════════════════════
// FlowNote — app.js v5.0 — Ship-ready prototype
// QA tested against live HTML structure
// ═══════════════════════════════════════════════════════════════
(async () => {

const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const SUPABASE_URL  = 'https://twwlwvlsrheyfiexmfvo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── State ──────────────────────────────────────────────────────
let currentUser = null, currentNote = null, profile = null;
let notes = [], todos = [], calEvents = [];
let activeTag = null, todayOffset = 0, lightMode = true;
let guestMode = false;

// ── DOM helpers ────────────────────────────────────────────────
const qs    = s => document.querySelector(s);
const qsAll = s => [...document.querySelectorAll(s)];
const val   = s => (qs(s)?.value || '').trim();
const on    = (sel, ev, fn) => qs(sel)?.addEventListener(ev, fn);

// ═══════════════════════════════════════════════════════════════
// 1. INJECT CSS — full layout fix, responsive, slider panel
// ═══════════════════════════════════════════════════════════════
const css = document.createElement('style');
css.textContent = `
/* ─ Reset & base ─ */
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}

/* ─ Theme: LIGHT default ─ */
:root{
  --bg:#f0f0f5;--surface:#ffffff;--surface2:#f7f7fa;
  --border:#e2e2ea;--text:#18181b;--text2:#52525b;--text3:#a1a1aa;
  --accent:#6c63ff;--accent2:#a78bfa;--danger:#ef4444;
  --shadow:0 2px 16px rgba(0,0,0,0.08);
  --radius:12px;--radius-sm:8px;
  --sidebar-w:260px;
}
body.dark{
  --bg:#0c0d10;--surface:#13141a;--surface2:#1c1d26;
  --border:#2a2a3d;--text:#e8e8f0;--text2:#a0a0b8;--text3:#555570;
  --shadow:0 2px 16px rgba(0,0,0,0.4);
}
body{background:var(--bg);color:var(--text);}

/* ─ Layout shell ─ */
#fn-shell{display:flex;height:100vh;overflow:hidden;position:relative;}

/* ─ Sidebar ─ */
#fn-sidebar{
  width:var(--sidebar-w);flex-shrink:0;
  background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;
  overflow-y:auto;overflow-x:hidden;
  transition:transform .28s cubic-bezier(.4,0,.2,1);
  z-index:100;
}
/* Mobile: off-canvas */
@media(max-width:899px){
  #fn-sidebar{
    position:fixed;top:0;left:0;height:100%;
    transform:translateX(-100%);
    box-shadow:4px 0 24px rgba(0,0,0,0.18);
  }
  #fn-sidebar.open{transform:translateX(0);}
}

/* ─ Sidebar overlay (mobile) ─ */
#fn-overlay{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,0.4);z-index:99;
  backdrop-filter:blur(2px);
}
#fn-overlay.show{display:block;}

/* ─ Main content ─ */
#fn-main{
  flex:1;display:flex;flex-direction:column;
  overflow:hidden;min-width:0;
}

/* ─ Top bar ─ */
#fn-topbar{
  height:54px;flex-shrink:0;
  background:var(--surface);border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:12px;
  padding:0 16px;
}
#fn-hamburger{
  display:none;background:none;border:none;cursor:pointer;
  color:var(--text);font-size:22px;padding:4px;line-height:1;
  border-radius:var(--radius-sm);transition:background .15s;
}
#fn-hamburger:hover{background:var(--surface2);}
@media(max-width:899px){#fn-hamburger{display:flex;align-items:center;}}

#fn-topbar-title{font-weight:700;font-size:17px;flex:1;}
#fn-streak-badge{
  background:var(--surface2);border:1px solid var(--border);
  border-radius:99px;padding:4px 12px;font-size:13px;font-weight:500;
  display:flex;align-items:center;gap:4px;
}
#fn-user-btn{
  background:var(--accent);color:#fff;border:none;
  border-radius:var(--radius-sm);padding:6px 14px;
  font-size:13px;font-weight:500;cursor:pointer;
}

/* ─ Section content ─ */
#fn-content{flex:1;overflow-y:auto;padding:20px;}
@media(max-width:899px){#fn-content{padding:14px;padding-bottom:72px;}}

/* ─ Section panels ─ */
.fn-panel{display:none;}
.fn-panel.active{display:block;}

/* ─ Mobile bottom nav ─ */
#fn-bottom-nav{
  display:none;position:fixed;bottom:0;left:0;right:0;
  background:var(--surface);border-top:1px solid var(--border);
  padding:6px 0 env(safe-area-inset-bottom,6px);
  z-index:98;justify-content:space-around;
}
@media(max-width:899px){#fn-bottom-nav{display:flex;}}
.fn-nav-btn{
  background:none;border:none;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;
  gap:2px;color:var(--text3);padding:4px 8px;
  font-size:10px;font-weight:500;
  transition:color .15s;
}
.fn-nav-btn .fn-nav-icon{font-size:22px;line-height:1;}
.fn-nav-btn.active{color:var(--accent);}

/* ─ Sidebar nav items ─ */
.fn-sidebar-section{padding:8px 12px 4px;font-size:11px;font-weight:600;
  color:var(--text3);text-transform:uppercase;letter-spacing:.06em;}
.fn-sidebar-item{
  display:flex;align-items:center;gap:10px;
  padding:10px 16px;cursor:pointer;border-radius:var(--radius-sm);
  margin:1px 8px;font-size:14px;font-weight:500;color:var(--text2);
  transition:background .15s,color .15s;border:none;background:none;width:calc(100% - 16px);
  text-align:left;
}
.fn-sidebar-item:hover{background:var(--surface2);color:var(--text);}
.fn-sidebar-item.active{background:rgba(108,99,255,.12);color:var(--accent);}
.fn-sidebar-item .icon{font-size:18px;width:22px;text-align:center;}
.fn-sidebar-badge{
  margin-left:auto;background:var(--accent);color:#fff;
  border-radius:99px;font-size:11px;padding:1px 7px;font-weight:600;
}

/* ─ Sidebar streak widget ─ */
#fn-streak-widget{
  margin:12px;padding:14px;border-radius:var(--radius);
  background:linear-gradient(135deg,rgba(108,99,255,.15),rgba(167,139,250,.1));
  border:1px solid rgba(108,99,255,.2);text-align:center;
}
#fn-streak-num{font-size:32px;font-weight:800;color:var(--accent);}
.fn-streak-label{font-size:12px;color:var(--text2);}

/* ─ Cards ─ */
.fn-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:20px;margin-bottom:16px;
  box-shadow:var(--shadow);
}

/* ─ Page header ─ */
.fn-page-header{
  display:flex;align-items:center;gap:10px;margin-bottom:20px;
}
.fn-page-title{font-size:22px;font-weight:700;flex:1;}
.fn-page-sub{font-size:13px;color:var(--text2);}

/* ─ Buttons ─ */
.btn{
  border:none;border-radius:var(--radius-sm);padding:8px 16px;
  font-size:14px;font-weight:500;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;
  transition:opacity .15s,transform .1s;
}
.btn:active{transform:scale(.97);}
.btn-primary{background:var(--accent);color:#fff;}
.btn-primary:hover{opacity:.88;}
.btn-ghost{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
.btn-ghost:hover{background:var(--border);}
.btn-danger{background:var(--danger);color:#fff;}
.btn-sm{padding:5px 12px;font-size:13px;}
.btn-icon{padding:7px;border-radius:var(--radius-sm);}

/* ─ Inputs ─ */
.fn-input{
  width:100%;border:1.5px solid var(--border);border-radius:var(--radius-sm);
  padding:9px 12px;font-size:14px;background:var(--surface);color:var(--text);
  transition:border-color .15s;outline:none;
}
.fn-input:focus{border-color:var(--accent);}
textarea.fn-input{resize:vertical;min-height:120px;line-height:1.6;}
.fn-label{font-size:13px;font-weight:500;color:var(--text2);margin-bottom:4px;display:block;}
.fn-field{margin-bottom:14px;}

/* ─ Notes ─ */
#notes-layout{display:flex;gap:16px;height:calc(100vh - 140px);}
#notes-list-col{width:240px;flex-shrink:0;overflow-y:auto;}
#notes-editor-col{flex:1;display:flex;flex-direction:column;gap:12px;overflow:hidden;}
@media(max-width:700px){
  #notes-layout{flex-direction:column;height:auto;}
  #notes-list-col{width:100%;max-height:220px;}
  #notes-editor-col{min-height:320px;}
}
.note-item{
  padding:12px;border-radius:var(--radius-sm);cursor:pointer;
  border:1.5px solid transparent;margin-bottom:6px;
  background:var(--surface2);transition:all .15s;
}
.note-item:hover{border-color:rgba(108,99,255,.3);}
.note-item.active{border-color:var(--accent);background:rgba(108,99,255,.06);}
.note-item-title{font-size:14px;font-weight:600;margin-bottom:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.note-item-preview{font-size:12px;color:var(--text3);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.note-tag{font-size:11px;margin-top:4px;color:var(--accent);}
#note-title-input{
  font-size:20px;font-weight:700;border:none;background:transparent;
  color:var(--text);outline:none;width:100%;padding:4px 0;
  border-bottom:2px solid var(--border);transition:border-color .15s;
}
#note-title-input:focus{border-color:var(--accent);}
#note-body{
  flex:1;border:1.5px solid var(--border);border-radius:var(--radius);
  padding:14px;font-size:14px;line-height:1.7;background:var(--surface);
  color:var(--text);outline:none;resize:none;font-family:inherit;
  transition:border-color .15s;
}
#note-body:focus{border-color:var(--accent);}
.tag-chip{
  padding:4px 12px;border-radius:99px;font-size:12px;font-weight:500;
  border:1.5px solid var(--border);cursor:pointer;background:var(--surface2);
  color:var(--text2);transition:all .15s;
}
.tag-chip.active{background:var(--accent);color:#fff;border-color:var(--accent);}
.fn-toolbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}

/* ─ Todos ─ */
.todo-item{
  display:flex;align-items:center;gap:12px;
  padding:12px 14px;border-radius:var(--radius-sm);
  background:var(--surface2);margin-bottom:6px;
  border:1.5px solid transparent;transition:all .15s;
}
.todo-item:hover{border-color:var(--border);}
.todo-item.done{opacity:.55;}
.todo-check{
  width:22px;height:22px;border-radius:50%;
  border:2px solid var(--accent);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;transition:all .15s;font-size:13px;
  background:transparent;
}
.todo-item.done .todo-check{background:var(--accent);color:#fff;}
.todo-text{flex:1;font-size:14px;}
.todo-item.done .todo-text{text-decoration:line-through;color:var(--text3);}
.frog-tag{font-size:12px;background:rgba(34,197,94,.15);
  color:#16a34a;padding:2px 8px;border-radius:99px;}
.todo-del{cursor:pointer;color:var(--text3);font-size:16px;
  opacity:0;transition:opacity .15s;}
.todo-item:hover .todo-del{opacity:1;}

/* ─ Progress bar ─ */
.fn-progress-track{
  height:6px;background:var(--surface2);border-radius:99px;
  margin:8px 0;overflow:hidden;
}
#fn-progress-fill{
  height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));
  border-radius:99px;width:0%;transition:width .4s ease;
}

/* ─ Cal events ─ */
.cal-event{
  display:flex;align-items:center;gap:10px;
  padding:12px 14px;border-radius:var(--radius-sm);
  background:var(--surface2);margin-bottom:8px;
  border-left:3px solid var(--accent);
}
.cal-event-title{flex:1;font-size:14px;font-weight:500;}
.cal-event-time{font-size:12px;color:var(--text3);}
.cal-event-del{cursor:pointer;color:var(--text3);font-size:14px;
  opacity:0;transition:opacity .15s;}
.cal-event:hover .cal-event-del{opacity:1;}
.upcoming-row{
  display:flex;justify-content:space-between;
  padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;
}
.upcoming-row:last-child{border:none;}

/* ─ Modal ─ */
.fn-modal-bg{
  position:fixed;inset:0;background:rgba(0,0,0,.5);
  z-index:500;display:none;align-items:center;justify-content:center;
  padding:16px;backdrop-filter:blur(4px);
}
.fn-modal-bg.open{display:flex;}
.fn-modal{
  background:var(--surface);border-radius:var(--radius);
  padding:24px;width:100%;max-width:420px;
  box-shadow:0 24px 60px rgba(0,0,0,.25);
  max-height:90vh;overflow-y:auto;
}
.fn-modal-title{font-size:18px;font-weight:700;margin-bottom:20px;}

/* ─ Auth overlay ─ */
.auth-overlay{
  position:fixed;inset:0;background:rgba(10,10,20,.65);
  z-index:600;display:none;align-items:center;justify-content:center;
  padding:16px;backdrop-filter:blur(8px);
}
.auth-overlay.open{display:flex;}
.auth-card{
  background:var(--surface);border-radius:20px;
  padding:32px 28px;width:100%;max-width:400px;
  box-shadow:0 24px 80px rgba(0,0,0,.3);
  max-height:92vh;overflow-y:auto;
}
.auth-logo{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.auth-logo-icon{font-size:28px;}
.auth-logo-text{font-size:22px;font-weight:800;}
.auth-tagline{font-size:13px;color:var(--text2);margin-bottom:20px;}
.auth-tabs{display:flex;gap:4px;background:var(--surface2);
  border-radius:var(--radius-sm);padding:3px;margin-bottom:20px;}
.auth-tab{
  flex:1;padding:7px;border:none;border-radius:6px;
  font-size:13px;font-weight:500;cursor:pointer;
  background:transparent;color:var(--text2);transition:all .15s;
}
.auth-tab.active{background:var(--surface);color:var(--text);
  box-shadow:0 1px 4px rgba(0,0,0,.1);}
.auth-google{
  width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
  padding:11px;border:1.5px solid var(--border);border-radius:var(--radius-sm);
  background:var(--surface);color:var(--text);font-size:14px;font-weight:500;
  cursor:pointer;margin-top:12px;transition:all .15s;
}
.auth-google:hover{background:var(--surface2);border-color:var(--accent);}
.auth-divider{display:flex;align-items:center;gap:10px;margin:16px 0;
  color:var(--text3);font-size:12px;}
.auth-divider::before,.auth-divider::after{content:'';flex:1;
  height:1px;background:var(--border);}
.auth-submit{
  width:100%;padding:11px;background:var(--accent);color:#fff;
  border:none;border-radius:var(--radius-sm);font-size:14px;
  font-weight:600;cursor:pointer;margin-top:4px;transition:opacity .15s;
}
.auth-submit:hover{opacity:.88;}
.auth-error{font-size:13px;color:var(--danger);margin-bottom:12px;
  min-height:18px;text-align:center;}
.auth-skip{
  width:100%;margin-top:12px;padding:10px;
  background:transparent;border:1.5px dashed var(--border);
  border-radius:var(--radius-sm);color:var(--text3);
  font-size:13px;cursor:pointer;transition:all .15s;
}
.auth-skip:hover{border-color:var(--accent);color:var(--accent);}
.auth-footer{font-size:11px;color:var(--text3);text-align:center;margin-top:16px;}
.auth-footer a{color:var(--accent);}

/* ─ Guest banner ─ */
#fn-guest-banner{
  display:none;
  background:rgba(108,99,255,.08);border:1px solid rgba(108,99,255,.25);
  border-radius:var(--radius-sm);padding:10px 16px;
  font-size:13px;color:var(--text2);
  display:flex;align-items:center;gap:10px;margin-bottom:16px;
}
#fn-guest-banner.show{display:flex;}

/* ─ Toast ─ */
#fn-toast{
  position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(8px);
  background:#18181b;color:#fff;padding:10px 20px;border-radius:99px;
  font-size:13px;font-weight:500;z-index:999;
  opacity:0;transition:all .25s;pointer-events:none;white-space:nowrap;
  box-shadow:0 4px 20px rgba(0,0,0,.25);
}
#fn-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
@media(min-width:900px){#fn-toast{bottom:28px;}}

/* ─ Empty state ─ */
.fn-empty{
  text-align:center;padding:40px 20px;color:var(--text3);
}
.fn-empty-icon{font-size:36px;margin-bottom:8px;}
.fn-empty-text{font-size:14px;}

/* ─ Settings rows ─ */
.settings-row{
  display:flex;align-items:center;gap:12px;
  padding:14px 0;border-bottom:1px solid var(--border);
}
.settings-row:last-child{border:none;}
.settings-row-info{flex:1;}
.settings-row-label{font-size:14px;font-weight:500;}
.settings-row-sub{font-size:12px;color:var(--text2);margin-top:2px;}
/* Toggle switch */
.fn-toggle{
  position:relative;width:42px;height:24px;flex-shrink:0;
}
.fn-toggle input{opacity:0;width:0;height:0;}
.fn-toggle-slider{
  position:absolute;inset:0;background:var(--border);
  border-radius:99px;cursor:pointer;transition:.2s;
}
.fn-toggle-slider::after{
  content:'';position:absolute;left:3px;top:3px;
  width:18px;height:18px;border-radius:50%;
  background:#fff;transition:.2s;
}
.fn-toggle input:checked+.fn-toggle-slider{background:var(--accent);}
.fn-toggle input:checked+.fn-toggle-slider::after{transform:translateX(18px);}

/* ─ Scrollbar ─ */
::-webkit-scrollbar{width:5px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px;}

/* ─ Frog box ─ */
#fn-frog-box{
  background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(108,99,255,.08));
  border:1px solid rgba(34,197,94,.2);border-radius:var(--radius);
  padding:14px 16px;margin-bottom:16px;
}
`;
document.head.appendChild(css);

// ═══════════════════════════════════════════════════════════════
// 2. BUILD APP SHELL — replaces existing body content
// ═══════════════════════════════════════════════════════════════
function buildShell() {
  // Save auth overlay if it exists
  const existingAuth = qs('.auth-overlay')?.outerHTML || '';

  document.body.innerHTML = `
    <div id="fn-shell">

      <!-- SIDEBAR -->
      <aside id="fn-sidebar">
        <div style="padding:16px 16px 8px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:22px;">🐸</span>
          <span style="font-size:17px;font-weight:800;">FlowNote</span>
        </div>

        <div id="fn-streak-widget">
          <div id="fn-streak-num">0</div>
          <div class="fn-streak-label">🔥 day streak</div>
        </div>

        <div class="fn-sidebar-section">Workspace</div>
        <button class="fn-sidebar-item active" data-section="notes">
          <span class="icon">📝</span> Notes
          <span class="fn-sidebar-badge" id="sb-notes-count">0</span>
        </button>
        <button class="fn-sidebar-item" data-section="todos">
          <span class="icon">✓</span> To-Do
          <span class="fn-sidebar-badge" id="sb-todos-count">0</span>
        </button>
        <button class="fn-sidebar-item" data-section="calendar">
          <span class="icon">📅</span> Calendar
        </button>

        <div class="fn-sidebar-section">Focus</div>
        <button class="fn-sidebar-item" data-section="settings">
          <span class="icon">⚙</span> Settings
        </button>

        <div style="flex:1;"></div>

        <div style="padding:12px;border-top:1px solid var(--border);margin-top:8px;">
          <div id="fn-sidebar-user" style="font-size:13px;color:var(--text2);margin-bottom:8px;"></div>
          <button class="btn btn-ghost btn-sm" style="width:100%;" id="fn-signout-btn">Sign out</button>
        </div>
      </aside>

      <!-- OVERLAY -->
      <div id="fn-overlay"></div>

      <!-- MAIN -->
      <div id="fn-main">

        <!-- TOP BAR -->
        <div id="fn-topbar">
          <button id="fn-hamburger" title="Menu">☰</button>
          <div id="fn-topbar-title">Notes</div>
          <div id="fn-streak-badge">🔥 <span id="fn-streak-badge-num">0</span></div>
          <button class="btn btn-primary btn-sm" id="fn-auth-btn">Sign in</button>
        </div>

        <!-- CONTENT -->
        <div id="fn-content">

          <!-- Guest banner -->
          <div id="fn-guest-banner">
            <span>👀 Guest mode — data won't be saved</span>
            <button class="btn btn-primary btn-sm" style="margin-left:auto;" id="fn-guest-signin">Sign in to save</button>
          </div>

          <!-- NOTES PANEL -->
          <div class="fn-panel active" data-panel="notes">
            <div class="fn-page-header">
              <div class="fn-page-title">📝 Notes</div>
              <button class="btn btn-primary btn-sm" id="btn-new-note">＋ New</button>
            </div>

            <!-- Tag filters -->
            <div class="fn-toolbar" style="margin-bottom:14px;">
              <button class="tag-chip active" data-tag="all">All</button>
              <button class="tag-chip" data-tag="Work">● Work</button>
              <button class="tag-chip" data-tag="Personal">● Personal</button>
              <button class="tag-chip" data-tag="Ideas">● Ideas</button>
            </div>

            <div id="notes-layout">
              <div id="notes-list-col">
                <div id="fn-notes-list">
                  <div class="fn-empty"><div class="fn-empty-icon">📝</div>
                    <div class="fn-empty-text">No notes yet</div></div>
                </div>
              </div>
              <div id="notes-editor-col">
                <input id="note-title-input" class="fn-input" placeholder="Note title..." />
                <div class="fn-toolbar">
                  <button class="tag-chip" data-notetag="Work">Work</button>
                  <button class="tag-chip" data-notetag="Personal">Personal</button>
                  <button class="tag-chip" data-notetag="Ideas">Ideas</button>
                  <div style="flex:1;"></div>
                  <button class="btn btn-ghost btn-sm" id="btn-del-note" style="display:none;color:var(--danger);">🗑 Delete</button>
                  <button class="btn btn-primary btn-sm" id="btn-save-note">✓ Save</button>
                </div>
                <textarea id="note-body" class="fn-input" placeholder="Start writing..."></textarea>
              </div>
            </div>
          </div>

          <!-- TODOS PANEL -->
          <div class="fn-panel" data-panel="todos">
            <div class="fn-page-header">
              <div class="fn-page-title">✓ To-Do</div>
            </div>

            <div id="fn-frog-box">
              <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:4px;">🐸 EAT THAT FROG FIRST</div>
              <div id="fn-frog-text" style="font-size:15px;font-weight:600;color:var(--text);">No frog set yet — add one below!</div>
            </div>

            <div class="fn-card" style="margin-bottom:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:13px;font-weight:500;">Today's focus</span>
                <span id="fn-progress-pct" style="font-size:13px;color:var(--accent);font-weight:600;">0%</span>
              </div>
              <div class="fn-progress-track"><div id="fn-progress-fill"></div></div>
            </div>

            <div class="fn-card">
              <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
                <input id="fn-todo-input" class="fn-input" placeholder="What needs doing?" style="flex:1;min-width:180px;" />
                <select id="fn-todo-priority" class="fn-input" style="width:auto;min-width:90px;">
                  <option value="frog">🐸 Frog</option>
                  <option value="high">🔴 High</option>
                  <option value="med" selected>🟡 Med</option>
                  <option value="low">🟢 Low</option>
                </select>
                <button class="btn btn-primary" id="btn-add-todo">Add</button>
              </div>
              <div id="fn-todos-list"></div>
            </div>
          </div>

          <!-- CALENDAR PANEL -->
          <div class="fn-panel" data-panel="calendar">
            <div class="fn-page-header">
              <div class="fn-page-title">📅 Calendar</div>
              <button class="btn btn-primary btn-sm" id="btn-new-event">＋ Event</button>
            </div>

            <div class="fn-card">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" id="btn-cal-prev">‹</button>
                <div id="fn-cal-date" style="flex:1;font-size:15px;font-weight:600;text-align:center;"></div>
                <button class="btn btn-ghost btn-sm" id="btn-cal-today">Today</button>
                <button class="btn btn-ghost btn-sm" id="btn-cal-next">›</button>
              </div>
              <div id="fn-cal-events"></div>
            </div>

            <div class="fn-card">
              <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Upcoming</div>
              <div id="fn-cal-upcoming"></div>
            </div>
          </div>

          <!-- SETTINGS PANEL -->
          <div class="fn-panel" data-panel="settings">
            <div class="fn-page-header">
              <div class="fn-page-title">⚙ Settings</div>
            </div>

            <div class="fn-card">
              <div style="font-size:16px;font-weight:600;margin-bottom:4px;" id="fn-profile-name">Loading...</div>
              <div style="font-size:13px;color:var(--text2);">🔥 <span id="fn-profile-streak">0</span> day streak</div>
            </div>

            <div class="fn-card">
              ${settingsRow('fn-toggle-theme','🌓 Theme','Switch between dark and light')}
              ${settingsRow('fn-toggle-sound','🔊 Sound on complete','Satisfying sound when done')}
              ${settingsRow('fn-toggle-vibration','📳 Vibration','Haptic feedback on mobile')}
              ${settingsRow('fn-toggle-reminder','🔔 Daily reminder','Morning reminder to eat your frog')}
              ${settingsRow('fn-toggle-motivation','💬 Motivation messages','Quotes on task completion')}
            </div>

            <div class="fn-card">
              <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Data</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" id="btn-export">📤 Export JSON</button>
                <button class="btn btn-sm" style="background:rgba(239,68,68,.1);color:var(--danger);" id="btn-reset-streak">Reset streak</button>
              </div>
            </div>
          </div>

        </div><!-- /fn-content -->
      </div><!-- /fn-main -->
    </div><!-- /fn-shell -->

    <!-- BOTTOM NAV (mobile) -->
    <div id="fn-bottom-nav">
      <button class="fn-nav-btn active" data-section="notes">
        <span class="fn-nav-icon">📝</span><span>Notes</span>
      </button>
      <button class="fn-nav-btn" data-section="todos">
        <span class="fn-nav-icon">✓</span><span>Tasks</span>
      </button>
      <button class="fn-nav-btn" data-section="calendar">
        <span class="fn-nav-icon">📅</span><span>Calendar</span>
      </button>
      <button class="fn-nav-btn" data-section="settings">
        <span class="fn-nav-icon">⚙</span><span>Settings</span>
      </button>
    </div>

    <!-- EVENT MODAL -->
    <div class="fn-modal-bg" id="fn-event-modal">
      <div class="fn-modal">
        <div class="fn-modal-title">New Calendar Event</div>
        <div class="fn-field"><label class="fn-label">Title</label>
          <input id="ev-title" class="fn-input" placeholder="Event title" /></div>
        <div class="fn-field"><label class="fn-label">Date</label>
          <input id="ev-date" type="date" class="fn-input" /></div>
        <div style="display:flex;gap:10px;">
          <div class="fn-field" style="flex:1;"><label class="fn-label">Start</label>
            <input id="ev-start" type="time" class="fn-input" /></div>
          <div class="fn-field" style="flex:1;"><label class="fn-label">End</label>
            <input id="ev-end" type="time" class="fn-input" /></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:4px;">
          <button class="btn btn-ghost" style="flex:1;" id="btn-cancel-event">Cancel</button>
          <button class="btn btn-primary" style="flex:1;" id="btn-save-event">Save Event</button>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <div id="fn-toast"></div>

    <!-- AUTH OVERLAY -->
    <div class="auth-overlay" id="fn-auth-overlay">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="auth-logo-icon">🐸</span>
          <span class="auth-logo-text">FlowNote</span>
        </div>
        <div class="auth-tagline">Your focus companion — notes, tasks & calendar in one place</div>
        <div class="auth-error" id="fn-auth-error"></div>
        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login">Sign in</button>
          <button class="auth-tab" id="tab-signup">Create account</button>
        </div>
        <div id="fn-login-pane">
          <div class="fn-field"><label class="fn-label">Email</label>
            <input type="email" id="fn-login-email" class="fn-input" placeholder="you@email.com" /></div>
          <div class="fn-field"><label class="fn-label">Password</label>
            <input type="password" id="fn-login-pw" class="fn-input" placeholder="••••••••" /></div>
          <button class="auth-submit" id="btn-login">Sign in to FlowNote</button>
        </div>
        <div id="fn-signup-pane" style="display:none;">
          <div style="display:flex;gap:10px;">
            <div class="fn-field" style="flex:1;"><label class="fn-label">First name</label>
              <input type="text" id="fn-signup-name" class="fn-input" placeholder="Alex" /></div>
            <div class="fn-field" style="flex:1;"><label class="fn-label">Nickname</label>
              <input type="text" id="fn-signup-nick" class="fn-input" placeholder="Ace" /></div>
          </div>
          <div class="fn-field"><label class="fn-label">Email</label>
            <input type="email" id="fn-signup-email" class="fn-input" placeholder="you@email.com" /></div>
          <div class="fn-field"><label class="fn-label">Password</label>
            <input type="password" id="fn-signup-pw" class="fn-input" placeholder="Min 8 characters" /></div>
          <button class="auth-submit" id="btn-signup">Create my account 🚀</button>
        </div>
        <div class="auth-divider">or continue with</div>
        <button class="auth-google" id="btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <button class="auth-skip" id="btn-skip">👀 Just exploring? Skip sign-in →</button>
        <div class="auth-footer">By continuing you agree to our <a href="#">Terms</a> &amp; <a href="#">Privacy</a>.<br>Your data stays private — we never sell it.</div>
      </div>
    </div>
  `;
}

function settingsRow(id, label, sub) {
  return `<div class="settings-row">
    <div class="settings-row-info">
      <div class="settings-row-label">${label}</div>
      <div class="settings-row-sub">${sub}</div>
    </div>
    <label class="fn-toggle">
      <input type="checkbox" id="${id}" checked>
      <span class="fn-toggle-slider"></span>
    </label>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// 3. WIRE UP ALL LISTENERS
// ═══════════════════════════════════════════════════════════════
function wireListeners() {

  // ── Hamburger / sidebar ──
  on('#fn-hamburger','click', toggleSidebar);
  on('#fn-overlay','click', closeSidebar);

  // ── Section nav ──
  qsAll('[data-section]').forEach(el =>
    el.addEventListener('click', () => switchSection(el.dataset.section)));

  // ── Auth tab switching ──
  on('#tab-login','click', () => {
    qs('#fn-login-pane').style.display = '';
    qs('#fn-signup-pane').style.display = 'none';
    qs('#tab-login').classList.add('active');
    qs('#tab-signup').classList.remove('active');
  });
  on('#tab-signup','click', () => {
    qs('#fn-login-pane').style.display = 'none';
    qs('#fn-signup-pane').style.display = '';
    qs('#tab-signup').classList.add('active');
    qs('#tab-login').classList.remove('active');
  });

  // ── Auth actions ──
  on('#btn-google','click', async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://flownote-two.vercel.app' }
    });
    if (error) authErr(error.message);
  });

  on('#btn-login','click', async () => {
    const email = val('#fn-login-email'), pw = val('#fn-login-pw');
    if (!email||!pw) return authErr('Please enter email and password.');
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) authErr(error.message);
  });

  on('#btn-signup','click', async () => {
    const name  = val('#fn-signup-name');
    const email = val('#fn-signup-email');
    const pw    = val('#fn-signup-pw');
    if (!name||!email||!pw) return authErr('Please fill all fields.');
    if (pw.length < 8) return authErr('Password must be 8+ characters.');
    const { error } = await sb.auth.signUp({
      email, password: pw,
      options: { data: { name, nickname: val('#fn-signup-nick') } }
    });
    if (error) authErr(error.message);
    else authErr('✅ Check your email to confirm your account!');
  });

  on('#btn-skip','click', enterGuestMode);
  on('#fn-guest-signin','click', showAuth);
  on('#fn-auth-btn','click', () => { if(currentUser) {} else showAuth(); });
  on('#fn-signout-btn','click', () => sb.auth.signOut());

  // ── Notes ──
  on('#btn-new-note','click', () => {
    currentNote = { title:'', content:'', tag:null };
    renderEditor(); renderNotesList();
    qs('#note-title-input')?.focus();
  });
  on('#btn-save-note','click', saveNote);
  on('#btn-del-note','click', () => currentNote?.id && deleteNote(currentNote.id));
  on('#note-title-input','input', e => { if(currentNote) currentNote.title = e.target.value; });
  on('#note-body','input', e => { if(currentNote) currentNote.content = e.target.value; });

  // Note tag chips (editor)
  qsAll('[data-notetag]').forEach(btn => btn.addEventListener('click', () => {
    if (!currentNote) return;
    currentNote.tag = currentNote.tag === btn.dataset.notetag ? null : btn.dataset.notetag;
    qsAll('[data-notetag]').forEach(b =>
      b.classList.toggle('active', b.dataset.notetag === currentNote.tag));
  }));

  // Filter chips
  qsAll('[data-tag]').forEach(btn => btn.addEventListener('click', () => {
    activeTag = btn.dataset.tag === 'all' ? null : btn.dataset.tag;
    qsAll('[data-tag]').forEach(b =>
      b.classList.toggle('active', b.dataset.tag === (activeTag||'all')));
    renderNotesList();
  }));

  // ── Todos ──
  on('#btn-add-todo','click', addTodoFromInput);
  on('#fn-todo-input','keydown', e => { if(e.key==='Enter') addTodoFromInput(); });

  // ── Calendar ──
  on('#btn-cal-prev','click',  () => { todayOffset--; renderCalendar(); });
  on('#btn-cal-next','click',  () => { todayOffset++; renderCalendar(); });
  on('#btn-cal-today','click', () => { todayOffset=0; renderCalendar(); });
  on('#btn-new-event','click', () => {
    // Set today's date as default
    const d = new Date(); d.setDate(d.getDate()+todayOffset);
    const iso = d.toISOString().split('T')[0];
    qs('#ev-date').value = iso;
    qs('#fn-event-modal').classList.add('open');
  });
  on('#btn-cancel-event','click', () => qs('#fn-event-modal').classList.remove('open'));
  on('#fn-event-modal','click', e => {
    if (e.target === qs('#fn-event-modal')) qs('#fn-event-modal').classList.remove('open');
  });
  on('#btn-save-event','click', saveCalEvent);

  // ── Settings ──
  on('#fn-toggle-theme','change', async e => {
    lightMode = !e.target.checked; applyTheme();
    await saveSetting('lightmode', lightMode);
  });
  on('#fn-toggle-sound','change',     e => saveSetting('sound', e.target.checked));
  on('#fn-toggle-vibration','change', e => saveSetting('vibration', e.target.checked));
  on('#fn-toggle-reminder','change',  e => saveSetting('reminder', e.target.checked));
  on('#fn-toggle-motivation','change',e => saveSetting('motivation', e.target.checked));
  on('#btn-export','click', exportData);
  on('#btn-reset-streak','click', async () => {
    if(!confirm('Reset your streak? Cannot be undone.')) return;
    await sb.from('profiles').update({streak_count:0,streak_last_active:null}).eq('id',currentUser.id);
    await loadProfile(); renderStreak(); toast('Streak reset.');
  });

  // Enter key on auth inputs
  on('#fn-login-pw','keydown', e => { if(e.key==='Enter') qs('#btn-login')?.click(); });
  on('#fn-signup-pw','keydown', e => { if(e.key==='Enter') qs('#btn-signup')?.click(); });
}

// ═══════════════════════════════════════════════════════════════
// 4. SIDEBAR & NAVIGATION
// ═══════════════════════════════════════════════════════════════
function toggleSidebar() {
  qs('#fn-sidebar').classList.toggle('open');
  qs('#fn-overlay').classList.toggle('show');
}
function closeSidebar() {
  qs('#fn-sidebar').classList.remove('open');
  qs('#fn-overlay').classList.remove('show');
}
function switchSection(section) {
  qsAll('.fn-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === section));
  qsAll('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  const titles = { notes:'📝 Notes', todos:'✓ To-Do', calendar:'📅 Calendar', settings:'⚙ Settings' };
  const tb = qs('#fn-topbar-title');
  if (tb) tb.textContent = titles[section] || '';
  if (window.innerWidth < 900) closeSidebar();
}

// ═══════════════════════════════════════════════════════════════
// 5. AUTH
// ═══════════════════════════════════════════════════════════════
function showAuth() {
  qs('#fn-auth-overlay').classList.add('open');
}
function hideAuth() {
  qs('#fn-auth-overlay').classList.remove('open');
}
function authErr(msg) {
  const el = qs('#fn-auth-error');
  if (el) el.textContent = msg;
}
function enterGuestMode() {
  guestMode = true;
  hideAuth();
  qs('#fn-guest-banner').classList.add('show');
  qs('#fn-auth-btn').textContent = 'Sign in';
  toast('👀 Exploring as guest — data won\'t be saved');
}
async function onSignedIn(user) {
  currentUser = user; guestMode = false;
  hideAuth();
  qs('#fn-guest-banner').classList.remove('show');
  qs('#fn-auth-btn').textContent = '✓ ' + (user.email?.split('@')[0] || 'Signed in');
  await loadProfile();
  await Promise.all([loadNotes(), loadTodos(), loadCalEvents()]);
  renderAll();
  try { await sb.rpc('increment_streak', { uid: user.id }); } catch(e) {}
  await loadProfile(); renderStreak();
}
function onSignedOut() {
  currentUser = null; profile = null;
  notes=[]; todos=[]; calEvents=[];
  qs('#fn-auth-btn').textContent = 'Sign in';
  renderAll();
  showAuth();
}

// ═══════════════════════════════════════════════════════════════
// 6. PROFILE
// ═══════════════════════════════════════════════════════════════
async function loadProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  if (data) {
    profile = data;
    lightMode = data.settings?.lightmode ?? true;
    applyTheme();
    // Sync toggles
    const s = data.settings || {};
    const toggleMap = {
      '#fn-toggle-theme': !lightMode, // inverted: checked = dark
      '#fn-toggle-sound': s.sound ?? true,
      '#fn-toggle-vibration': s.vibration ?? true,
      '#fn-toggle-reminder': s.reminder ?? true,
      '#fn-toggle-motivation': s.motivation ?? true,
    };
    // theme toggle: checked means dark
    const themeEl = qs('#fn-toggle-theme');
    if (themeEl) themeEl.checked = !lightMode;
    Object.entries(toggleMap).forEach(([sel,val]) => {
      const el = qs(sel); if(el && sel !== '#fn-toggle-theme') el.checked = val;
    });
  }
}
async function saveSetting(key, value) {
  if (!currentUser || !profile) return;
  const settings = { ...profile.settings, [key]: value };
  await sb.from('profiles').update({ settings }).eq('id', currentUser.id);
  profile.settings = settings;
}
function renderStreak() {
  const n = profile?.streak_count ?? 0;
  qs('#fn-streak-num').textContent = n;
  qs('#fn-streak-badge-num').textContent = n;
  qs('#fn-profile-streak').textContent = n;
}

// ═══════════════════════════════════════════════════════════════
// 7. NOTES
// ═══════════════════════════════════════════════════════════════
async function loadNotes() {
  if (!currentUser) return;
  const { data } = await sb.from('notes').select('*')
    .eq('user_id',currentUser.id).order('modified_at',{ascending:false});
  notes = data ?? [];
}
async function saveNote() {
  if (!currentNote) return;
  if (!currentUser) { toast('Sign in to save notes!', true); return; }
  const payload = {
    user_id: currentUser.id,
    title: currentNote.title||'',
    content: currentNote.content||'',
    tag: currentNote.tag||null,
    modified_at: new Date().toISOString()
  };
  if (currentNote.id) {
    await sb.from('notes').update(payload).eq('id',currentNote.id);
  } else {
    const { data } = await sb.from('notes').insert(payload).select().single();
    if (data) currentNote.id = data.id;
  }
  await loadNotes(); renderNotesList(); toast('✓ Note saved');
}
async function deleteNote(id) {
  if (!currentUser) return;
  await sb.from('notes').delete().eq('id',id);
  currentNote = null; await loadNotes(); renderNotesList(); renderEditor();
  toast('Note deleted');
}
function renderNotesList() {
  const list = qs('#fn-notes-list'); if (!list) return;
  const filtered = activeTag ? notes.filter(n=>n.tag===activeTag) : notes;
  const cnt = qs('#sb-notes-count'); if(cnt) cnt.textContent = notes.length;
  if (!filtered.length) {
    list.innerHTML = `<div class="fn-empty"><div class="fn-empty-icon">📝</div>
      <div class="fn-empty-text">No notes yet — hit ＋ New</div></div>`; return;
  }
  list.innerHTML = filtered.map(n=>`
    <div class="note-item ${currentNote?.id===n.id?'active':''}" data-id="${n.id}">
      <div class="note-item-title">${esc(n.title||'Untitled')}</div>
      <div class="note-item-preview">${esc((n.content||'').slice(0,55))}</div>
      ${n.tag?`<div class="note-tag">● ${esc(n.tag)}</div>`:''}
    </div>`).join('');
  list.querySelectorAll('.note-item').forEach(el=>
    el.addEventListener('click',()=>{
      const n=notes.find(x=>x.id==el.dataset.id);
      if(n){currentNote={...n};renderNotesList();renderEditor();}
    }));
}
function renderEditor() {
  const ti = qs('#note-title-input'), body = qs('#note-body');
  const del = qs('#btn-del-note');
  if (!currentNote) {
    if(ti) ti.value=''; if(body) body.value='';
    if(del) del.style.display='none'; return;
  }
  if(ti) ti.value=currentNote.title||'';
  if(body) body.value=currentNote.content||'';
  if(del) del.style.display='';
  qsAll('[data-notetag]').forEach(b=>
    b.classList.toggle('active',b.dataset.notetag===currentNote.tag));
}

// ═══════════════════════════════════════════════════════════════
// 8. TODOS
// ═══════════════════════════════════════════════════════════════
async function loadTodos() {
  if (!currentUser) return;
  const { data } = await sb.from('todos').select('*')
    .eq('user_id',currentUser.id).order('created_at',{ascending:false});
  todos = data ?? [];
}
function addTodoFromInput() {
  const inp = qs('#fn-todo-input'), pri = qs('#fn-todo-priority')?.value||'med';
  const text = inp?.value?.trim();
  if (!text) return;
  addTodo(text, pri);
  inp.value = '';
}
async function addTodo(text, priority) {
  if (!currentUser) { toast('Sign in to save tasks!', true); return; }
  await sb.from('todos').insert({user_id:currentUser.id,text,priority});
  await loadTodos(); renderTodos();
}
async function toggleTodo(id) {
  const t = todos.find(x=>x.id===id); if(!t) return;
  await sb.from('todos').update({
    done:!t.done, done_at:!t.done?new Date().toISOString():null
  }).eq('id',id);
  if (!t.done) playDone();
  await loadTodos(); renderTodos();
}
async function deleteTodo(id) {
  await sb.from('todos').delete().eq('id',id);
  await loadTodos(); renderTodos();
}
function renderTodos() {
  const list = qs('#fn-todos-list'); if(!list) return;
  const open = todos.filter(t=>!t.done), done = todos.filter(t=>t.done);
  const pct = todos.length ? Math.round(done.length/todos.length*100) : 0;
  const cnt = qs('#sb-todos-count'); if(cnt) cnt.textContent=open.length;
  const pctEl = qs('#fn-progress-pct'); if(pctEl) pctEl.textContent=pct+'%';
  const bar = qs('#fn-progress-fill'); if(bar) bar.style.width=pct+'%';
  const frog = todos.find(t=>t.priority==='frog'&&!t.done);
  const frogEl = qs('#fn-frog-text');
  if(frogEl) frogEl.textContent = frog ? frog.text : 'No frog set — add one below!';
  if(!todos.length){
    list.innerHTML=`<div class="fn-empty"><div class="fn-empty-icon">✓</div>
      <div class="fn-empty-text">All clear! Add a task above.</div></div>`; return;
  }
  list.innerHTML=[...open,...done].map(t=>`
    <div class="todo-item ${t.done?'done':''}">
      <div class="todo-check" data-id="${t.id}">${t.done?'✓':''}</div>
      <span class="todo-text">${esc(t.text)}</span>
      ${t.priority==='frog'?'<span class="frog-tag">🐸 Frog</span>':''}
      ${t.priority==='high'?'<span class="frog-tag" style="background:rgba(239,68,68,.1);color:#dc2626;">🔴</span>':''}
      <span class="todo-del" data-id="${t.id}">✕</span>
    </div>`).join('');
  list.querySelectorAll('.todo-check').forEach(el=>
    el.addEventListener('click',()=>toggleTodo(Number(el.dataset.id))));
  list.querySelectorAll('.todo-del').forEach(el=>
    el.addEventListener('click',()=>deleteTodo(Number(el.dataset.id))));
}

// ═══════════════════════════════════════════════════════════════
// 9. CALENDAR
// ═══════════════════════════════════════════════════════════════
async function loadCalEvents() {
  if (!currentUser) return;
  const { data } = await sb.from('cal_events').select('*')
    .eq('user_id',currentUser.id).order('event_date',{ascending:true});
  calEvents = data ?? [];
}
async function saveCalEvent() {
  const title = val('#ev-title'), date = val('#ev-date');
  if (!title||!date) { toast('Title and date required',true); return; }
  if (!currentUser) { toast('Sign in to save events!',true); return; }
  const toH = t => { if(!t) return null; const [h,m]=t.split(':').map(Number); return h+m/60; };
  await sb.from('cal_events').insert({
    user_id:currentUser.id, title, event_date:date,
    start_hour:toH(val('#ev-start')), end_hour:toH(val('#ev-end')), color:'blue'
  });
  await loadCalEvents(); renderCalendar();
  qs('#fn-event-modal').classList.remove('open');
  ['#ev-title','#ev-start','#ev-end'].forEach(s=>{const el=qs(s);if(el)el.value='';});
  toast('✓ Event saved');
}
async function deleteCalEvent(id) {
  await sb.from('cal_events').delete().eq('id',id);
  await loadCalEvents(); renderCalendar();
}
function renderCalendar() {
  const list = qs('#fn-cal-events'); if(!list) return;
  const d = new Date(); d.setDate(d.getDate()+todayOffset);
  const dateStr = d.toISOString().split('T')[0];
  const label = qs('#fn-cal-date');
  if(label) label.textContent = d.toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'});
  const todayEvs = calEvents.filter(e=>e.event_date===dateStr);
  list.innerHTML = !todayEvs.length
    ? `<div class="fn-empty"><div class="fn-empty-icon">📅</div>
        <div class="fn-empty-text">No events today</div></div>`
    : todayEvs.map(e=>`
        <div class="cal-event">
          <div class="cal-event-title">${esc(e.title)}</div>
          ${e.start_hour!=null?`<div class="cal-event-time">${fmtH(e.start_hour)}–${fmtH(e.end_hour)}</div>`:''}
          <span class="cal-event-del" data-id="${e.id}">✕</span>
        </div>`).join('');
  list.querySelectorAll('.cal-event-del').forEach(el=>
    el.addEventListener('click',()=>deleteCalEvent(Number(el.dataset.id))));
  const up = qs('#fn-cal-upcoming');
  if(up){
    const upcoming = calEvents.filter(e=>e.event_date>dateStr).slice(0,5);
    up.innerHTML = !upcoming.length
      ? '<div class="fn-empty" style="padding:16px 0;"><div class="fn-empty-text">No upcoming events</div></div>'
      : upcoming.map(e=>`
          <div class="upcoming-row">
            <span>${esc(e.title)}</span>
            <span style="color:var(--text3);">${e.event_date}</span>
          </div>`).join('');
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. SETTINGS
// ═══════════════════════════════════════════════════════════════
function renderSettingsProfile() {
  const el = qs('#fn-profile-name');
  if(el) el.textContent = profile?.name || currentUser?.email || (guestMode?'Guest':'—');
}
function exportData() {
  const blob = new Blob([JSON.stringify({notes,todos,calEvents},null,2)],{type:'application/json'});
  Object.assign(document.createElement('a'),
    {href:URL.createObjectURL(blob),download:'flownote-export.json'}).click();
}

// ═══════════════════════════════════════════════════════════════
// 11. RENDER ALL
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  renderStreak(); renderNotesList(); renderEditor();
  renderTodos(); renderCalendar(); renderSettingsProfile();
}

// ═══════════════════════════════════════════════════════════════
// 12. UTILITIES
// ═══════════════════════════════════════════════════════════════
function applyTheme() { document.body.classList.toggle('dark',!lightMode); }

function playDone() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.frequency.setValueAtTime(660,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.08);
    g.gain.setValueAtTime(0.25,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.35);
    o.start();o.stop(ctx.currentTime+0.35);
  } catch(e){}
}

function toast(msg, isErr=false) {
  const t = qs('#fn-toast'); if(!t) return;
  t.textContent = msg;
  t.style.background = isErr ? '#ef4444' : '#18181b';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.remove('show'), 2800);
}

function fmtH(h) {
  if(h==null) return '';
  const hh=Math.floor(h),mm=Math.round((h-hh)*60);
  return `${hh%12||12}:${mm.toString().padStart(2,'0')} ${hh>=12?'PM':'AM'}`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
applyTheme();
buildShell();
wireListeners();
switchSection('notes');
renderCalendar();
renderTodos();

// Check session
const { data: { session } } = await sb.auth.getSession();
if (session) {
  await onSignedIn(session.user);
} else {
  showAuth();
}

sb.auth.onAuthStateChange(async (event, session) => {
  if (event==='SIGNED_IN' && session && !currentUser) await onSignedIn(session.user);
  if (event==='SIGNED_OUT') onSignedOut();
});

})();
