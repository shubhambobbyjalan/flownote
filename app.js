// FlowNote — Supabase Integration Layer
// Drop this file next to index.html and add <script type="module" src="/app.js"></script>
// to the <head> of index.html AFTER your existing script tags.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── CONFIG — replace with your own values from supabase.com/dashboard ──────
const SUPABASE_URL = 'https://twwlwvlsrheyfiexmfvo.supabase.co';       // e.g. https://xyzabc.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d2x3dmxzcmhleWZpZXhtZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzc0ODQsImV4cCI6MjA5NTkxMzQ4NH0.YndWwVZaijZOtpYK8qh3keCWU0I75TH3qaK7yrAQ0IQ';  // eyJhbGci...

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ═══════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════

export async function signUp({ email, password, name, nickname }) {
  return await supabase.auth.signUp({
    email, password,
    options: { data: { name, nickname } }
  });
}

export async function signIn({ email, password }) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      scopes: 'https://www.googleapis.com/auth/calendar.readonly'
    }
  });
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Listen for auth state changes
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════════════════

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

export async function updateProfile(updates) {
  const user = await getUser();
  if (!user) return;
  return await supabase.from('profiles').update(updates).eq('id', user.id);
}

export async function syncStreak(streakObj) {
  const user = await getUser();
  if (!user) return;
  return await supabase.from('profiles').update({
    streak_count: streakObj.count,
    streak_last_active: new Date().toISOString().split('T')[0],
    settings: streakObj.settings || {}
  }).eq('id', user.id);
}

// ═══════════════════════════════════════════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('modified_at', { ascending: false });
  if (error) { console.error('[DB] fetchNotes', error); return []; }
  return data.map(n => ({
    id: n.id,
    title: n.title || '',
    content: n.content || '',
    tag: n.tag,
    modified: new Date(n.modified_at).getTime()
  }));
}

export async function upsertNote(note, userId) {
  const payload = {
    user_id: userId,
    title: note.title || '',
    content: note.content || '',
    tag: note.tag || null,
    modified_at: new Date().toISOString()
  };
  // Only include id for updates (existing DB rows have small integer IDs)
  if (note.id && note.id < 1e12) payload.id = note.id;
  const { data, error } = await supabase.from('notes').upsert(payload).select().single();
  if (error) console.error('[DB] upsertNote', error);
  return data;
}

export async function deleteNote(id) {
  return await supabase.from('notes').delete().eq('id', id);
}

// ═══════════════════════════════════════════════════════════════════════════
//  TODOS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[DB] fetchTodos', error); return []; }
  return data.map(t => ({
    id: t.id,
    text: t.text,
    priority: t.priority,
    done: t.done,
    due: t.due_label || 'Today',
    cal: t.cal_linked,
    created: new Date(t.created_at).getTime()
  }));
}

export async function upsertTodo(todo, userId) {
  const payload = {
    user_id: userId,
    text: todo.text,
    priority: String(todo.priority),
    done: todo.done,
    due_label: todo.due || 'Today',
    cal_linked: todo.cal || false,
    done_at: todo.done ? new Date().toISOString() : null
  };
  if (todo.id && todo.id < 1e12) payload.id = todo.id;
  const { data, error } = await supabase.from('todos').upsert(payload).select().single();
  if (error) console.error('[DB] upsertTodo', error);
  return data;
}

export async function deleteTodo(id) {
  return await supabase.from('todos').delete().eq('id', id);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CALENDAR EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchCalEvents() {
  const { data, error } = await supabase
    .from('cal_events')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('[DB] fetchCalEvents', error); return []; }
  return data.map(e => ({
    id: e.id,
    title: e.title,
    day: e.event_day,
    start: e.start_hour,
    end: e.end_hour,
    color: e.color,
    gcal: e.gcal_linked
  }));
}

export async function upsertCalEvent(ev, userId) {
  const payload = {
    user_id: userId,
    title: ev.title,
    event_day: ev.day,
    start_hour: ev.start,
    end_hour: ev.end,
    color: ev.color || 'blue',
    gcal_linked: ev.gcal || false,
    gcal_event_id: ev.gcalEventId || null
  };
  if (ev.id && ev.id < 1e12) payload.id = ev.id;
  return await supabase.from('cal_events').upsert(payload);
}

// ═══════════════════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR SYNC
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchGoogleCalendarEvents() {
  const session = await getSession();
  if (!session?.provider_token) {
    console.warn('[GCal] No provider token — user must sign in with Google');
    return [];
  }
  const now = new Date().toISOString();
  const end = new Date(Date.now() + 14 * 24 * 3600000).toISOString(); // 2 weeks ahead
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
      `?timeMin=${now}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${session.provider_token}` } }
    );
    const json = await res.json();
    if (json.error) { console.error('[GCal]', json.error); return []; }
    return (json.items || []).map(item => ({
      gcalEventId: item.id,
      title: item.summary || '(No title)',
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      description: item.description || '',
      location: item.location || '',
      htmlLink: item.htmlLink
    }));
  } catch (err) {
    console.error('[GCal] fetch error', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  WIRE INTO FLOWNOTE WINDOW FUNCTIONS
//  Add this block to your index.html inside a <script type="module"> tag
//  AFTER the main <script> block
// ═══════════════════════════════════════════════════════════════════════════
//
//  <script type="module">
//    import * as DB from '/app.js';
//    window.DB = DB;
//
//    // Replace demo auth with real Supabase auth
//    window.authLogin = async () => {
//      const email = document.getElementById('login-email').value.trim();
//      const pwd   = document.getElementById('login-password').value;
//      const { data, error } = await DB.signIn({ email, password: pwd });
//      if (error) { showAuthError(error.message); return; }
//      const u = data.user;
//      saveUser({ name: u.user_metadata?.name || email.split('@')[0],
//                 nickname: u.user_metadata?.nickname || '', email });
//      hideAuthModal();
//      // Pull cloud data
//      const [notes, todos, events] = await Promise.all([
//        DB.fetchNotes(), DB.fetchTodos(), DB.fetchCalEvents()
//      ]);
//      if (notes.length)  state.notes     = notes;
//      if (todos.length)  state.todos     = todos;
//      if (events.length) state.calEvents = events;
//      renderNotesList(); renderTodos(); renderCalendar();
//      showToast('Synced from cloud ✓', 'success');
//    };
//
//    window.authSignup = async () => {
//      const fname = document.getElementById('signup-fname').value.trim();
//      const nick  = document.getElementById('signup-nick').value.trim();
//      const email = document.getElementById('signup-email').value.trim();
//      const pwd   = document.getElementById('signup-password').value;
//      if (!fname||!email||!pwd||pwd.length<8) {
//        showAuthError('All fields required. Password min 8 chars.'); return;
//      }
//      const { data, error } = await DB.signUp({ email, password: pwd, name: fname, nickname: nick });
//      if (error) { showAuthError(error.message); return; }
//      saveUser({ name: fname, nickname: nick, email });
//      hideAuthModal();
//      showToast('Welcome to FlowNote, ' + (nick||fname) + '! 🐸', 'success');
//    };
//
//    window.authGoogle = async () => {
//      const { error } = await DB.signInWithGoogle();
//      if (error) showToast('Google sign-in failed: ' + error.message, 'info');
//      // Page will redirect and return with session
//    };
//
//    // Auto-patch save() to also sync to Supabase (debounced)
//    let syncTimer = null;
//    const _origSave = save;
//    window.save = function() {
//      _origSave();
//      clearTimeout(syncTimer);
//      syncTimer = setTimeout(async () => {
//        const user = await DB.getUser();
//        if (!user) return;
//        // Sync only notes/todos modified in the last 60s
//        const cutoff = Date.now() - 60000;
//        const recentNotes = state.notes.filter(n => n.modified > cutoff);
//        const recentTodos = state.todos.filter(t => (t.created || 0) > cutoff || t.done);
//        await Promise.all([
//          ...recentNotes.map(n => DB.upsertNote(n, user.id)),
//          ...recentTodos.map(t => DB.upsertTodo(t, user.id)),
//          DB.syncStreak(state.streak),
//        ]);
//      }, 2000);
//    };
//
//    // Check session on load
//    const session = await DB.getSession();
//    if (session) {
//      const u = session.user;
//      saveUser({ name: u.user_metadata?.name || u.email.split('@')[0],
//                 nickname: u.user_metadata?.nickname || '', email: u.email });
//      const [notes, todos, events] = await Promise.all([
//        DB.fetchNotes(), DB.fetchTodos(), DB.fetchCalEvents()
//      ]);
//      if (notes.length)  { state.notes = notes; renderNotesList(); openNote(notes[0].id); }
//      if (todos.length)  { state.todos = todos; renderTodos(); }
//      if (events.length) { state.calEvents = events; renderCalendar(); }
//    }
//  </script>
