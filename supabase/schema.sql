-- najda — Supabase schema + demo seed. Paste into Supabase → SQL Editor → Run.
-- Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null default 'My circle',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,                       -- Supabase Auth user (phone OTP)
  name text not null,
  phone text unique not null,                -- E.164, e.g. +21620000001
  push_token text,                           -- Expo push token
  circle_id uuid references public.circles(id) on delete set null,
  security_code_hash text,                   -- SHA-256 of the 4-digit PIN (also kept on device)
  battery int,
  last_seen timestamptz default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  circle_id uuid references public.circles(id) on delete set null,
  type text not null,
  status text not null default 'active' check (status in ('active','responding','resolved')),
  lat double precision,                      -- location exists ONLY while the alert is active
  lng double precision,
  address text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  responder_ids uuid[] not null default '{}'
);

-- Helper reached the victim ("I'm with Mariem"): the victim is no longer alone,
-- so the alert is CLOSED and the location wiped (privacy: kept only while help is needed).
alter table public.alerts add column if not exists arrived_ids uuid[] not null default '{}';

create or replace function public.arrive_alert(p_alert uuid, p_user uuid)
returns public.alerts language sql as $$
  update public.alerts
     set arrived_ids = case when p_user = any(arrived_ids) then arrived_ids else array_append(arrived_ids, p_user) end,
         responder_ids = case when p_user = any(responder_ids) then responder_ids else array_append(responder_ids, p_user) end,
         status = 'resolved',
         resolved_at = now(),
         lat = null, lng = null, address = null
   where id = p_alert and status <> 'resolved'
  returning *;
$$;
grant execute on function public.arrive_alert(uuid, uuid) to anon, authenticated;

-- Only personal threats a friend can act on.
alter table public.alerts drop constraint if exists alerts_type_check;
alter table public.alerts add constraint alerts_type_check
  check (type in ('braquage','harcelement','agression','accident','medical','autre','shake_no_code','manual'));

create index if not exists alerts_circle_idx on public.alerts (circle_id, created_at desc);

-- Helper joins a live alert ("I'm going").
create or replace function public.respond_alert(p_alert uuid, p_user uuid)
returns public.alerts language sql as $$
  update public.alerts
     set responder_ids = case when p_user = any(responder_ids) then responder_ids
                              else array_append(responder_ids, p_user) end,
         status = case when status = 'active' then 'responding' else status end
   where id = p_alert and status <> 'resolved'
  returning *;
$$;

-- Victim is safe: resolve and WIPE the location (privacy: kept only during the alert).
create or replace function public.resolve_alert(p_alert uuid)
returns public.alerts language sql as $$
  update public.alerts
     set status = 'resolved', resolved_at = now(), lat = null, lng = null, address = null
   where id = p_alert
  returning *;
$$;

-- Privacy safety net: wipe any leftover location older than 7 days (run manually or via pg_cron).
create or replace function public.purge_old_locations()
returns void language sql as $$
  update public.alerts set lat = null, lng = null, address = null
   where created_at < now() - interval '7 days' and lat is not null;
$$;

-- Realtime (alerts: INSERT/UPDATE pushed to the circle; users: online/battery).
alter table public.alerts replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.alerts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.users;
exception when duplicate_object then null; end $$;

-- RLS — HACKATHON / DEMO GRADE: any client with the anon key can read & write.
-- Production: restrict to auth.uid() and same circle_id.
alter table public.circles enable row level security;
alter table public.users   enable row level security;
alter table public.alerts  enable row level security;

drop policy if exists demo_all on public.circles;
drop policy if exists demo_all on public.users;
drop policy if exists demo_all on public.alerts;
create policy demo_all on public.circles for all to anon, authenticated using (true) with check (true);
create policy demo_all on public.users   for all to anon, authenticated using (true) with check (true);
create policy demo_all on public.alerts  for all to anon, authenticated using (true) with check (true);

grant execute on function public.respond_alert(uuid, uuid) to anon, authenticated;
grant execute on function public.resolve_alert(uuid) to anon, authenticated;

-- Seed: circle "Family" (invite code SOUSSE) with Mariem, Maram, Yassine.
insert into public.circles (id, code, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SOUSSE', 'Family')
on conflict (id) do nothing;

-- PIN for all demo users = 1234 (SHA-256).
insert into public.users (id, name, phone, circle_id, security_code_hash, battery) values
  ('11111111-1111-1111-1111-111111111111', 'Mariem',  '+21620000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 82),
  ('22222222-2222-2222-2222-222222222222', 'Maram',   '+21620000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 64),
  ('33333333-3333-3333-3333-333333333333', 'Yassine', '+21620000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 47)
on conflict (id) do update set circle_id = excluded.circle_id;
