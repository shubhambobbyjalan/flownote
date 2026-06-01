-- ═══════════════════════════════════════════════════════════════════════
-- FlowNote — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════

-- ── PROFILES (extends auth.users) ───────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users on delete cascade primary key,
  name             text not null default '',
  nickname         text default '',
  avatar_url       text,
  streak_count     int  not null default 0,
  streak_last_active date,
  streak_history   boolean[] default array[]::boolean[],
  settings         jsonb not null default '{
    "reminder": true,
    "motivation": true,
    "autoblock": true,
    "meetingprep": true,
    "vibration": true,
    "sound": true,
    "lightmode": false
  }'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── NOTES ───────────────────────────────────────────────────────────────
create table if not exists notes (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete cascade not null,
  title       text not null default '',
  content     text not null default '',
  tag         text check (tag in ('work','personal','idea') or tag is null),
  modified_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists notes_user_modified on notes(user_id, modified_at desc);

-- ── TODOS ───────────────────────────────────────────────────────────────
create table if not exists todos (
  id          bigserial primary key,
  user_id     uuid references auth.users on delete cascade not null,
  text        text not null,
  priority    text not null default '2' check (priority in ('frog','1','2','3')),
  done        boolean not null default false,
  due_label   text not null default 'Today',
  cal_linked  boolean not null default false,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists todos_user_created on todos(user_id, created_at desc);
create index if not exists todos_user_done    on todos(user_id, done);

-- ── CALENDAR EVENTS ─────────────────────────────────────────────────────
create table if not exists cal_events (
  id            bigserial primary key,
  user_id       uuid references auth.users on delete cascade not null,
  title         text not null,
  event_day     int,
  start_hour    float,
  end_hour      float,
  color         text not null default 'blue' check (color in ('blue','green','purple','amber','red')),
  gcal_linked   boolean not null default false,
  gcal_event_id text,
  event_date    date,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists events_user_date on cal_events(user_id, event_date);

-- ── ROW LEVEL SECURITY (CRITICAL — do not skip) ──────────────────────────
alter table profiles  enable row level security;
alter table notes     enable row level security;
alter table todos     enable row level security;
alter table cal_events enable row level security;

-- Each user only ever sees/edits their own rows
create policy "profiles: own row"   on profiles   for all using (auth.uid() = id);
create policy "notes: own rows"     on notes      for all using (auth.uid() = user_id);
create policy "todos: own rows"     on todos      for all using (auth.uid() = user_id);
create policy "events: own rows"    on cal_events for all using (auth.uid() = user_id);

-- ── AUTO-CREATE PROFILE ON SIGN UP ──────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'nickname', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── AUTO-UPDATE updated_at ───────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists touch_profiles on profiles;
create trigger touch_profiles
  before update on profiles
  for each row execute procedure touch_updated_at();

-- ── STREAK HELPER FUNCTION ───────────────────────────────────────────────
create or replace function increment_streak(uid uuid)
returns void language plpgsql security definer as $$
declare
  today date := current_date;
  p profiles%rowtype;
begin
  select * into p from profiles where id = uid;
  if p.streak_last_active = today then
    return; -- already counted today
  elsif p.streak_last_active = today - interval '1 day' then
    update profiles set streak_count = streak_count + 1, streak_last_active = today where id = uid;
  elsif p.streak_last_active < today - interval '1 day' then
    update profiles set streak_count = 1, streak_last_active = today where id = uid;
  end if;
end;
$$;

-- ── VERIFY: list your tables ─────────────────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
