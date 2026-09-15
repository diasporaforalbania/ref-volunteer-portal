-- ============================================================================
-- Përditësimi i bazës për statuset e vullnetarëve dhe arsyen e refuzimit
-- Ekzekutojeni këtë në Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Shto kolonën e arsyes së refuzimit në tabelën volunteers (nëse nuk ekziston)
alter table public.volunteers
  add column if not exists reject_reason text;

-- 2. Përditëso kufizimin (check constraint) për të lejuar nënstatuset e kontaktit
alter table public.volunteers
  drop constraint if exists volunteers_status_check;

alter table public.volunteers
  add constraint volunteers_status_check
  check (status in ('pending','kontaktuar','pa_pergjigje','ne_autorizim','approved','suspended'));

-- 3. Përditëso politikën RLS për të përfshirë nënstatuset e kontaktit për stafin/koordinatorët
drop policy if exists vol_select on public.volunteers;
create policy vol_select on public.volunteers for select to authenticated
using (
  auth.uid() = id
  or public.vol_is_center()
  or (
    public.vol_is_staff()
    and role in ('ndihmes','mbledhes')
    and (
      unit_id in (select public.vol_my_unit_ids())
      or status in ('pending','kontaktuar','pa_pergjigje','ne_autorizim')
      or unit_id is null
    )
  )
);

-- 4. Fshi funksionin e vjetër me 3 parametra para se të krijojmë të riun me 4 parametra
--    (CREATE OR REPLACE nuk e zëvendëson kur ndryshon firma — PostgreSQL krijon
--     një overload të ri dhe nuk di ta zgjedhë kur thërrasim me 3 argumente)
drop function if exists public.vol_decide_pending(uuid, boolean, text);

-- Funksioni për vendimin e vullnetarit të ri (miratim ose refuzim me arsye)
create or replace function public.vol_decide_pending(
  p_id uuid,
  p_approve boolean,
  p_role text default null,
  p_reject_reason text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini vendos për vullnetarët e rinj.';
  end if;
  if p_approve and p_role is not null and p_role not in
     ('ndihmes','mbledhes','lw','koordinator','jurist','admin',
      'logjistike','burime_njerezore','pr_edukim','it') then
    raise exception 'Rol i pavlefshëm: %', p_role;
  end if;
  update public.volunteers
     set status        = case when p_approve then 'approved' else 'suspended' end,
         reject_reason = case when not p_approve then coalesce(p_reject_reason, reject_reason) else null end,
         role          = case when p_approve then coalesce(p_role, role) else role end,
         approved_at   = case when p_approve then now() else approved_at end,
         approved_by   = case when p_approve then auth.uid() else approved_by end
   where id = p_id and status in ('pending','kontaktuar','pa_pergjigje','ne_autorizim');
end $$;

grant execute on function public.vol_decide_pending(uuid, boolean, text, text) to authenticated;

-- 5. Funksioni për ndryshimin e gjendjes së kontaktit/verifikimit
create or replace function public.vol_set_pending_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_staff() then
    raise exception 'Nuk keni të drejtë ta ndryshoni statusin.';
  end if;
  if p_status not in ('pending', 'kontaktuar', 'pa_pergjigje', 'ne_autorizim') then
    raise exception 'Status i pavlefshëm: %', p_status;
  end if;
  update public.volunteers
     set status = p_status
   where id = p_id
     and status in ('pending', 'kontaktuar', 'pa_pergjigje', 'ne_autorizim');
end $$;

grant execute on function public.vol_set_pending_status(uuid, text) to authenticated;

-- 6. Përditëso statistikat e fushatës për të numëruar të gjitha nënstatuset në pritje
create or replace function public.campaign_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'signatures',    coalesce((select sum(signatures) from public.checkins), 0),
    'shifts',        (select count(*) from public.checkins),
    'active_shifts', (select count(*) from public.checkins where ended_at is null),
    'volunteers',    (select count(*) from public.volunteers where status = 'approved'),
    'pending',       (select count(*) from public.volunteers where status in ('pending','kontaktuar','pa_pergjigje','ne_autorizim')),
    'pending_requests', (select count(*) from public.change_requests where status = 'pending'),
    'units',         (select count(*) from public.units),
    'open_reports',  (select count(*) from public.reports where status <> 'resolved'),
    'open_units',    (select count(*) from public.units where is_open),
    'upcoming_shifts', (select count(*) from public.shifts where ends_at > now()),
    'goal',          (select goal     from public.campaign where id = 1),
    'deadline',      (select deadline from public.campaign where id = 1),
    'title',         (select title    from public.campaign where id = 1)
  )
  where public.vol_is_approved();
$$;

grant execute on function public.campaign_stats() to anon, authenticated;
