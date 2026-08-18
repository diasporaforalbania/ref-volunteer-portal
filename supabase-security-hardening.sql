-- ============================================================================
-- REFERENDUMI — Supabase Security Hardening & Public Counter Migration
-- Safe to re-run in Supabase SQL Editor.
-- ============================================================================

-- 1. PAMJA E TOTALIT TË NËNSHKRIMEVE (PËR FAQEN PUBLIKE DHE /api/count)
-- Nuk ekspozon asnjë të dhënë personale: vetëm shifrën e përgjithshme dhe orën.
create or replace view public.signature_totals as
select
  coalesce(sum(c.signatures), 0)::bigint as signatures,
  (select coalesce(goal, 50000) from public.campaign where id = 1) as goal,
  coalesce(max(c.ended_at), max(c.started_at), now()) as updated
from public.checkins c;

-- Lejohet leximi i kësaj pamjeje nga vizitorët anonimë dhe të kyçur
grant select on public.signature_totals to anon, authenticated;


-- 2. SIGURIA E TABELAVE (ROW LEVEL SECURITY & PERMISSION REVOCATION)
alter table if exists public.units             enable row level security;
alter table if exists public.volunteers        enable row level security;
alter table if exists public.volunteer_private enable row level security;
alter table if exists public.announcements     enable row level security;
alter table if exists public.materials         enable row level security;
alter table if exists public.reports           enable row level security;
alter table if exists public.checkins          enable row level security;
alter table if exists public.campaign          enable row level security;
alter table if exists public.shifts            enable row level security;
alter table if exists public.shift_signups     enable row level security;
alter table if exists public.change_requests   enable row level security;
alter table if exists public.push_subscriptions enable row level security;

-- Heqja e lejeve të drejtpërdrejta nga rolet 'anon' dhe 'authenticated'
-- Çdo ndryshim i të dhënave duhet të kalojë VETËM përmes funksioneve RPC
revoke all on public.volunteers        from anon, authenticated;
revoke all on public.volunteer_private from anon, authenticated;
revoke all on public.units             from anon, authenticated;
revoke all on public.checkins          from anon, authenticated;
revoke all on public.shifts            from anon, authenticated;
revoke all on public.shift_signups     from anon, authenticated;
revoke all on public.campaign          from anon, authenticated;
revoke all on public.change_requests   from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

-- Lejet e leximit të kontrolluara nga RLS
grant select on public.volunteers        to authenticated;
grant update (photo_path) on public.volunteers to authenticated;
grant select on public.volunteer_private to authenticated;
grant select on public.units             to authenticated;
grant select on public.announcements     to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select on public.materials         to authenticated;
grant select, insert, update, delete on public.materials     to authenticated;
grant select on public.reports           to authenticated;
grant select, insert, update, delete on public.reports       to authenticated;
grant select on public.checkins          to authenticated;
grant delete on public.checkins          to authenticated;
grant select on public.shifts            to authenticated;
grant insert, delete on public.shifts    to authenticated;
grant select on public.shift_signups     to authenticated;
grant delete on public.shift_signups     to authenticated;
grant select on public.campaign          to authenticated;
grant update on public.campaign          to authenticated;
grant select on public.change_requests   to authenticated;
grant select on public.push_subscriptions to authenticated;


-- 3. KONTROLLI I EKZEKUTIMIT TË FUNKSIONEVE (REVOKE PUBLIC EXECUTE)
-- Heq ekzekutimin e parazgjedhur 'PUBLIC' për të gjitha funksionet ekzistuese dhe të ardhshme
alter default privileges in schema public revoke execute on functions from public;

-- Vetëm funksionet e sigurta publike i jepen rolit 'anon'
grant execute on function public.verify_volunteer(text) to anon, authenticated;

-- Funksionet e tjera mbrohen për përdoruesit e kyçur ('authenticated')
grant execute on function public.campaign_stats() to authenticated;
grant execute on function public.unit_totals() to authenticated;
grant execute on function public.struktura_tree() to authenticated;
grant execute on function public.field_active() to authenticated;
grant execute on function public.unit_history() to authenticated;
grant execute on function public.unit_history_paginated(uuid, date, date, integer, integer) to authenticated;
grant execute on function public.unit_history_summary(uuid, date, date) to authenticated;
grant execute on function public.my_checkins(integer) to authenticated;
grant execute on function public.shift_list(timestamptz) to authenticated;
grant execute on function public.my_next_shift() to authenticated;
grant execute on function public.shift_check_in(uuid, double precision, double precision, text, text) to authenticated;
grant execute on function public.shift_check_out(uuid, integer, text) to authenticated;
grant execute on function public.checkin_close_own(uuid, integer, text) to authenticated;
grant execute on function public.checkin_edit(uuid, integer, timestamptz, timestamptz, uuid, text) to authenticated;
grant execute on function public.shift_join(uuid) to authenticated;
grant execute on function public.shift_leave(uuid) to authenticated;
grant execute on function public.submit_change_request(text, jsonb, text) to authenticated;
grant execute on function public.review_change_request(uuid, boolean, text) to authenticated;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;
grant execute on function public.unit_set_open(uuid, boolean) to authenticated;
grant execute on function public.unit_set_coordinator(uuid, uuid) to authenticated;
grant execute on function public.unit_create(text, text, text, text, integer) to authenticated;
grant execute on function public.unit_delete(uuid) to authenticated;
grant execute on function public.vol_set_status(uuid, text) to authenticated;
grant execute on function public.vol_set_role(uuid, text) to authenticated;
grant execute on function public.vol_decide_pending(uuid, boolean, text) to authenticated;
grant execute on function public.vol_set_unit(uuid, uuid) to authenticated;
grant execute on function public.vol_set_supervisor(uuid, uuid) to authenticated;

-- 4. PËRDITËSIMI I RREGULLAVE TË BRENDSHME (RLS PËR PR, BNJ, IT, LOGJISTIKË)
drop policy if exists ann_write on public.announcements;
create policy ann_write on public.announcements for all to authenticated
  using (public.vol_is_internal()) with check (public.vol_is_internal());

drop policy if exists mat_write on public.materials;
create policy mat_write on public.materials for all to authenticated
  using (public.vol_is_internal()) with check (public.vol_is_internal());

drop policy if exists rep_read on public.reports;
create policy rep_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.vol_is_internal());

drop policy if exists rep_update on public.reports;
create policy rep_update on public.reports for update to authenticated
  using (public.vol_is_internal()) with check (public.vol_is_internal());

-- 5. INDEKSET E PERFORMANCËS
create index if not exists idx_checkins_active 
  on public.checkins (started_at desc) 
  where ended_at is null;

create index if not exists idx_checkins_unit_started 
  on public.checkins (unit_id, started_at desc);

create index if not exists idx_volunteers_supervisor_status 
  on public.volunteers (supervisor_id, status) 
  where status = 'approved';

create index if not exists idx_shifts_active_window 
  on public.shifts (starts_at desc, unit_id) 
  where closed_at is null;

-- Rifreskimi i skemës PostgREST
notify pgrst, 'reload schema';

-- ============================================================================
-- KONTROLLI I TESTIMIT (Verifikoni pas ekzekutimit):
-- 1. `select * from public.signature_totals;` -> duhet të kthejë 1 rresht
-- 2. `select * from public.volunteer_private;` si anon -> duhet të kthejë 0 rreshta
-- ============================================================================
