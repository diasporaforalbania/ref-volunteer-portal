-- ============================================================================
-- ROLI I RI `lw` — MBLEDHËS LËVIZËS DERË-MË-DERË (SINGLETON)
--
-- Deri tani të gjitha rolet e terrenit (ndihmes/mbledhes/koordinator) rrinë në
-- një zonë (njësi) fikse që e krijon qendra. `lw` është dinamik: pa vendndodhje
-- fikse, pa vartës. Sapo dikujt i caktohet roli `lw`:
--   • i hapet automatikisht një njësi singleton me EMRIN e tij,
--   • objektivi fillestar 500 firma,
--   • ai vihet koordinator i asaj njësie (del te Paneli & struktura),
--   • dhe mund të hapë turne / bëjë check-in te njësia e vet.
-- Zona (`region`, p.sh. "Diaspora") lihet bosh — e plotëson admini me redaktim.
-- `lw` caktohet VETËM nga admini (si `it`); nuk ofrohet në regjistrim.
--
-- Ky skedar është pasqyrë e ndryshimeve përkatëse në `schema.sql`. Ekzekutojeni
-- një herë mbi bazën (Supabase SQL editor). Është idempotent.
-- ============================================================================

-- 1) Lejo rolin `lw` te kufizimi CHECK i `volunteers.role`.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'volunteers_role_check') then
    alter table public.volunteers drop constraint volunteers_role_check;
  end if;
  alter table public.volunteers add constraint volunteers_role_check
    check (role in ('ndihmes','mbledhes','lw','koordinator','jurist','admin',
                     'logjistike','burime_njerezore','pr_edukim','it'));
end $$;
-- (`requested_role` lihet siç është — `lw` nuk kërkohet në regjistrim.)

-- 2) Validimi i rolit te caktimi/miratimi.
create or replace function public.vol_set_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini ndryshon rolet.';
  end if;
  if p_role not in ('ndihmes','mbledhes','lw','koordinator','jurist','admin',
                     'logjistike','burime_njerezore','pr_edukim','it') then
    raise exception 'Rol i pavlefshëm: %', p_role;
  end if;
  update public.volunteers set role = p_role where id = p_id;
end $$;

create or replace function public.vol_decide_pending(p_id uuid, p_approve boolean, p_role text default null)
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
     set status      = case when p_approve then 'approved' else 'suspended' end,
         role         = case when p_approve then coalesce(p_role, role) else role end,
         approved_at  = case when p_approve then now() else approved_at end,
         approved_by  = case when p_approve then auth.uid() else approved_by end
   where id = p_id and status = 'pending';
end $$;

-- 3) `vol_set_unit` rri pa efekt për një LW — njësinë e mban vetë (auto).
create or replace function public.vol_set_unit(p_id uuid, p_unit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not public.vol_is_staff() then
    raise exception 'Nuk keni të drejtë ta bëni këtë veprim.';
  end if;
  select role into v_role from public.volunteers where id = p_id;
  if v_role = 'lw' then
    return;
  end if;
  if not public.vol_is_center() then
    if p_unit is not null and not public.vol_coordinates_unit(p_unit) then
      raise exception 'Mund të caktoni njerëz vetëm në zonat tuaja.';
    end if;
    if not public.vol_can_see_volunteer(p_id) then
      raise exception 'Ky vullnetar nuk është në hierarkinë tuaj.';
    end if;
  end if;
  update public.volunteers set unit_id = p_unit where id = p_id;

  if v_role = 'koordinator' and p_unit is not null then
    insert into public.unit_coordinators (unit_id, volunteer_id, assigned_by)
    values (p_unit, p_id, auth.uid())
    on conflict (unit_id, volunteer_id) do nothing;
  end if;
end $$;

-- 4) Trigger-i që hap njësinë e LW-së (idempotent, me kod `LW-<kodi>`).
create or replace function public.lw_ensure_unit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text; v_unit uuid;
begin
  if new.role <> 'lw' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.role is not distinct from 'lw' then
    return new;
  end if;

  v_code := left('LW-' || new.volunteer_code, 12);

  select id into v_unit from public.units where code = v_code;
  if v_unit is null then
    insert into public.units (code, name, region, territory, target,
                              is_open, opened_at, coordinator_id)
    values (v_code,
            coalesce(nullif(trim(new.full_name), ''), new.volunteer_code),
            null, nullif(trim(new.city), ''), 500,
            true, now(), new.id)
    returning id into v_unit;
  else
    update public.units set coordinator_id = new.id where id = v_unit;
  end if;

  update public.volunteers set unit_id = v_unit where id = new.id;

  insert into public.unit_coordinators (unit_id, volunteer_id, assigned_by)
  values (v_unit, new.id, coalesce(auth.uid(), new.id))
  on conflict (unit_id, volunteer_id) do nothing;

  return new;
end $$;

drop trigger if exists lw_ensure_unit_trg on public.volunteers;
create trigger lw_ensure_unit_trg
  after insert or update of role on public.volunteers
  for each row execute function public.lw_ensure_unit();

-- 5) Lejet e terrenit për LW-në — vetëm te njësia e vet.
create or replace function public.vol_can_plan_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vol_is_approved()
     and (
       public.vol_is_admin()
       or case public.vol_role()
            when 'koordinator' then public.vol_coordinates_unit(p_unit)
            when 'mbledhes'    then exists (select 1 from public.volunteers
                                             where id = auth.uid() and unit_id = p_unit)
            when 'lw'          then exists (select 1 from public.volunteers
                                             where id = auth.uid() and unit_id = p_unit)
            else false
          end
     );
$$;

create or replace function public.shift_check_in(
  p_shift uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_location text default null,
  p_city text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.shifts; v public.volunteers; v_id uuid;
begin
  select * into v from public.volunteers where id = auth.uid();
  if v.id is null or v.status <> 'approved' then
    raise exception 'Vetëm vullnetarët e miratuar bëjnë check-in.';
  end if;
  if v.role not in ('ndihmes','mbledhes','koordinator','lw') then
    raise exception 'Check-in bëjnë vetëm ndihmësit, mbledhësit, koordinatorët dhe LW-të e terrenit.';
  end if;

  select * into s from public.shifts where id = p_shift;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if s.closed_at is not null then raise exception 'Ky turn është mbyllur tashmë.'; end if;
  if not public.vol_can_access_shift_unit(s.unit_id) then
    raise exception 'Ky turn nuk është i ekipit tuaj.';
  end if;
  if now() < s.starts_at - public.shift_grace() then
    raise exception 'Check-in-i hapet pak para fillimit të turnit.';
  end if;
  if now() > s.ends_at then
    raise exception 'Ky turn ka mbaruar — check-in-i nuk bëhet më.';
  end if;
  if not public.vol_unit_is_open(s.unit_id) then
    raise exception 'Njësia e këtij turni është e mbyllur nga qendra.';
  end if;
  if exists (select 1 from public.checkins c
              where c.volunteer_id = auth.uid() and c.ended_at is null) then
    raise exception 'Keni tashmë një turn të hapur.';
  end if;

  insert into public.checkins (volunteer_id, volunteer_name, unit_id, shift_id,
                               location_name, city, lat, lng)
  values (auth.uid(), v.full_name, s.unit_id, s.id,
          coalesce(nullif(trim(p_location),''), nullif(s.notes,''), ''),
          coalesce(nullif(trim(p_city),''), v.city),
          p_lat, p_lng)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.shift_check_out(
  p_shift uuid, p_signatures integer, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.shifts; v public.volunteers; v_open uuid;
        v_admin boolean; reporter uuid; reporter_name text;
begin
  select * into v from public.volunteers where id = auth.uid();
  if v.id is null or v.status <> 'approved' then
    raise exception 'Vetëm vullnetarët e miratuar mbyllin turne.';
  end if;
  v_admin := public.vol_is_admin();
  if not v_admin and v.role not in ('koordinator','mbledhes','lw') then
    raise exception 'Turnin e mbyllin vetëm koordinatorët, mbledhësit e autorizuar dhe LW-të.';
  end if;
  if p_signatures is null or p_signatures < 0 then
    raise exception 'Numri i nënshkrimeve nuk mund të jetë negativ.';
  end if;

  select * into s from public.shifts where id = p_shift for update;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if not v_admin and s.created_by is distinct from auth.uid() then
    raise exception 'Turnin e mbyll vetëm ai që e hapi.';
  end if;
  if s.closed_at is not null then raise exception 'Ky turn është mbyllur tashmë.'; end if;

  reporter := coalesce(s.created_by, auth.uid());
  select full_name into reporter_name from public.volunteers where id = reporter;
  reporter_name := coalesce(nullif(reporter_name,''), s.created_by_name, 'Vullnetar');

  select id into v_open from public.checkins
   where shift_id = p_shift and volunteer_id = reporter and ended_at is null
   order by started_at limit 1;

  if v_open is null then
    insert into public.checkins (volunteer_id, volunteer_name, unit_id, shift_id,
                                 location_name, started_at, ended_at, signatures, notes)
    values (reporter, reporter_name, s.unit_id, s.id,
            coalesce(nullif(s.notes,''), ''), s.starts_at, now(), p_signatures,
            nullif(trim(p_notes),''));
  else
    update public.checkins
       set ended_at = now(), signatures = p_signatures, notes = nullif(trim(p_notes),'')
     where id = v_open;
  end if;

  update public.checkins
     set ended_at = now(), signatures = 0
   where shift_id = p_shift and ended_at is null;

  update public.shifts set closed_at = now() where id = p_shift;
end $$;

create or replace function public.shift_join(p_shift uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap integer; v_taken integer; v_ends timestamptz; v_closed timestamptz;
        v_unit uuid; v_name text; v_role text;
begin
  if not public.vol_is_approved() then
    raise exception 'Vetëm vullnetarët e miratuar regjistrohen në turne.';
  end if;
  select full_name, role into v_name, v_role from public.volunteers where id = auth.uid();
  if v_role not in ('ndihmes','mbledhes','koordinator','lw') then
    raise exception 'Në turne regjistrohen vetëm vullnetarët e terrenit.';
  end if;

  select capacity, ends_at, closed_at, unit_id into v_cap, v_ends, v_closed, v_unit
    from public.shifts where id = p_shift for update;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if v_closed is not null then raise exception 'Ky turn është mbyllur.'; end if;
  if v_ends < now() then raise exception 'Ky turn ka mbaruar.'; end if;
  if not public.vol_can_access_shift_unit(v_unit) then
    raise exception 'Ky turn nuk është i ekipit tuaj.';
  end if;

  select count(*) into v_taken from public.shift_signups where shift_id = p_shift;
  if v_cap > 0 and v_taken >= v_cap then
    raise exception 'Ky turn është plot.';
  end if;

  insert into public.shift_signups (shift_id, volunteer_id, volunteer_name)
  values (p_shift, auth.uid(), v_name)
  on conflict (shift_id, volunteer_id) do nothing;
end $$;

-- 6) LW-ja del te struktura (mbi njësinë e vet; të tjerët s'e shohin).
drop function if exists public.struktura_tree();
create or replace function public.struktura_tree()
returns table (id uuid, full_name text, role text, photo_path text,
               volunteer_code text, supervisor_id uuid, unit_id uuid)
language sql stable security definer set search_path = public as $$
  with me as (select id, role, unit_id from public.volunteers where id = auth.uid())
  select v.id, v.full_name, v.role, v.photo_path, v.volunteer_code,
         v.supervisor_id, v.unit_id
    from public.volunteers v, me
   where v.status = 'approved'
     and v.role in ('koordinator','mbledhes','ndihmes','lw')
     and (
       me.role in ('admin','jurist','logjistike','burime_njerezore','pr_edukim','it')
       or (me.role = 'lw' and v.id = me.id)
       or (me.role = 'koordinator' and (
             v.id = me.id
             or v.unit_id in (select public.vol_my_unit_ids())
             or v.id in (select uc.volunteer_id from public.unit_coordinators uc
                          where uc.unit_id in (select public.vol_my_unit_ids()))
             or (v.role in ('mbledhes','ndihmes') and v.unit_id is null)
       ))
       or (me.role = 'mbledhes' and (
             v.id = me.id
             or (v.role = 'koordinator' and me.unit_id is not null
                 and v.id in (select uc.volunteer_id from public.unit_coordinators uc
                               where uc.unit_id = me.unit_id))
             or (v.role = 'ndihmes' and v.supervisor_id = me.id)
             or (v.role = 'ndihmes' and v.supervisor_id is null)
       ))
       or (me.role = 'ndihmes' and (
             v.id = me.id
             or v.id = (select supervisor_id from public.volunteers where id = me.id)
             or (v.role = 'koordinator' and me.unit_id is not null
                 and v.id in (select uc.volunteer_id from public.unit_coordinators uc
                               where uc.unit_id = me.unit_id))
       ))
     )
   order by v.full_name;
$$;

grant execute on function public.struktura_tree() to authenticated;

-- 7) (Opsionale) Për LW-të ekzistuese të caktuara para këtij trigger-i, hap
-- njësitë e tyre me një caktim "no-op" të rolit, që trigger-i të kapërcejë:
-- update public.volunteers set role = 'lw' where role = 'lw';  -- s'e nis dot
-- (OLD.role = 'lw'), ndaj për to ekzekutoni një herë funksionin me dorë:
do $$
declare r record; v_code text; v_unit uuid;
begin
  for r in select * from public.volunteers where role = 'lw' loop
    v_code := left('LW-' || r.volunteer_code, 12);
    select id into v_unit from public.units where code = v_code;
    if v_unit is null then
      insert into public.units (code, name, region, territory, target,
                                is_open, opened_at, coordinator_id)
      values (v_code, coalesce(nullif(trim(r.full_name), ''), r.volunteer_code),
              null, nullif(trim(r.city), ''), 500, true, now(), r.id)
      returning id into v_unit;
    end if;
    update public.volunteers set unit_id = v_unit where id = r.id and unit_id is distinct from v_unit;
    insert into public.unit_coordinators (unit_id, volunteer_id, assigned_by)
    values (v_unit, r.id, r.id) on conflict (unit_id, volunteer_id) do nothing;
  end loop;
end $$;
