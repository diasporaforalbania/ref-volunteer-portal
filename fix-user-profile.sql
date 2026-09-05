-- ============================================================================
-- REFERENDUMI — Rregullimi i Lejeve dhe Profilit të Përdoruesit
-- Ekzekutojeni këtë në Supabase Dashboard → SQL Editor
-- ============================================================================

-- 1. Lejet e ekzekutimit për të gjitha funksionet e skemës public
grant execute on all functions in schema public to authenticated;
grant execute on function public.verify_volunteer(text) to anon;
grant execute on function public.campaign_stats() to anon;

-- 2. Lejet e tabelave kryesore
grant select on public.volunteers to authenticated;
grant update (photo_path) on public.volunteers to authenticated;
grant select on public.volunteer_private to authenticated;
grant select on public.units to authenticated;
grant select on public.unit_coordinators to authenticated;
grant select on public.campaign to authenticated;
grant select on public.signature_totals to anon, authenticated;

-- Alias për miratimin e kërkesave të ndryshimit
create or replace function public.decide_change_request(p_id uuid, p_approve boolean, p_note text default null)
returns void language sql security definer set search_path = public as $$
  select public.review_change_request(p_id, p_approve, p_note);
$$;
grant execute on function public.decide_change_request(uuid, boolean, text) to authenticated;

-- 3. Sinkronizimi i përdoruesve ekzistues nga auth.users (roli bazë: ndihmës, në pritje)
insert into public.volunteers (id, full_name, city, requested_role, role, status)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  nullif(u.raw_user_meta_data->>'city', ''),
  coalesce(nullif(u.raw_user_meta_data->>'requested_role',''), 'ndihmes'),
  'ndihmes',
  'pending'
from auth.users u
left join public.volunteers v on v.id = u.id
where v.id is null
on conflict (id) do nothing;

insert into public.volunteer_private (id, phone, email)
select
  u.id,
  nullif(u.raw_user_meta_data->>'phone', ''),
  u.email
from auth.users u
left join public.volunteer_private vp on vp.id = u.id
where vp.id is null
on conflict (id) do update set email = excluded.email;

-- 5. Politikat RLS për leximin e profilit vetjak
drop policy if exists vol_read on public.volunteers;
create policy vol_read on public.volunteers for select to authenticated
  using (
    id = auth.uid()
    or status = 'approved'
    or public.vol_is_staff()
    or (public.vol_is_coordinator() and unit_id in (select public.vol_my_unit_ids()))
    or supervisor_id = auth.uid()
  );

drop policy if exists vol_priv_read on public.volunteer_private;
create policy vol_priv_read on public.volunteer_private for select to authenticated
  using (
    id = auth.uid()
    or public.vol_is_center()
    or (public.vol_is_coordinator() and id in (
         select v.id from public.volunteers v
         where v.unit_id in (select public.vol_my_unit_ids()) and v.status = 'approved'
       ))
    or id in (
         select v.id from public.volunteers v
         where v.supervisor_id = auth.uid() and v.status = 'approved'
       )
  );

-- 6. Rregullimi i lejeve për planifikimin e turneve (Admin + Koordinator)
create or replace function public.vol_coordinates_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.unit_coordinators
     where unit_id = p_unit and volunteer_id = auth.uid()
    union
    select 1 from public.volunteers
     where id = auth.uid() and role = 'koordinator' and unit_id = p_unit
  );
$$;

create or replace function public.vol_my_unit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select unit_id from public.unit_coordinators where volunteer_id = auth.uid()
  union
  select unit_id from public.volunteers where id = auth.uid() and unit_id is not null and role = 'koordinator';
$$;

create or replace function public.vol_can_plan_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vol_is_approved()
     and (
       public.vol_is_admin()
       or case public.vol_role()
            when 'koordinator' then public.vol_coordinates_unit(p_unit)
            when 'mbledhes'    then exists (select 1 from public.volunteers
                                             where id = auth.uid() and unit_id = p_unit)
            else false
          end
     );
$$;

create or replace function public.unit_update(
  p_unit uuid, p_code text, p_name text, p_region text default null,
  p_territory text default null, p_target integer default 0
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini mund të ndryshojë njësitë.';
  end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Kodi dhe emri i njësisë janë të detyrueshëm.';
  end if;
  if length(trim(p_code)) > 12 or length(trim(p_name)) > 120
     or length(coalesce(trim(p_region), '')) > 80
     or length(coalesce(trim(p_territory), '')) > 160 then
    raise exception 'Një nga fushat e njësisë është shumë e gjatë.';
  end if;
  if coalesce(p_target, 0) < 0 then
    raise exception 'Objektivi nuk mund të jetë negativ.';
  end if;
  update public.units
     set code = upper(trim(p_code)), name = trim(p_name),
         region = nullif(trim(p_region), ''),
         territory = nullif(trim(p_territory), ''), target = coalesce(p_target, 0)
   where id = p_unit;
  if not found then raise exception 'Njësia nuk u gjet.'; end if;
end $$;

revoke all on function public.unit_update(uuid, text, text, text, text, integer) from public, anon;
grant execute on function public.unit_update(uuid, text, text, text, text, integer) to authenticated;

-- Sinkronizimi i koordinatorëve ekzistues te unit_coordinators
insert into public.unit_coordinators (unit_id, volunteer_id)
select unit_id, id
from public.volunteers
where role = 'koordinator' and unit_id is not null and status = 'approved'
on conflict (unit_id, volunteer_id) do nothing;

-- 7. Tabela dhe lejet për Sugjerimet / Feedback
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  volunteer_id   uuid references public.volunteers(id) on delete set null,
  volunteer_name text,
  volunteer_role text,
  unit_code      text,
  category       text not null check (category in ('feature', 'improvement', 'bug')),
  title          text not null,
  description    text not null,
  page_route     text,
  device_info    text,
  status         text not null default 'new' check (status in ('new', 'reviewed', 'planned', 'done')),
  closed_at      timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.feedback add column if not exists closed_at timestamptz;
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert, update on public.feedback to authenticated;

drop policy if exists fb_read on public.feedback;
create policy fb_read on public.feedback for select to authenticated
  using (volunteer_id = auth.uid() or public.vol_is_admin() or public.vol_role() = 'it');

drop policy if exists fb_insert on public.feedback;
create policy fb_insert on public.feedback for insert to authenticated
  with check (volunteer_id = auth.uid() and public.vol_is_approved());

drop policy if exists fb_update on public.feedback;
create policy fb_update on public.feedback for update to authenticated
  using (public.vol_is_admin() or public.vol_role() = 'it');

-- 8. Zgjerimi i aksesit te Historiku dhe Eksporti CSV për stafin dhe koordinatorët
create or replace function public.unit_history()
returns table (id uuid, unit_id uuid, unit_code text, unit_name text,
               volunteer_id uuid, volunteer_name text, location_name text, city text,
               started_at timestamptz, ended_at timestamptz,
               signatures integer, notes text, shift_id uuid, is_lead boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.unit_id, u.code, u.name, c.volunteer_id,
         coalesce(nullif(v.full_name,''), c.volunteer_name, 'Vullnetar'),
         c.location_name, c.city, c.started_at, c.ended_at, c.signatures, c.notes,
         c.shift_id, (c.shift_id is null or s.created_by = c.volunteer_id)
    from public.checkins c
    left join public.units      u on u.id = c.unit_id
    left join public.volunteers v on v.id = c.volunteer_id
    left join public.shifts     s on s.id = c.shift_id
   where (public.vol_is_admin() or public.vol_is_staff() or public.vol_is_center())
   order by c.started_at desc;
$$;

create or replace function public.unit_history_paginated(
  p_unit uuid default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (id uuid, unit_id uuid, unit_code text, unit_name text,
               volunteer_id uuid, volunteer_name text, location_name text, city text,
               started_at timestamptz, ended_at timestamptz,
               signatures integer, notes text, shift_id uuid, is_lead boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.unit_id, u.code, u.name, c.volunteer_id,
         coalesce(nullif(v.full_name,''), c.volunteer_name, 'Vullnetar'),
         c.location_name, c.city, c.started_at, c.ended_at, c.signatures, c.notes,
         c.shift_id, (c.shift_id is null or s.created_by = c.volunteer_id)
    from public.checkins c
    left join public.units      u on u.id = c.unit_id
    left join public.volunteers v on v.id = c.volunteer_id
    left join public.shifts     s on s.id = c.shift_id
   where (public.vol_is_admin() or public.vol_is_staff() or public.vol_is_center())
     and (p_unit is null or c.unit_id = p_unit)
     and (p_from is null or (c.started_at at time zone 'Europe/Tirane')::date >= p_from)
     and (p_to   is null or (c.started_at at time zone 'Europe/Tirane')::date <= p_to)
   order by c.started_at desc
   limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.unit_history_summary(
  p_unit uuid default null,
  p_from date default null,
  p_to date default null
)
returns json
language sql stable security definer set search_path = public as $$
  with filtered as (
    select c.id, c.unit_id, c.signatures, c.ended_at
      from public.checkins c
     where (public.vol_is_admin() or public.vol_is_staff() or public.vol_is_center())
       and (p_unit is null or c.unit_id = p_unit)
       and (p_from is null or (c.started_at at time zone 'Europe/Tirane')::date >= p_from)
       and (p_to   is null or (c.started_at at time zone 'Europe/Tirane')::date <= p_to)
  )
  select json_build_object(
    'total_signatures', coalesce(sum(signatures), 0),
    'total_shifts', count(*),
    'open_shifts', count(*) filter (where ended_at is null),
    'active_units', count(distinct unit_id) filter (where unit_id is not null)
  )
  from filtered;
$$;

-- 9. Rifreskimi i cache-it të PostgREST
notify pgrst, 'reload schema';
