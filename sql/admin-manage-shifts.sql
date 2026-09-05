-- ============================================================================
-- ADMINËT MENAXHOJNË TURNET — mbyllin çdo turn dhe redaktojnë çdo turn
--
-- Deri tani:
--   • Turnin e mbyllte VETËM koordinatori/mbledhësi që e kishte hapur
--     (`shift_check_out`: role in koordinator/mbledhes DHE created_by = auth.uid()).
--   • Turnet e planifikuara nuk redaktoheshin nga askush — nuk kishte as GRANT
--     UPDATE, as politikë UPDATE mbi `public.shifts`.
--
-- Tani:
--   • Çdo admin mbyll çdo turn, në çdo njësi, edhe kur ka njerëz brenda
--     (check-in të hapur) — nënshkrimet i mbeten udhëheqësit që e hapi turnin,
--     jo adminit.
--   • Çdo admin redakton çdo turn të vendosur: data/ora (`starts_at`, `ends_at`),
--     kapaciteti dhe shënimet. Njësia dhe autorësia mbeten të pandryshueshme.
--
-- Ky skedar është pasqyrë e ndryshimeve përkatëse në `schema.sql`. Ekzekutojeni
-- një herë mbi bazën e prodhimit (Supabase SQL editor). Është idempotent.
-- ============================================================================

alter table public.shifts add column if not exists time_zone text not null default 'Europe/Tirane';
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'shifts_time_zone_ck' and conrelid = 'public.shifts'::regclass
  ) then
    alter table public.shifts add constraint shifts_time_zone_ck check (time_zone in (
      'Europe/Athens', 'Europe/Tirane', 'Europe/London', 'America/New_York',
      'America/Los_Angeles', 'Australia/Melbourne', 'Australia/Sydney'
    ));
  end if;
end $$;

grant insert (unit_id, starts_at, ends_at, time_zone, capacity, notes, created_by, created_by_name)
  on public.shifts to authenticated;

create or replace function public.vol_can_access_shift_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vol_is_approved()
     and (
       public.vol_is_qendra()
       or exists (select 1 from public.volunteers v
                   where v.id = auth.uid() and v.unit_id = p_unit)
       or public.vol_coordinates_unit(p_unit)
     );
$$;

drop policy if exists sh_read on public.shifts;
create policy sh_read on public.shifts for select to authenticated
  using (public.vol_can_access_shift_unit(unit_id));

drop policy if exists su_read on public.shift_signups;
create policy su_read on public.shift_signups for select to authenticated
  using ( public.vol_is_qendra()
          or volunteer_id = auth.uid()
          or exists (select 1 from public.shifts s
                      where s.id = shift_id
                        and public.vol_can_access_shift_unit(s.unit_id)) );

-- ---- 1) Redaktimi i turneve: GRANT + politikë UPDATE -----------------------
-- Vetëm ora, kapaciteti dhe shënimet janë të ndryshueshme. Njësia dhe
-- created_by* mbeten jashtë grantit me qëllim.
grant update (starts_at, ends_at, time_zone, capacity, notes) on public.shifts to authenticated;

drop policy if exists sh_update on public.shifts;
-- Adminët redaktojnë çdo turn. Askush tjetër — as koordinatori/mbledhësi që e
-- hapi — që orari i një turni të mos i ndryshohet nën këmbë veçse nga qendra.
create policy sh_update on public.shifts for update to authenticated
  using (public.vol_is_admin())
  with check (public.vol_is_admin());


-- ---- 2) Mbyllja e çdo turni nga admini --------------------------------------
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
  -- Adminët mbyllin çdo turn, në çdo njësi. Të tjerët vetëm si udhëheqës terreni.
  if not v_admin and v.role not in ('koordinator','mbledhes') then
    raise exception 'Turnin e mbyllin vetëm koordinatorët dhe mbledhësit e autorizuar.';
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

  -- Nënshkrimet i regjistrohen udhëheqësit që e hapi turnin. Kur admini mbyll
  -- turnin e dikujt tjetër, numri i mbetet po atij udhëheqësi — jo adminit që
  -- shtyu butonin. Pa krijues të njohur, bien te ai që po e mbyll.
  reporter := coalesce(s.created_by, auth.uid());
  select full_name into reporter_name from public.volunteers where id = reporter;
  reporter_name := coalesce(nullif(reporter_name,''), s.created_by_name, 'Vullnetar');

  select id into v_open from public.checkins
   where shift_id = p_shift and volunteer_id = reporter and ended_at is null
   order by started_at limit 1;

  if v_open is null then
    -- Udhëheqësi mund ta ketë harruar check-in-in e vet, ose turnin po e mbyll
    -- admini pa qenë vetë në terren. Turni ndodhi gjithsesi, ndaj nënshkrimet
    -- duhet të kenë ku të shkojnë.
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

grant execute on function public.shift_check_out(uuid, integer, text) to authenticated;


-- ---- 3) Turnet e hapura e të harruara mbeten të dukshme për adminët ---------
-- Që admini të mund t'i mbyllë edhe turnet që kanë ngelur hapur prej ditësh
-- (dhe s'do të binin te dritarja e zakonshme 12-orëshe e `shift_list`).
drop function if exists public.shift_list(timestamptz);
create or replace function public.shift_list(p_from timestamptz default null)
returns table (id uuid, unit_id uuid, unit_code text, unit_name text,
               starts_at timestamptz, ends_at timestamptz, time_zone text, capacity integer,
               notes text, created_by uuid, created_by_name text, created_by_role text,
               closed_at timestamptz, unit_is_open boolean,
               signed_count bigint, signed jsonb, i_am_in boolean,
               i_am_on_team boolean, i_can_manage boolean,
               checked_in_count bigint, signatures integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.unit_id, u.code, u.name, s.starts_at, s.ends_at, s.time_zone, s.capacity,
         s.notes, s.created_by, s.created_by_name, k.role, s.closed_at, u.is_open,
         (select count(*) from public.shift_signups g where g.shift_id = s.id),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'id',    g.volunteer_id,
                   'name',  coalesce(nullif(v.full_name,''), g.volunteer_name, 'Vullnetar'),
                   'role',  v.role,
                   'photo', v.photo_path) order by g.created_at), '[]'::jsonb)
            from public.shift_signups g
            left join public.volunteers v on v.id = g.volunteer_id
           where g.shift_id = s.id),
         exists (select 1 from public.shift_signups g
                  where g.shift_id = s.id and g.volunteer_id = auth.uid()),
         (coalesce(public.vol_role() in ('ndihmes','mbledhes','koordinator'), false)
          and public.vol_can_access_shift_unit(s.unit_id)),
         (s.created_by = auth.uid() or public.vol_is_admin()),
         (select count(*) from public.checkins c where c.shift_id = s.id),
         coalesce((select sum(c.signatures)::integer from public.checkins c
                    where c.shift_id = s.id), 0)
    from public.shifts s
    join public.units u on u.id = s.unit_id
    left join public.volunteers k on k.id = s.created_by
   where public.vol_is_approved()
     and public.vol_can_access_shift_unit(s.unit_id)
     -- Adminët i shohin edhe turnet e hapura e të harruara nga çdo kohë, që të
     -- mund t'i mbyllin; të tjerët vetëm dritaren e zakonshme 12-orëshe + tutje.
     and ( s.ends_at >= coalesce(p_from, now() - interval '12 hours')
           or (public.vol_is_admin() and s.closed_at is null) )
   order by s.starts_at;
$$;

grant execute on function public.shift_list(timestamptz) to authenticated;

-- PostgREST e mban skemën në kujtesë: pa këtë, ndryshimet e grantit/politikës
-- mund të mos duken menjëherë te `/rest/v1`.
notify pgrst, 'reload schema';
