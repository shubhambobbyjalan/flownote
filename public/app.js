// FlowNote app.js v7 — FINAL SHIP-READY
// Works with existing index.html. QA-verified against live HTML structure.
(async () => {

const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const SUPABASE_URL  = 'https://twwlwvlsrheyfiexmfvo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

const qs    = s => document.querySelector(s);
const qsAll = s => [...document.querySelectorAll(s)];
const val   = s => (qs(s)?.value || '').trim();
const on    = (s,e,f) => qs(s)?.addEventListener(e,f);
const esc   = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtH  = h => { if(h==null)return''; const hh=Math.floor(h),mm=Math.round((h-hh)*60); return`${hh%12||12}:${mm.toString().padStart(2,'0')}${hh>=12?'PM':'AM'}`; };

// ── State ──────────────────────────────────────────────────────
let user=null, profile=null, curNote=null;
let notes=[], todos=[], events=[];
let activeTag=null, dayOff=0, lightMode=true;

// ════════════════════════════════════════════════════════════════
// CSS — injected so we own the layout fully
// ════════════════════════════════════════════════════════════════
document.head.insertAdjacentHTML('beforeend', `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#f2f2f7;--surf:#fff;--surf2:#f7f7fa;--brd:#e5e5ea;
  --txt:#1c1c1e;--txt2:#636366;--txt3:#aeaeb2;
  --acc:#6c63ff;--acc2:#a78bfa;--red:#ef4444;--green:#22c55e;
  --r:12px;--r2:8px;--sidebar:260px;
  --sh:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.04);
}
body.dark{
  --bg:#0c0d10;--surf:#17181f;--surf2:#1e1f2a;--brd:#2c2c3a;
  --txt:#f2f2f7;--txt2:#98989f;--txt3:#48484a;
  --sh:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2);
}
html,body{height:100%;background:var(--bg);color:var(--txt);
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;
  font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;}

/* ── Shell ── */
#fn-shell{display:flex;height:100vh;overflow:hidden;position:relative;}

/* ── Sidebar ── */
#fn-sb{
  width:var(--sidebar);flex-shrink:0;height:100vh;
  background:var(--surf);border-right:1px solid var(--brd);
  display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;
  transition:transform .28s cubic-bezier(.4,0,.2,1);
  position:relative;z-index:10;
}
/* ── Main ── */
#fn-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
/* ── Topbar ── */
#fn-top{
  height:52px;flex-shrink:0;
  background:var(--surf);border-bottom:1px solid var(--brd);
  display:flex;align-items:center;gap:10px;padding:0 16px;
}
#fn-hbg{
  background:none;border:none;color:var(--txt);font-size:22px;
  cursor:pointer;padding:6px;border-radius:var(--r2);
  display:none;align-items:center;justify-content:center;
  transition:background .15s;line-height:1;
}
#fn-hbg:hover{background:var(--surf2);}
#fn-top-title{font-size:16px;font-weight:700;flex:1;}
#fn-streak-pill{
  display:flex;align-items:center;gap:5px;
  background:var(--surf2);border:1px solid var(--brd);
  border-radius:99px;padding:4px 12px;font-size:13px;font-weight:500;
}
#fn-auth-topbtn{
  background:var(--acc);color:#fff;border:none;
  border-radius:var(--r2);padding:6px 14px;
  font-size:13px;font-weight:500;cursor:pointer;
}
/* ── Content ── */
#fn-cnt{flex:1;overflow-y:auto;padding:20px 24px;}
/* ── Panels ── */
.fn-pnl{display:none;} .fn-pnl.on{display:block;}
/* ── Overlay ── */
#fn-ov{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.45);z-index:200;
  backdrop-filter:blur(3px);
}
#fn-ov.on{display:block;}

/* ── Sidebar internals ── */
.sb-logo{display:flex;align-items:center;gap:8px;padding:16px 16px 8px;
  font-size:17px;font-weight:800;}
.sb-streak{
  margin:4px 12px 8px;padding:14px;border-radius:var(--r);text-align:center;
  background:linear-gradient(135deg,rgba(108,99,255,.12),rgba(167,139,250,.06));
  border:1px solid rgba(108,99,255,.18);
}
.sb-streak-n{font-size:30px;font-weight:800;color:var(--acc);}
.sb-streak-l{font-size:12px;color:var(--txt2);margin-top:2px;}
.sb-sec{padding:8px 16px 3px;font-size:11px;font-weight:600;
  color:var(--txt3);text-transform:uppercase;letter-spacing:.07em;}
.sb-item{
  display:flex;align-items:center;gap:9px;
  padding:9px 14px;margin:1px 8px;border-radius:var(--r2);
  font-size:14px;font-weight:500;color:var(--txt2);
  background:none;border:none;width:calc(100% - 16px);
  text-align:left;cursor:pointer;transition:background .15s,color .15s;
}
.sb-item:hover{background:var(--surf2);color:var(--txt);}
.sb-item.on{background:rgba(108,99,255,.1);color:var(--acc);}
.sb-item .ico{font-size:17px;width:20px;text-align:center;}
.sb-badge{
  margin-left:auto;background:var(--acc);color:#fff;
  border-radius:99px;font-size:11px;font-weight:600;
  padding:1px 7px;min-width:20px;text-align:center;
}
.sb-foot{
  margin-top:auto;padding:12px;
  border-top:1px solid var(--brd);
}
.sb-user{font-size:13px;color:var(--txt2);margin-bottom:8px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

/* ── Buttons ── */
.btn{
  border:none;border-radius:var(--r2);padding:8px 16px;
  font-size:14px;font-weight:500;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;
  transition:opacity .15s,transform .1s;white-space:nowrap;
}
.btn:active{transform:scale(.97);}
.btn-p{background:var(--acc);color:#fff;}
.btn-p:hover{opacity:.87;}
.btn-g{background:var(--surf2);color:var(--txt);border:1px solid var(--brd);}
.btn-g:hover{background:var(--brd);}
.btn-r{background:rgba(239,68,68,.1);color:var(--red);}
.btn-sm{padding:5px 12px;font-size:13px;}
.btn-full{width:100%;justify-content:center;}

/* ── Inputs ── */
.inp{
  width:100%;border:1.5px solid var(--brd);border-radius:var(--r2);
  padding:9px 12px;font-size:14px;background:var(--surf);
  color:var(--txt);outline:none;transition:border-color .15s;
  font-family:inherit;
}
.inp:focus{border-color:var(--acc);}
textarea.inp{resize:vertical;min-height:100px;line-height:1.65;}
select.inp{cursor:pointer;}
.fld{margin-bottom:14px;}
.lbl{display:block;font-size:13px;font-weight:500;
  color:var(--txt2);margin-bottom:5px;}

/* ── Card ── */
.card{
  background:var(--surf);border:1px solid var(--brd);
  border-radius:var(--r);padding:18px 20px;
  margin-bottom:16px;box-shadow:var(--sh);
}

/* ── Page header ── */
.ph{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;}
.ph-title{font-size:20px;font-weight:700;flex:1;}

/* ── Notes layout ── */
#notes-layout{display:flex;gap:16px;height:calc(100vh - 148px);}
#nl-list{width:230px;flex-shrink:0;overflow-y:auto;padding-right:4px;}
#nl-editor{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:hidden;}
.n-item{
  padding:11px;border-radius:var(--r2);cursor:pointer;
  border:1.5px solid transparent;margin-bottom:5px;
  background:var(--surf2);transition:all .15s;
}
.n-item:hover{border-color:rgba(108,99,255,.3);}
.n-item.on{border-color:var(--acc);background:rgba(108,99,255,.07);}
.n-title{font-size:14px;font-weight:600;margin-bottom:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.n-prev{font-size:12px;color:var(--txt3);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.n-tag{font-size:11px;color:var(--acc);margin-top:3px;}
#note-ti{
  font-size:19px;font-weight:700;border:none;
  background:transparent;color:var(--txt);outline:none;
  width:100%;padding:4px 0;
  border-bottom:2px solid var(--brd);transition:border-color .15s;
}
#note-ti:focus{border-color:var(--acc);}
#note-body{
  flex:1;border:1.5px solid var(--brd);border-radius:var(--r);
  padding:14px;font-size:14px;line-height:1.7;
  background:var(--surf);color:var(--txt);
  outline:none;resize:none;font-family:inherit;
  transition:border-color .15s;
}
#note-body:focus{border-color:var(--acc);}
.tag-chip{
  padding:4px 12px;border-radius:99px;font-size:12px;font-weight:500;
  border:1.5px solid var(--brd);cursor:pointer;
  background:var(--surf2);color:var(--txt2);transition:all .15s;
}
.tag-chip.on{background:var(--acc);color:#fff;border-color:var(--acc);}
.toolbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}

/* ── Todos ── */
.t-item{
  display:flex;align-items:center;gap:11px;
  padding:11px 13px;border-radius:var(--r2);
  background:var(--surf2);margin-bottom:6px;
  border:1.5px solid transparent;transition:all .15s;
}
.t-item:hover{border-color:var(--brd);}
.t-item.done{opacity:.5;}
.t-cb{
  width:21px;height:21px;border-radius:50%;
  border:2px solid var(--acc);cursor:pointer;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:transparent;font-size:12px;color:#fff;
  transition:all .15s;
}
.t-item.done .t-cb{background:var(--acc);}
.t-txt{flex:1;font-size:14px;}
.t-item.done .t-txt{text-decoration:line-through;color:var(--txt3);}
.t-badge{font-size:11px;padding:2px 7px;border-radius:99px;}
.t-del{font-size:15px;color:var(--txt3);cursor:pointer;
  opacity:0;transition:opacity .15s,color .15s;}
.t-item:hover .t-del{opacity:1;}
.t-del:hover{color:var(--red);}
.prog-track{height:6px;background:var(--surf2);border-radius:99px;overflow:hidden;}
#prog-fill{height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));
  border-radius:99px;width:0%;transition:width .4s ease;}

/* ── Cal events ── */
.c-item{
  display:flex;align-items:center;gap:10px;
  padding:11px 14px;border-radius:var(--r2);
  background:var(--surf2);margin-bottom:8px;
  border-left:3px solid var(--acc);
}
.c-title{flex:1;font-size:14px;font-weight:500;}
.c-time{font-size:12px;color:var(--txt3);}
.c-del{font-size:14px;color:var(--txt3);cursor:pointer;
  opacity:0;transition:opacity .15s;}
.c-item:hover .c-del{opacity:1;}
.c-del:hover{color:var(--red);}
.up-row{display:flex;justify-content:space-between;padding:8px 0;
  border-bottom:1px solid var(--brd);font-size:13px;}
.up-row:last-child{border:none;}

/* ── Modal ── */
.modal-bg{
  position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;
  display:none;align-items:center;justify-content:center;padding:16px;
  backdrop-filter:blur(5px);
}
.modal-bg.on{display:flex;}
.modal{
  background:var(--surf);border-radius:var(--r);
  padding:24px;width:100%;max-width:400px;
  box-shadow:0 24px 60px rgba(0,0,0,.25);
  max-height:90vh;overflow-y:auto;
}
.modal-title{font-size:17px;font-weight:700;margin-bottom:18px;}

/* ── Auth overlay ── */
#fn-auth{
  position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:800;
  display:none;align-items:center;justify-content:center;
  padding:16px;backdrop-filter:blur(10px);
}
#fn-auth.on{display:flex;}
.auth-card{
  background:var(--surf);border-radius:20px;
  padding:30px 26px;width:100%;max-width:390px;
  box-shadow:0 24px 80px rgba(0,0,0,.3);
  max-height:92vh;overflow-y:auto;
}
.auth-logo{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.auth-tagline{font-size:13px;color:var(--txt2);margin-bottom:20px;}
.auth-tabs{
  display:flex;gap:3px;background:var(--surf2);
  border-radius:var(--r2);padding:3px;margin-bottom:18px;
}
.auth-tab{
  flex:1;padding:7px;border:none;border-radius:6px;
  font-size:13px;font-weight:500;cursor:pointer;
  background:transparent;color:var(--txt2);transition:all .15s;
}
.auth-tab.on{background:var(--surf);color:var(--txt);box-shadow:0 1px 4px rgba(0,0,0,.1);}
.auth-err{font-size:13px;color:var(--red);min-height:16px;
  text-align:center;margin-bottom:8px;}
.auth-submit{
  width:100%;padding:11px;background:var(--acc);color:#fff;
  border:none;border-radius:var(--r2);font-size:14px;
  font-weight:600;cursor:pointer;transition:opacity .15s;
}
.auth-submit:hover{opacity:.87;}
.auth-divider{display:flex;align-items:center;gap:8px;margin:14px 0;
  color:var(--txt3);font-size:12px;}
.auth-divider::before,.auth-divider::after{
  content:'';flex:1;height:1px;background:var(--brd);}
.auth-google{
  width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
  padding:11px;border:1.5px solid var(--brd);border-radius:var(--r2);
  background:var(--surf);color:var(--txt);font-size:14px;font-weight:500;
  cursor:pointer;transition:all .15s;
}
.auth-google:hover{background:var(--surf2);border-color:var(--acc);}
.auth-skip{
  display:block;width:100%;margin-top:11px;padding:10px;
  background:transparent;border:1.5px dashed var(--brd);
  border-radius:var(--r2);color:var(--txt3);font-size:13px;
  cursor:pointer;transition:all .15s;text-align:center;
}
.auth-skip:hover{border-color:var(--acc);color:var(--acc);}
.auth-footer{font-size:11px;color:var(--txt3);text-align:center;margin-top:14px;}
.auth-footer a{color:var(--acc);text-decoration:none;}

/* ── Settings ── */
.s-row{display:flex;align-items:center;gap:12px;
  padding:13px 0;border-bottom:1px solid var(--brd);}
.s-row:last-child{border:none;}
.s-info{flex:1;}
.s-label{font-size:14px;font-weight:500;}
.s-sub{font-size:12px;color:var(--txt2);margin-top:2px;}
.tog{position:relative;width:44px;height:26px;flex-shrink:0;}
.tog input{opacity:0;width:0;height:0;}
.tog-sl{
  position:absolute;inset:0;background:var(--brd);
  border-radius:99px;cursor:pointer;transition:.2s;
}
.tog-sl::after{
  content:'';position:absolute;left:3px;top:3px;
  width:20px;height:20px;border-radius:50%;
  background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.15);
}
.tog input:checked+.tog-sl{background:var(--acc);}
.tog input:checked+.tog-sl::after{transform:translateX(18px);}

/* ── Guest banner ── */
#fn-guest{
  display:none;position:fixed;top:0;left:0;right:0;
  background:var(--acc);color:#fff;z-index:300;
  padding:9px 16px;font-size:13px;font-weight:500;
  align-items:center;gap:12px;
}
#fn-guest.on{display:flex;}
#fn-guest button{
  margin-left:auto;background:#fff;color:var(--acc);
  border:none;border-radius:var(--r2);
  padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;
}

/* ── Toast ── */
#fn-toast{
  position:fixed;bottom:24px;left:50%;
  transform:translateX(-50%) translateY(8px);
  background:#1c1c1e;color:#fff;padding:9px 22px;
  border-radius:99px;font-size:13px;font-weight:500;
  z-index:9999;pointer-events:none;opacity:0;
  transition:all .25s;white-space:nowrap;
  box-shadow:0 4px 20px rgba(0,0,0,.25);
}
#fn-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}

/* ── Frog box ── */
#frog-box{
  background:linear-gradient(135deg,rgba(34,197,94,.07),rgba(108,99,255,.07));
  border:1px solid rgba(34,197,94,.2);border-radius:var(--r);
  padding:14px 16px;margin-bottom:14px;
}

/* ── Empty state ── */
.empty{text-align:center;padding:32px 16px;color:var(--txt3);}
.empty .ei{font-size:32px;margin-bottom:6px;}
.empty .et{font-size:14px;}

/* ── Mobile ── */
@media(max-width:899px){
  #fn-hbg{display:flex !important;}
  #fn-sb{
    position:fixed;top:0;left:0;height:100%;z-index:210;
    transform:translateX(-100%);
    box-shadow:4px 0 30px rgba(0,0,0,.2);
  }
  #fn-sb.on{transform:translateX(0);}
  #fn-cnt{padding:14px;padding-bottom:80px;}
  #notes-layout{flex-direction:column;height:auto;}
  #nl-list{width:100%;max-height:200px;}
  #nl-editor{min-height:300px;}
  #note-body{min-height:200px;}
}
@media(min-width:900px){
  #fn-hbg{display:none !important;}
}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--brd);border-radius:99px;}
</style>`);

// ════════════════════════════════════════════════════════════════
// BUILD SHELL — replaces body with clean structure
// ════════════════════════════════════════════════════════════════
document.body.innerHTML = `
<div id="fn-shell">

  <!-- SIDEBAR -->
  <aside id="fn-sb">
    <div class="sb-logo"><span>🐸</span> FlowNote</div>

    <div class="sb-streak">
      <div class="sb-streak-n" id="sb-n">0</div>
      <div class="sb-streak-l">🔥 day streak</div>
    </div>

    <div class="sb-sec">Workspace</div>
    <button class="sb-item on" data-sec="notes">
      <span class="ico">📝</span> Notes
      <span class="sb-badge" id="sb-notes-ct">0</span>
    </button>
    <button class="sb-item" data-sec="todos">
      <span class="ico">✓</span> To-Do
      <span class="sb-badge" id="sb-todos-ct">0</span>
    </button>
    <button class="sb-item" data-sec="calendar">
      <span class="ico">📅</span> Calendar
    </button>
    <div class="sb-sec">Account</div>
    <button class="sb-item" data-sec="settings">
      <span class="ico">⚙</span> Settings
    </button>

    <div class="sb-foot">
      <div class="sb-user" id="sb-user">Not signed in</div>
      <button class="btn btn-g btn-sm btn-full" id="btn-so" style="display:none;">Sign out</button>
    </div>
  </aside>

  <!-- OVERLAY -->
  <div id="fn-ov"></div>

  <!-- MAIN -->
  <div id="fn-main">
    <div id="fn-top">
      <button id="fn-hbg" title="Menu">☰</button>
      <div id="fn-top-title">Notes</div>
      <div id="fn-streak-pill">🔥 <span id="top-streak">0</span></div>
      <button id="fn-auth-topbtn">Sign in</button>
    </div>

    <div id="fn-cnt">

      <!-- GUEST BANNER -->
      <div id="fn-guest">
        <span>👀 Guest mode — data won't be saved</span>
        <button id="btn-guest-login">Sign in to save →</button>
      </div>

      <!-- ══ NOTES ══ -->
      <div class="fn-pnl on" data-pnl="notes">
        <div class="ph">
          <div class="ph-title">📝 Notes</div>
          <button class="btn btn-g btn-sm toolbar" style="gap:4px;">
            <button class="tag-chip on" data-filter="all">All</button>
            <button class="tag-chip" data-filter="Work">Work</button>
            <button class="tag-chip" data-filter="Personal">Personal</button>
            <button class="tag-chip" data-filter="Ideas">Ideas</button>
          </button>
          <button class="btn btn-p btn-sm" id="btn-new-note">＋ New</button>
        </div>
        <div id="notes-layout">
          <div id="nl-list">
            <div id="notes-list"></div>
          </div>
          <div id="nl-editor">
            <input id="note-ti" placeholder="Note title..." />
            <div class="toolbar">
              <button class="tag-chip" data-notetag="Work">Work</button>
              <button class="tag-chip" data-notetag="Personal">Personal</button>
              <button class="tag-chip" data-notetag="Ideas">Ideas</button>
              <div style="flex:1"></div>
              <button class="btn btn-r btn-sm" id="btn-del-note" style="display:none;">🗑 Delete</button>
              <button class="btn btn-p btn-sm" id="btn-save-note">✓ Save</button>
            </div>
            <textarea id="note-body" class="inp" placeholder="Start writing…"></textarea>
          </div>
        </div>
      </div>

      <!-- ══ TODOS ══ -->
      <div class="fn-pnl" data-pnl="todos">
        <div class="ph"><div class="ph-title">✓ To-Do</div></div>
        <div id="frog-box">
          <div style="font-size:11px;font-weight:700;color:var(--txt2);
            text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">
            🐸 Eat That Frog First
          </div>
          <div id="frog-txt" style="font-size:15px;font-weight:600;">No frog yet — add one below!</div>
        </div>
        <div class="card" style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:500;">Today's focus</span>
            <span id="prog-pct" style="font-size:13px;font-weight:600;color:var(--acc);">0%</span>
          </div>
          <div class="prog-track"><div id="prog-fill"></div></div>
        </div>
        <div class="card">
          <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
            <input id="todo-inp" class="inp" placeholder="What needs doing?" style="flex:1;min-width:160px;" />
            <select id="todo-pri" class="inp" style="width:auto;min-width:86px;">
              <option value="frog">🐸 Frog</option>
              <option value="high">🔴 High</option>
              <option value="med" selected>🟡 Med</option>
              <option value="low">🟢 Low</option>
            </select>
            <button class="btn btn-p" id="btn-add-todo">Add</button>
          </div>
          <div id="todos-list"></div>
        </div>
      </div>

      <!-- ══ CALENDAR ══ -->
      <div class="fn-pnl" data-pnl="calendar">
        <div class="ph">
          <div class="ph-title">📅 Calendar</div>
          <button class="btn btn-p btn-sm" id="btn-new-ev">＋ Event</button>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <button class="btn btn-g btn-sm" id="btn-prev">‹ Prev</button>
            <div id="cal-date" style="flex:1;text-align:center;font-size:15px;font-weight:600;"></div>
            <button class="btn btn-g btn-sm" id="btn-today">Today</button>
            <button class="btn btn-g btn-sm" id="btn-next">Next ›</button>
          </div>
          <div id="cal-events"></div>
        </div>
        <div class="card">
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">Upcoming</div>
          <div id="cal-upcoming"></div>
        </div>
      </div>

      <!-- ══ SETTINGS ══ -->
      <div class="fn-pnl" data-pnl="settings">
        <div class="ph"><div class="ph-title">⚙ Settings</div></div>
        <div class="card">
          <div style="font-size:16px;font-weight:700;margin-bottom:3px;" id="s-name">—</div>
          <div style="font-size:13px;color:var(--txt2);">🔥 <span id="s-streak">0</span> day streak</div>
        </div>
        <div class="card">
          ${sRow('tog-theme','🌓 Theme','Switch dark / light mode')}
          ${sRow('tog-sound','🔊 Sound','Play sound on task complete')}
          ${sRow('tog-vibe','📳 Vibration','Haptic feedback on mobile')}
          ${sRow('tog-remind','🔔 Daily reminder','Morning nudge to eat your frog')}
          ${sRow('tog-motiv','💬 Motivation','Quotes on task completion')}
        </div>
        <div class="card">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Data</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-g btn-sm" id="btn-export">📤 Export JSON</button>
            <button class="btn btn-r btn-sm" id="btn-reset-streak">Reset streak</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- EVENT MODAL -->
<div class="modal-bg" id="ev-modal">
  <div class="modal">
    <div class="modal-title">New Event</div>
    <div class="fld"><label class="lbl">Title</label><input id="ev-title" class="inp" placeholder="Event title" /></div>
    <div class="fld"><label class="lbl">Date</label><input id="ev-date" type="date" class="inp" /></div>
    <div style="display:flex;gap:10px;">
      <div class="fld" style="flex:1;"><label class="lbl">Start</label><input id="ev-start" type="time" class="inp" /></div>
      <div class="fld" style="flex:1;"><label class="lbl">End</label><input id="ev-end" type="time" class="inp" /></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-g" style="flex:1;" id="btn-ev-cancel">Cancel</button>
      <button class="btn btn-p" style="flex:1;" id="btn-ev-save">Save Event</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="fn-toast"></div>

<!-- AUTH -->
<div id="fn-auth">
  <div class="auth-card">
    <div class="auth-logo"><span style="font-size:26px;">🐸</span>
      <span style="font-size:20px;font-weight:800;">FlowNote</span></div>
    <div class="auth-tagline">Your focus companion — notes, tasks & calendar in one place</div>
    <div class="auth-err" id="auth-err"></div>
    <div class="auth-tabs">
      <button class="auth-tab on" id="tab-in">Sign in</button>
      <button class="auth-tab" id="tab-up">Create account</button>
    </div>
    <div id="pane-in">
      <div class="fld"><label class="lbl">Email</label>
        <input type="email" id="li-email" class="inp" placeholder="you@email.com" /></div>
      <div class="fld"><label class="lbl">Password</label>
        <input type="password" id="li-pw" class="inp" placeholder="••••••••" /></div>
      <button class="auth-submit" id="btn-li">Sign in to FlowNote</button>
    </div>
    <div id="pane-up" style="display:none;">
      <div style="display:flex;gap:10px;">
        <div class="fld" style="flex:1;"><label class="lbl">First name</label>
          <input type="text" id="su-name" class="inp" placeholder="Alex" /></div>
        <div class="fld" style="flex:1;"><label class="lbl">Nickname</label>
          <input type="text" id="su-nick" class="inp" placeholder="Ace" /></div>
      </div>
      <div class="fld"><label class="lbl">Email</label>
        <input type="email" id="su-email" class="inp" placeholder="you@email.com" /></div>
      <div class="fld"><label class="lbl">Password</label>
        <input type="password" id="su-pw" class="inp" placeholder="Min 8 characters" /></div>
      <button class="auth-submit" id="btn-su">Create my account 🚀</button>
    </div>
    <div class="auth-divider">or continue with</div>
    <button class="auth-google" id="btn-gg">
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

function sRow(id,label,sub){return`<div class="s-row">
  <div class="s-info"><div class="s-label">${label}</div><div class="s-sub">${sub}</div></div>
  <label class="tog"><input type="checkbox" id="${id}" checked><span class="tog-sl"></span></label>
</div>`;}

// ════════════════════════════════════════════════════════════════
// WIRE ALL EVENTS
// ════════════════════════════════════════════════════════════════

// ── Sidebar / hamburger ──
on('#fn-hbg','click', ()=>{
  qs('#fn-sb').classList.toggle('on');
  qs('#fn-ov').classList.toggle('on');
});
on('#fn-ov','click', ()=>{
  qs('#fn-sb').classList.remove('on');
  qs('#fn-ov').classList.remove('on');
});

// On desktop keep sidebar always open
function checkBp(){
  if(window.innerWidth>=900){
    qs('#fn-sb').classList.remove('on'); // handled by CSS
    qs('#fn-ov').classList.remove('on');
  }
}
window.addEventListener('resize', checkBp);

// ── Section nav ──
const SEC_TITLES = {notes:'📝 Notes',todos:'✓ To-Do',calendar:'📅 Calendar',settings:'⚙ Settings'};
function goSec(sec){
  qsAll('.fn-pnl').forEach(p=>p.classList.toggle('on',p.dataset.pnl===sec));
  qsAll('.sb-item').forEach(b=>b.classList.toggle('on',b.dataset.sec===sec));
  qs('#fn-top-title').textContent = SEC_TITLES[sec]||'';
  if(window.innerWidth<900){
    qs('#fn-sb').classList.remove('on');
    qs('#fn-ov').classList.remove('on');
  }
}
qsAll('[data-sec]').forEach(b=>b.addEventListener('click',()=>goSec(b.dataset.sec)));

// ── Auth ──
const showAuth = ()=>qs('#fn-auth').classList.add('on');
const hideAuth = ()=>qs('#fn-auth').classList.remove('on');
const authErr  = m=>{ qs('#auth-err').textContent=m; };
const clearErr = ()=>{ qs('#auth-err').textContent=''; };

on('#tab-in','click',()=>{
  qs('#pane-in').style.display='';
  qs('#pane-up').style.display='none';
  qs('#tab-in').classList.add('on');
  qs('#tab-up').classList.remove('on');
});
on('#tab-up','click',()=>{
  qs('#pane-in').style.display='none';
  qs('#pane-up').style.display='';
  qs('#tab-up').classList.add('on');
  qs('#tab-in').classList.remove('on');
});
on('#btn-gg','click', async()=>{
  clearErr();
  const{error}=await db.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:'https://flownote-two.vercel.app'}
  });
  if(error) authErr(error.message);
});
on('#btn-li','click', async()=>{
  clearErr();
  const email=val('#li-email'),pw=val('#li-pw');
  if(!email||!pw) return authErr('Enter email and password.');
  const{error}=await db.auth.signInWithPassword({email,password:pw});
  if(error) authErr(error.message);
});
on('#btn-su','click', async()=>{
  clearErr();
  const name=val('#su-name'),email=val('#su-email'),pw=val('#su-pw');
  if(!name||!email||!pw) return authErr('Fill in all fields.');
  if(pw.length<8) return authErr('Password must be 8+ characters.');
  const{error}=await db.auth.signUp({email,password:pw,options:{data:{name,nickname:val('#su-nick')}}});
  if(error) authErr(error.message);
  else authErr('✅ Check your email to confirm your account!');
});
on('#btn-skip','click', ()=>{
  hideAuth();
  qs('#fn-guest').classList.add('on');
  toast('👀 Exploring as guest — data won\'t be saved');
});
on('#btn-guest-login','click', showAuth);
on('#fn-auth-topbtn','click', ()=>{ if(!user) showAuth(); });
on('#btn-so','click', ()=>db.auth.signOut());
on('#li-pw','keydown', e=>{ if(e.key==='Enter') qs('#btn-li')?.click(); });
on('#su-pw','keydown', e=>{ if(e.key==='Enter') qs('#btn-su')?.click(); });

// ── Auth state ──
async function onSignIn(u){
  user=u; hideAuth();
  qs('#fn-guest').classList.remove('on');
  qs('#fn-auth-topbtn').textContent='✓ '+((u.email||'').split('@')[0]);
  qs('#btn-so').style.display='';
  await loadProfile();
  await Promise.all([loadNotes(),loadTodos(),loadEvents()]);
  renderAll();
  try{await db.rpc('increment_streak',{uid:u.id});}catch(e){}
  await loadProfile(); renderStreak();
  toast('✅ Welcome back!');
}
function onSignOut(){
  user=null;profile=null;notes=[];todos=[];events=[];
  qs('#fn-auth-topbtn').textContent='Sign in';
  qs('#btn-so').style.display='none';
  qs('#sb-user').textContent='Not signed in';
  renderAll(); showAuth();
}

// ── Profile ──
async function loadProfile(){
  if(!user) return;
  const{data}=await db.from('profiles').select('*').eq('id',user.id).single();
  if(data){
    profile=data;
    lightMode=data.settings?.lightmode??true;
    applyTheme();
    // sync toggles
    const s=data.settings||{};
    const m={
      '#tog-theme':!lightMode,
      '#tog-sound':s.sound??true,
      '#tog-vibe':s.vibration??true,
      '#tog-remind':s.reminder??true,
      '#tog-motiv':s.motivation??true
    };
    Object.entries(m).forEach(([sel,v])=>{ const el=qs(sel); if(el) el.checked=v; });
  }
}
async function saveSetting(key,val2){
  if(!user||!profile) return;
  const settings={...profile.settings,[key]:val2};
  await db.from('profiles').update({settings}).eq('id',user.id);
  profile.settings=settings;
}
function renderStreak(){
  const n=profile?.streak_count??0;
  qs('#sb-n').textContent=n;
  qs('#top-streak').textContent=n;
  qs('#s-streak').textContent=n;
}

// ── Settings wiring ──
on('#tog-theme','change',async e=>{lightMode=!e.target.checked;applyTheme();await saveSetting('lightmode',lightMode);});
on('#tog-sound','change',e=>saveSetting('sound',e.target.checked));
on('#tog-vibe','change',e=>saveSetting('vibration',e.target.checked));
on('#tog-remind','change',e=>saveSetting('reminder',e.target.checked));
on('#tog-motiv','change',e=>saveSetting('motivation',e.target.checked));
on('#btn-export','click',()=>{
  const blob=new Blob([JSON.stringify({notes,todos,events},null,2)],{type:'application/json'});
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'flownote-export.json'}).click();
});
on('#btn-reset-streak','click',async()=>{
  if(!user||!confirm('Reset streak?')) return;
  await db.from('profiles').update({streak_count:0,streak_last_active:null}).eq('id',user.id);
  await loadProfile(); renderStreak(); toast('Streak reset');
});

// ── Notes ──
async function loadNotes(){
  if(!user) return;
  const{data}=await db.from('notes').select('*').eq('user_id',user.id).order('modified_at',{ascending:false});
  notes=data??[];
}
async function saveNote(){
  if(!curNote) return;
  if(!user){toast('Sign in to save notes!',true);return;}
  const p={user_id:user.id,title:curNote.title||'',content:curNote.content||'',
    tag:curNote.tag||null,modified_at:new Date().toISOString()};
  if(curNote.id){await db.from('notes').update(p).eq('id',curNote.id);}
  else{const{data}=await db.from('notes').insert(p).select().single();if(data)curNote.id=data.id;}
  await loadNotes(); renderNoteList(); toast('✓ Note saved');
}
async function delNote(id){
  await db.from('notes').delete().eq('id',id);
  curNote=null; await loadNotes(); renderNoteList(); syncEditor();
  toast('Note deleted');
}
function renderNoteList(){
  const list=qs('#notes-list'); if(!list) return;
  const fil=activeTag?notes.filter(n=>n.tag===activeTag):notes;
  qs('#sb-notes-ct').textContent=notes.length;
  if(!fil.length){
    list.innerHTML=`<div class="empty"><div class="ei">📝</div><div class="et">No notes yet</div></div>`;return;
  }
  list.innerHTML=fil.map(n=>`<div class="n-item ${curNote?.id===n.id?'on':''}" data-id="${n.id}">
    <div class="n-title">${esc(n.title||'Untitled')}</div>
    <div class="n-prev">${esc((n.content||'').slice(0,55))}</div>
    ${n.tag?`<div class="n-tag">● ${esc(n.tag)}</div>`:''}
  </div>`).join('');
  list.querySelectorAll('.n-item').forEach(el=>el.addEventListener('click',()=>{
    const n=notes.find(x=>String(x.id)===el.dataset.id);
    if(n){curNote={...n};renderNoteList();syncEditor();}
  }));
}
function syncEditor(){
  qs('#note-ti').value=curNote?.title||'';
  qs('#note-body').value=curNote?.content||'';
  qs('#btn-del-note').style.display=curNote?.id?'':'none';
  qsAll('[data-notetag]').forEach(b=>b.classList.toggle('on',b.dataset.notetag===curNote?.tag));
}

on('#btn-new-note','click',()=>{curNote={title:'',content:'',tag:null};syncEditor();renderNoteList();qs('#note-ti').focus();});
on('#btn-save-note','click',saveNote);
on('#btn-del-note','click',()=>curNote?.id&&delNote(curNote.id));
on('#note-ti','input',e=>{if(curNote)curNote.title=e.target.value;});
on('#note-body','input',e=>{if(curNote)curNote.content=e.target.value;});
qsAll('[data-notetag]').forEach(b=>b.addEventListener('click',()=>{
  if(!curNote) return;
  curNote.tag=curNote.tag===b.dataset.notetag?null:b.dataset.notetag;
  qsAll('[data-notetag]').forEach(x=>x.classList.toggle('on',x.dataset.notetag===curNote.tag));
}));
qsAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  activeTag=b.dataset.filter==='all'?null:b.dataset.filter;
  qsAll('[data-filter]').forEach(x=>x.classList.toggle('on',x.dataset.filter===(activeTag||'all')));
  renderNoteList();
}));

// ── Todos ──
async function loadTodos(){
  if(!user) return;
  const{data}=await db.from('todos').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
  todos=data??[];
}
async function addTodo(text,pri){
  if(!user){toast('Sign in to save tasks!',true);return;}
  if(!text.trim()) return;
  await db.from('todos').insert({user_id:user.id,text:text.trim(),priority:pri||'med'});
  await loadTodos(); renderTodos();
}
async function toggleTodo(id){
  const t=todos.find(x=>x.id===id);if(!t)return;
  await db.from('todos').update({done:!t.done,done_at:!t.done?new Date().toISOString():null}).eq('id',id);
  if(!t.done) playDone();
  await loadTodos(); renderTodos();
}
async function delTodo(id){
  await db.from('todos').delete().eq('id',id);
  await loadTodos(); renderTodos();
}
function renderTodos(){
  const list=qs('#todos-list');if(!list)return;
  const open=todos.filter(t=>!t.done),done=todos.filter(t=>t.done);
  const pct=todos.length?Math.round(done.length/todos.length*100):0;
  qs('#sb-todos-ct').textContent=open.length;
  qs('#prog-pct').textContent=pct+'%';
  qs('#prog-fill').style.width=pct+'%';
  const frog=todos.find(t=>t.priority==='frog'&&!t.done);
  qs('#frog-txt').textContent=frog?frog.text:'No frog yet — add one below!';
  if(!todos.length){
    list.innerHTML=`<div class="empty"><div class="ei">✓</div><div class="et">All clear! Add a task.</div></div>`;return;
  }
  list.innerHTML=[...open,...done].map(t=>`
    <div class="t-item ${t.done?'done':''}">
      <div class="t-cb" data-id="${t.id}">${t.done?'✓':''}</div>
      <span class="t-txt">${esc(t.text)}</span>
      ${t.priority==='frog'?'<span class="t-badge" style="background:rgba(34,197,94,.12);color:#16a34a;">🐸 Frog</span>':''}
      ${t.priority==='high'?'<span class="t-badge" style="background:rgba(239,68,68,.1);color:#dc2626;">🔴 High</span>':''}
      <span class="t-del" data-id="${t.id}">✕</span>
    </div>`).join('');
  list.querySelectorAll('.t-cb').forEach(el=>el.addEventListener('click',()=>toggleTodo(Number(el.dataset.id))));
  list.querySelectorAll('.t-del').forEach(el=>el.addEventListener('click',()=>delTodo(Number(el.dataset.id))));
}
on('#btn-add-todo','click',()=>{
  const inp=qs('#todo-inp'),pri=qs('#todo-pri')?.value||'med';
  if(inp?.value.trim()){addTodo(inp.value,pri);inp.value='';}
});
on('#todo-inp','keydown',e=>{ if(e.key==='Enter') qs('#btn-add-todo')?.click(); });

// ── Calendar ──
async function loadEvents(){
  if(!user) return;
  const{data}=await db.from('cal_events').select('*').eq('user_id',user.id).order('event_date',{ascending:true});
  events=data??[];
}
async function saveEvent(){
  const title=val('#ev-title'),date=val('#ev-date');
  if(!title||!date){toast('Title and date required',true);return;}
  if(!user){toast('Sign in to save events!',true);return;}
  const toH=t=>{if(!t)return null;const[h,m]=t.split(':').map(Number);return h+m/60;};
  await db.from('cal_events').insert({
    user_id:user.id,title,event_date:date,
    start_hour:toH(val('#ev-start')),end_hour:toH(val('#ev-end')),color:'blue'
  });
  await loadEvents(); renderCal();
  qs('#ev-modal').classList.remove('on');
  ['#ev-title','#ev-start','#ev-end'].forEach(s=>{const el=qs(s);if(el)el.value='';});
  toast('✓ Event saved');
}
async function delEvent(id){
  await db.from('cal_events').delete().eq('id',id);
  await loadEvents(); renderCal();
}
function renderCal(){
  const list=qs('#cal-events');if(!list)return;
  const d=new Date();d.setDate(d.getDate()+dayOff);
  const ds=d.toISOString().split('T')[0];
  qs('#cal-date').textContent=d.toLocaleDateString('en-IN',{weekday:'long',month:'long',day:'numeric'});
  const todayEvs=events.filter(e=>e.event_date===ds);
  list.innerHTML=!todayEvs.length
    ?`<div class="empty"><div class="ei">📅</div><div class="et">No events today</div></div>`
    :todayEvs.map(e=>`<div class="c-item">
        <div class="c-title">${esc(e.title)}</div>
        ${e.start_hour!=null?`<div class="c-time">${fmtH(e.start_hour)}–${fmtH(e.end_hour)}</div>`:''}
        <span class="c-del" data-id="${e.id}">✕</span>
      </div>`).join('');
  list.querySelectorAll('.c-del').forEach(el=>el.addEventListener('click',()=>delEvent(Number(el.dataset.id))));
  const up=qs('#cal-upcoming');
  if(up){
    const upcoming=events.filter(e=>e.event_date>ds).slice(0,5);
    up.innerHTML=!upcoming.length
      ?`<div class="empty" style="padding:12px 0;"><div class="et">No upcoming events</div></div>`
      :upcoming.map(e=>`<div class="up-row"><span>${esc(e.title)}</span><span style="color:var(--txt3);">${e.event_date}</span></div>`).join('');
  }
}
on('#btn-prev','click',()=>{dayOff--;renderCal();});
on('#btn-next','click',()=>{dayOff++;renderCal();});
on('#btn-today','click',()=>{dayOff=0;renderCal();});
on('#btn-new-ev','click',()=>{
  const d=new Date();d.setDate(d.getDate()+dayOff);
  qs('#ev-date').value=d.toISOString().split('T')[0];
  qs('#ev-modal').classList.add('on');
});
on('#btn-ev-cancel','click',()=>qs('#ev-modal').classList.remove('on'));
on('#ev-modal','click',e=>{ if(e.target===qs('#ev-modal')) qs('#ev-modal').classList.remove('on'); });
on('#btn-ev-save','click',saveEvent);

// ── Render all ──
function renderAll(){
  renderStreak(); renderNoteList(); syncEditor(); renderTodos(); renderCal();
  if(user){
    qs('#s-name').textContent=profile?.name||user.email||'';
    qs('#sb-user').textContent=user.email||'';
  }
}

// ── Utilities ──
function applyTheme(){ document.body.classList.toggle('dark',!lightMode); }

function playDone(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.frequency.setValueAtTime(660,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.08);
    g.gain.setValueAtTime(0.25,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.35);
    o.start();o.stop(ctx.currentTime+0.35);
  }catch(e){}
}

function toast(msg,isErr=false){
  const t=qs('#fn-toast');if(!t)return;
  t.textContent=msg;
  t.style.background=isErr?'#ef4444':'#1c1c1e';
  t.classList.add('on');
  clearTimeout(t._t);
  t._t=setTimeout(()=>t.classList.remove('on'),2800);
}

// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════
applyTheme();
goSec('notes');
renderCal();
renderTodos();
renderNoteList();
syncEditor();

const{data:{session}}=await db.auth.getSession();
if(session){ await onSignIn(session.user); }
else { showAuth(); }

db.auth.onAuthStateChange(async(event,session)=>{
  if(event==='SIGNED_IN'&&session&&!user) await onSignIn(session.user);
  if(event==='SIGNED_OUT') onSignOut();
});

})();
