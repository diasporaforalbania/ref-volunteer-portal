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

-- Sinkronizimi i koordinatorëve ekzistues te unit_coordinators
insert into public.unit_coordinators (unit_id, volunteer_id)
select unit_id, id
from public.volunteers
where role = 'koordinator' and unit_id is not null and status = 'approved'
on conflict (unit_id, volunteer_id) do nothing;

-- 7. Rifreskimi i cache-it të PostgREST
notify pgrst, 'reload schema';
