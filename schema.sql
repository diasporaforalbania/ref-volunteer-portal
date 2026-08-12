-- ============================================================================
-- REFERENDUMI — Portali i vullnetarëve (mbledhja e 50,000 nënshkrimeve)
-- Supabase schema. SQL Editor → New query → ngjit gjithçka → Run.
--
-- Ky portal KA login. Struktura ndjek organigramën e fushatës:
--   Shtresa 1 · QENDRA          → role 'admin', 'jurist'
--   Shtresa 2 · KOORDINATORËT   → role 'koordinator'
--   Shtresa 3 · NJËSITË NË TERREN → role 'mbledhes' (i autorizuar) + 'ndihmes'
--
-- ⚠ PËRDORNI NJË PROJEKT SUPABASE TË VEÇANTË nga platforma publike
--   "Për Shqipërinë". Këtu ruhen të dhëna personale (foto, telefon) dhe
--   supabase-schema.sql i platformës publike bën `drop ... cascade` që do të
--   prishte politikat këtu. Emrat e funksioneve këtu nisin me `vol_` pikërisht
--   që të mos përplasen, por ndarja mbetet zgjidhja e sigurt.
--
-- Safe to re-run: çdo objekt krijohet me `if not exists` / `or replace`.
-- NUK fshin të dhëna ekzistuese.
-- ============================================================================


-- ============================ TABELAT =======================================

-- Njësitë në terren (Shtresa 3) = ZONAT e hierarkisë.
-- Çdo njësi i përket një koordinatori (një koordinator mban 2–4 zona: A1, A2, …)
-- dhe hapet/mbyllet nga qendra. Check-in bëhet VETËM në njësi të hapura.
create table if not exists public.units (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,            -- 'A1', 'B2', 'C1'
  name           text not null,                   -- 'Njësia A1'
  region         text,                            -- 'Rajoni A' / 'Diaspora'
  territory      text,                            -- 'Tiranë, njësia bashkiake 5'
  target         integer not null default 0,      -- objektivi i firmave
  coordinator_id uuid,                            -- → volunteers (lidhja shtohet më poshtë)
  is_open        boolean not null default false,  -- e hapur për mbledhje?
  opened_at      timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz not null default now()
);

-- Numërues për kodin e vullnetarit (V-0001, V-0002, ...)
create sequence if not exists public.vol_code_seq start 1;

-- Vullnetarët — një rresht për çdo llogari te auth.users.
create table if not exists public.volunteers (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text not null default '',
  volunteer_code text unique not null default ('V-' || lpad(nextval('public.vol_code_seq')::text, 4, '0')),
  role          text not null default 'ndihmes'
                check (role in ('ndihmes','mbledhes','koordinator','jurist','admin',
                                 'logjistike','burime_njerezore','pr_edukim','it')),
  -- Roli i kërkuar në regjistrim — thjesht preferenca e vullnetarit. NUK jep
  -- të drejta vetë: `role` (më sipër) mbetet 'ndihmes' derisa admini ta
  -- ndryshojë me dorë te miratimi. Kështu askush s'bëhet "admin" duke
  -- zgjedhur thjesht një opsion në formularin e regjistrimit.
  requested_role text
                check (requested_role is null or requested_role in
                       ('ndihmes','mbledhes','koordinator','jurist',
                        'logjistike','burime_njerezore','pr_edukim','it')),
  status        text not null default 'pending'
                check (status in ('pending','approved','suspended')),
  unit_id       uuid references public.units on delete set null,
  -- Struktura Koordinator → Mbledhës → Ndihmës (e ndarë nga zona/njësia):
  -- një mbledhës i përgjigjet një koordinatori, një ndihmës i përgjigjet
  -- një mbledhësi. Vetëm përmes `vol_set_supervisor` më poshtë.
  supervisor_id uuid references public.volunteers on delete set null,
  city          text,
  photo_path    text,                             -- foto e ID-së në storage
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   uuid references auth.users on delete set null
);

-- Të dhënat e kontaktit rrinë veçmas: i sheh vetëm vetë personi + qendra.
create table if not exists public.volunteer_private (
  id                uuid primary key references public.volunteers on delete cascade,
  phone             text,
  email             text,
  emergency_contact text,
  note              text
);

-- Kërkesa për ndryshim: foto, të dhëna profili, ose zonë. Vullnetari propozon,
-- vetëm admini shqyrton (mirato/refuzo) — shih `submit_change_request` /
-- `review_change_request` më poshtë. E dhëna e propozuar rri te `payload`
-- deri sa admini të vendosë; nuk prek rreshtin e vullnetarit vetvetiu.
create table if not exists public.change_requests (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references public.volunteers on delete cascade,
  kind          text not null check (kind in ('profile','photo','zone')),
  payload       jsonb not null default '{}'::jsonb,
  note          text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by   uuid references auth.users on delete set null,
  reviewed_note text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
-- Një kërkesë e vetme në pritje për person, për lloj — pa këtë dikush mund
-- të mbushë radhën e adminit me kërkesa të përsëritura.
create unique index if not exists change_req_one_pending_idx
  on public.change_requests (volunteer_id, kind) where status = 'pending';
create index if not exists change_req_status_idx on public.change_requests (status, created_at desc);

-- Njoftimet.
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null default '',
  level       text not null default 'info' check (level in ('info','important','urgent')),
  pinned      boolean not null default false,
  audience    text not null default 'all' check (audience in ('all','staff')),
  author_id   uuid references public.volunteers on delete set null,
  author_name text,
  created_at  timestamptz not null default now()
);

-- Materialet: guide-book, fletë-palosje, formularë, FAQ, dokumente ligjore.
create table if not exists public.materials (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  category     text not null default 'other'
               check (category in ('guide','leaflet','form','faq','legal','other')),
  file_path    text,                              -- në bucket 'vol-materials'
  file_name    text,
  mime         text,
  size         bigint,
  external_url text,                              -- ose thjesht një link
  uploader_name text,
  created_at   timestamptz not null default now()
);

-- Raportimet: incident, shqetësim ligjor, material i humbur.
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.volunteers on delete cascade,
  reporter_name text,
  kind          text not null check (kind in ('incident','legal','material')),
  severity      text not null default 'medium' check (severity in ('low','medium','high')),
  title         text not null,
  body          text not null default '',
  location_text text,
  lat           double precision,
  lng           double precision,
  photo_path    text,                             -- bucket PRIVAT 'vol-reports'
  status        text not null default 'open' check (status in ('open','review','resolved')),
  handled_by    uuid references public.volunteers on delete set null,
  handled_name  text,
  handled_note  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Check-in në terren: një turn mbledhjeje nënshkrimesh.
create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references public.volunteers on delete cascade,
  volunteer_name text,
  unit_id       uuid references public.units on delete set null,
  location_name text not null,
  city          text,
  lat           double precision,
  lng           double precision,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  signatures    integer not null default 0,
  notes         text
);

create index if not exists checkins_open_idx on public.checkins (ended_at) where ended_at is null;
create index if not exists checkins_vol_idx  on public.checkins (volunteer_id, started_at desc);
create index if not exists checkins_unit_idx on public.checkins (unit_id, started_at desc);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- Turnet e planifikuara: koordinatori/qendra hap një turn (e martë 14, 18:00–20:00)
-- dhe vullnetarët regjistrohen në të.
create table if not exists public.shifts (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references public.units on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  capacity        integer not null default 0,      -- 0 = pa kufi
  notes           text,
  created_by      uuid references public.volunteers on delete set null,
  created_by_name text,
  -- Mbushet kur udhëheqësi (koordinatori/mbledhësi që e hapi) bën check-out:
  -- turni mbaron për të gjithë ekipin njëherësh, shih `shift_check_out`.
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  constraint shifts_time_ck check (ends_at > starts_at)
);

create table if not exists public.shift_signups (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts on delete cascade,
  volunteer_id   uuid not null references public.volunteers on delete cascade,
  volunteer_name text,
  created_at     timestamptz not null default now(),
  unique (shift_id, volunteer_id)
);

create index if not exists shifts_when_idx   on public.shifts (starts_at);
create index if not exists shifts_unit_idx   on public.shifts (unit_id, starts_at);
create index if not exists signups_shift_idx on public.shift_signups (shift_id);
create index if not exists signups_vol_idx   on public.shift_signups (volunteer_id);

-- Njoftimet në telefon (Web Push). Një rresht për çdo pajisje ku vullnetari e
-- ka instaluar portalin dhe ka pranuar njoftimet — një person mund të ketë
-- telefonin dhe kompjuterin. `endpoint` është adresa unike që e jep vetë
-- shfletuesi; `p256dh` dhe `auth_key` janë çelësat me të cilët shifrohet
-- njoftimi, që as shërbimi i Google-it apo i Apple-it të mos e lexojë dot.
--
-- Kolona quhet `auth_key` e jo `auth`: `auth` është emri i skemës ku rri
-- `auth.uid()`, dhe një kolonë me atë emër e bën kodin e mëposhtëm dykuptimësh.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth_key     text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_sub_vol_idx on public.push_subscriptions (volunteer_id);

-- Parametrat e fushatës (një rresht i vetëm).
create table if not exists public.campaign (
  id         integer primary key default 1 check (id = 1),
  title      text not null default 'Referendum për shfuqizimin e ligjit 21/2024',
  goal       integer not null default 50000,
  deadline   date,
  updated_at timestamptz not null default now()
);
insert into public.campaign (id) values (1) on conflict (id) do nothing;


-- ============================ MIGRIMET ======================================
-- Për bazat që ekzistojnë nga më parë. Çdo hap kontrollohet: rileximi i skedarit
-- nuk bën asgjë dy herë dhe NUK prek të dhënat.

-- Kolonat e reja të njësisë (zonat + hapja/mbyllja).
alter table public.units add column if not exists coordinator_id uuid;
alter table public.units add column if not exists opened_at timestamptz;
alter table public.units add column if not exists closed_at timestamptz;

-- `is_open`: njësitë që ekzistonin PARA këtij ndryshimi hapen automatikisht, që
-- fushata të mos ndalet në mes kur ngarkohet skema. Njësitë e reja nisin të
-- mbyllura — qendra i hap kur duhet. Ky bllok ekzekutohet vetëm një herë.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'units'
                    and column_name = 'is_open') then
    alter table public.units add column is_open boolean not null default true;
    alter table public.units alter column is_open set default false;
    -- `where opened_at is null` s'ndryshon asgjë këtu (kolona sapo u shtua,
    -- pra e kanë të gjitha bosh) — por e bën qëllimin të dukshëm dhe heq
    -- paralajmërimin e Supabase për UPDATE pa WHERE.
    update public.units set opened_at = now() where opened_at is null;
  end if;
end $$;

-- Lidhja njësi → koordinator. Shtohet këtu sepse `units` krijohet para `volunteers`.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'units_coordinator_fk') then
    alter table public.units
      add constraint units_coordinator_fk foreign key (coordinator_id)
      references public.volunteers on delete set null;
  end if;
end $$;

create index if not exists units_coord_idx on public.units (coordinator_id);

-- Rolet e reja (logjistikë, burime njerëzore, PR & edukim, IT) + roli i
-- kërkuar në regjistrim. Kolona shtohet për bazat ekzistuese; kufizimi i
-- `role` rikrijohet çdo herë (i lirë ta bësh disa herë, s'prek të dhëna).
alter table public.volunteers add column if not exists requested_role text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'volunteers_requested_role_check') then
    alter table public.volunteers drop constraint volunteers_requested_role_check;
  end if;
  alter table public.volunteers add constraint volunteers_requested_role_check
    check (requested_role is null or requested_role in
           ('ndihmes','mbledhes','koordinator','jurist',
            'logjistike','burime_njerezore','pr_edukim','it'));

  if exists (select 1 from pg_constraint where conname = 'volunteers_role_check') then
    alter table public.volunteers drop constraint volunteers_role_check;
  end if;
  alter table public.volunteers add constraint volunteers_role_check
    check (role in ('ndihmes','mbledhes','koordinator','jurist','admin',
                     'logjistike','burime_njerezore','pr_edukim','it'));
end $$;

-- Struktura Koordinator → Mbledhës → Ndihmës, për bazat ekzistuese.
alter table public.volunteers add column if not exists supervisor_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'volunteers_supervisor_fk') then
    alter table public.volunteers
      add constraint volunteers_supervisor_fk foreign key (supervisor_id)
      references public.volunteers on delete set null;
  end if;
end $$;
create index if not exists volunteers_supervisor_idx on public.volunteers (supervisor_id);

-- Turni i planifikuar ↔ check-in-i. Deri tani check-in-i bëhej kur t'i tekej
-- kujtdo, te çdo njësi e hapur. Tani ai i përket GJITHMONË një turni që e ka
-- hapur koordinatori ose mbledhësi i autorizuar: `shift_id` e lidh, dhe
-- `shifts.closed_at` shënon çastin kur udhëheqësi e mbylli turnin për gjithë ekipin.
alter table public.shifts   add column if not exists closed_at timestamptz;
alter table public.checkins add column if not exists shift_id  uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_shift_fk') then
    alter table public.checkins
      add constraint checkins_shift_fk foreign key (shift_id)
      references public.shifts on delete set null;
  end if;
end $$;
create index if not exists checkins_shift_idx on public.checkins (shift_id);


-- ============================ NDIHMËSIT E ROLEVE ============================
-- `security definer` → lexojnë volunteers pa u bllokuar nga RLS (pa rekursion).

create or replace function public.vol_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.volunteers where id = auth.uid();
$$;

create or replace function public.vol_status() returns text
language sql stable security definer set search_path = public as $$
  select status from public.volunteers where id = auth.uid();
$$;

create or replace function public.vol_is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_status() = 'approved', false);
$$;

-- "Stafi" = qendra + koordinatorët: shohin raportimet dhe miratojnë vullnetarë.
create or replace function public.vol_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_role() in ('koordinator','jurist','admin'), false)
     and public.vol_is_approved();
$$;

create or replace function public.vol_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_role() = 'admin', false) and public.vol_is_approved();
$$;

-- Qendra: admin + jurist. Shohin gjithçka, pa u kufizuar nga hierarkia.
create or replace function public.vol_is_center() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_role() in ('jurist','admin'), false) and public.vol_is_approved();
$$;

create or replace function public.vol_is_coordinator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_role() = 'koordinator', false) and public.vol_is_approved();
$$;

-- Zonat që mban koordinatori aktual. Baza e gjithë kufizimit të hierarkisë.
create or replace function public.vol_my_unit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.units where coordinator_id = auth.uid();
$$;

create or replace function public.vol_coordinates_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.units
                  where id = p_unit and coordinator_id = auth.uid());
$$;

-- A është njësia e hapur për mbledhje? Përdoret te kontrolli i check-in-it.
create or replace function public.vol_unit_is_open(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_open from public.units where id = p_unit), false);
$$;

-- "Qendra" e plotë — të gjitha rolet që NUK janë në terren (admin, jurist,
-- logjistikë, burime njerëzore, PR & edukim, IT). Ndryshe nga `vol_is_center()`
-- (vetëm admin + jurist, që kanë të drejta shkrimi), kjo përgjigjet pyetjes
-- "a i përket ky person ndonjë ekipi terreni?" — dhe përgjigjja është jo:
-- qendra i sheh turnet, por nuk planifikon dhe nuk bën check-in.
create or replace function public.vol_is_qendra() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.vol_role() in
           ('admin','jurist','logjistike','burime_njerezore','pr_edukim','it'), false)
     and public.vol_is_approved();
$$;

-- Zinxhiri im LART: unë, supervizori im, dhe supervizori i tij. Këta janë
-- udhëheqësit e mi — turnet që hapin ata janë turnet ku bëj pjesë. Struktura
-- ka vetëm tri shtresa (Koordinator → Mbledhës → Ndihmës), ndaj dy hapa mjaftojnë.
create or replace function public.vol_my_lead_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select v.id from public.volunteers v where v.id = auth.uid()
  union
  select v.supervisor_id from public.volunteers v
   where v.id = auth.uid() and v.supervisor_id is not null
  union
  select s.supervisor_id from public.volunteers v
   join public.volunteers s on s.id = v.supervisor_id
   where v.id = auth.uid() and s.supervisor_id is not null;
$$;

-- E gjithë dega ime: zinxhiri lart PLUS kush varet nga unë (mbledhësit e mi dhe
-- ndihmësit e tyre). Përdoret vetëm te Orari — koordinatori që "organizon
-- turnet" duhet të shohë edhe ç'kanë planifikuar mbledhësit e vet. Për
-- check-in-in mbetet `vol_my_lead_ids()`: hyn vetëm te turni i dikujt mbi ty.
create or replace function public.vol_my_team_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.vol_my_lead_ids() t(id)
  union
  select v.id from public.volunteers v where v.supervisor_id = auth.uid()
  union
  select w.id from public.volunteers w
   join public.volunteers v on v.id = w.supervisor_id
   where v.supervisor_id = auth.uid();
$$;

-- Kush planifikon turne, dhe ku: koordinatori VETËM te zonat që mban, mbledhësi
-- i autorizuar VETËM te zona e vet. Askush tjetër — as qendra. Ndarja sipas
-- rolit mbahet e rreptë me qëllim: ndryshe një koordinator i caktuar rastësisht
-- në një zonë do të planifikonte turne në territorin e një kolegu.
create or replace function public.vol_can_plan_unit(p_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.vol_is_approved()
     and coalesce(
           case public.vol_role()
             when 'koordinator' then public.vol_coordinates_unit(p_unit)
             when 'mbledhes'    then exists (select 1 from public.volunteers
                                              where id = auth.uid() and unit_id = p_unit)
             else false
           end, false);
$$;


-- ============================ REGJISTRIMI ===================================
-- Kur dikush hap llogari, krijohet automatikisht rreshti i vullnetarit
-- me status 'pending' — dikush nga qendra duhet ta miratojë.

create or replace function public.handle_new_volunteer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.volunteers (id, full_name, city, requested_role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'city', ''),
          coalesce(nullif(new.raw_user_meta_data->>'requested_role',''), 'ndihmes'))
  on conflict (id) do nothing;

  insert into public.volunteer_private (id, phone, email)
  values (new.id, nullif(new.raw_user_meta_data->>'phone',''), new.email)
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_volunteer_created on auth.users;
create trigger on_auth_volunteer_created
  after insert on auth.users
  for each row execute function public.handle_new_volunteer();


-- ============================ RLS ===========================================

alter table public.units             enable row level security;
alter table public.volunteers        enable row level security;
alter table public.volunteer_private enable row level security;
alter table public.announcements     enable row level security;
alter table public.materials         enable row level security;
alter table public.reports           enable row level security;
alter table public.checkins          enable row level security;
alter table public.campaign          enable row level security;
alter table public.shifts            enable row level security;
alter table public.shift_signups     enable row level security;
alter table public.change_requests   enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---- volunteers -----------------------------------------------------------
-- Rolin dhe statusin NUK i ndryshon dot askush nga aplikacioni: vetëm përmes
-- funksioneve vol_set_* më poshtë. Emri, qyteti dhe fotoja NUK redaktohen më
-- direkt pas plotësimit të parë — ndryshimi kalon nga `submit_change_request`
-- + miratimi i adminit (shih "KËRKESAT PËR NDRYSHIM"). E vetmja shkrirje e
-- lejuar direkt është `photo_path` HERËN E PARË (sa kolona është bosh) —
-- kufizuar te politika `vol_update_self` më poshtë, jo këtu.
revoke all on public.volunteers from anon, authenticated;
grant select on public.volunteers to authenticated;
grant update (photo_path) on public.volunteers to authenticated;

-- Kush sheh kë — sipas hierarkisë:
--   • vetveten                         → gjithmonë
--   • qendra (admin, jurist)           → të gjithë
--   • koordinatori                     → VETËM njerëzit e zonave të veta,
--                                        plus ata në pritje / pa njësi (që t'i
--                                        miratojë dhe t'i caktojë diku)
--   • vullnetari i thjeshtë            → vetëm vetveten
--
-- Kushti `role in ('ndihmes','mbledhes')` është me rëndësi: pa të, kolegët
-- koordinatorë do të dukeshin te njëri-tjetri, sepse koordinatori MBAN zona
-- dhe s'i përket asnjërës — pra `unit_id` e ka bosh, dhe do të binte brenda
-- përjashtimit "pa njësi". Kështu një koordinator sheh vetëm vullnetarë.
--
-- Vullnetarët nuk e lexojnë më njëri-tjetrin drejtpërdrejt. Emrat dhe fotot që
-- duhen për "kush është në terren" dhe për hartën jepen nga funksionet
-- `field_active()` / `shift_list()`, që kthejnë vetëm fusha të padëmshme.
drop policy if exists vol_select on public.volunteers;
create policy vol_select on public.volunteers for select to authenticated
  using (
    id = auth.uid()
    or public.vol_is_center()
    or (
      public.vol_is_coordinator()
      and role in ('ndihmes','mbledhes')
      and (
        unit_id in (select public.vol_my_unit_ids())
        or status = 'pending'
        or unit_id is null
      )
    )
  );

-- `photo_path is null` te USING: rreshti është "i redaktueshëm" nga vetë
-- personi VETËM sa kohë s'ka ende foto. Sapo kolona mbushet, e njëjta thirrje
-- (p.sh. dikush që provon të thërrasë update-in direkt nga konsola) prek zero
-- rreshta — mënyra reale për ta ndryshuar mbetet vetëm kërkesa te admini.
drop policy if exists vol_update_self on public.volunteers;
create policy vol_update_self on public.volunteers for update to authenticated
  using (id = auth.uid() and photo_path is null) with check (id = auth.uid());

-- ---- volunteer_private ----------------------------------------------------
-- Telefoni dhe kontakti i urgjencës ndjekin të njëjtin kufizim si hierarkia:
-- koordinatori sheh vetëm njerëzit e vet.
create or replace function public.vol_can_see_volunteer(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_id = auth.uid()
      or public.vol_is_center()
      or ( public.vol_is_coordinator()
           and exists (select 1 from public.volunteers v
                        where v.id = p_id
                          and v.role in ('ndihmes','mbledhes')
                          and ( v.unit_id in (select public.vol_my_unit_ids())
                                or v.status = 'pending'
                                or v.unit_id is null )) );
$$;

-- Vetëm lexim direkt (vetvetja + hierarkia, si më parë). Shkrimi (telefoni,
-- kontakti i urgjencës) nuk bëhet më direkt nga vullnetari — kalon nga
-- `submit_change_request` ('profile') + miratimi i adminit; rreshti fillestar
-- krijohet nga trigger-i i regjistrimit, që e anashkalon RLS-në.
revoke all on public.volunteer_private from anon, authenticated;
grant select on public.volunteer_private to authenticated;
drop policy if exists volp_all on public.volunteer_private;
drop policy if exists volp_select on public.volunteer_private;
create policy volp_select on public.volunteer_private for select to authenticated
  using (public.vol_can_see_volunteer(id));

-- ---- units ----------------------------------------------------------------
-- Të gjithë të miratuarit i lexojnë njësitë (u duhen për check-in dhe për
-- ecurinë në ballinë). Krijimi/fshirja dhe hapja/mbyllja janë vetëm të qendrës;
-- koordinatori mund të ndryshojë vetëm të dhënat e zonave të veta.
drop policy if exists units_read on public.units;
create policy units_read on public.units for select to authenticated
  using (public.vol_is_approved());

-- Hapja/mbyllja dhe caktimi i koordinatorit NUK preken dot nga aplikacioni:
-- vetëm përmes `unit_set_open` / `unit_set_coordinator`, që janë të qendrës.
-- Kështu koordinatori s'e hap dot vetë zonën e tij duke luajtur me kërkesat.
revoke all on public.units from anon, authenticated;
grant select, insert, delete on public.units to authenticated;
grant update (name, region, territory, target) on public.units to authenticated;

drop policy if exists units_write on public.units;
drop policy if exists units_insert on public.units;
drop policy if exists units_update on public.units;
drop policy if exists units_delete on public.units;
create policy units_insert on public.units for insert to authenticated
  with check (public.vol_is_admin());
create policy units_update on public.units for update to authenticated
  using (public.vol_is_admin() or public.vol_coordinates_unit(id))
  with check (public.vol_is_admin() or public.vol_coordinates_unit(id));
create policy units_delete on public.units for delete to authenticated
  using (public.vol_is_admin());

-- ---- announcements --------------------------------------------------------
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated
  using ( public.vol_is_approved() and (audience = 'all' or public.vol_is_staff()) );
drop policy if exists ann_write on public.announcements;
create policy ann_write on public.announcements for all to authenticated
  using (public.vol_is_staff()) with check (public.vol_is_staff());

-- ---- materials ------------------------------------------------------------
drop policy if exists mat_read on public.materials;
create policy mat_read on public.materials for select to authenticated
  using (public.vol_is_approved());
drop policy if exists mat_write on public.materials;
create policy mat_write on public.materials for all to authenticated
  using (public.vol_is_staff()) with check (public.vol_is_staff());

-- ---- reports --------------------------------------------------------------
-- Raportuesi sheh vetëm të vetat; qendra sheh dhe trajton të gjitha.
drop policy if exists rep_read on public.reports;
create policy rep_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.vol_is_staff());
drop policy if exists rep_insert on public.reports;
create policy rep_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.vol_is_approved());
drop policy if exists rep_update on public.reports;
create policy rep_update on public.reports for update to authenticated
  using (public.vol_is_staff()) with check (public.vol_is_staff());
drop policy if exists rep_delete on public.reports;
create policy rep_delete on public.reports for delete to authenticated
  using (public.vol_is_admin());

-- ---- checkins -------------------------------------------------------------
-- Të gjithë të miratuarit shohin kush është në terren tani (kjo është pika).
drop policy if exists chk_read on public.checkins;
create policy chk_read on public.checkins for select to authenticated
  using (public.vol_is_approved());

-- Check-in-i dhe check-out-i NUK bëhen më drejtpërdrejt nga aplikacioni: kalojnë
-- nga `shift_check_in` / `shift_check_out` / `checkin_close_own` (security
-- definer), të cilat kontrollojnë turnin, ekipin dhe orën. Pa këtë heqje
-- privilegjesh, kushdo do të mund të shkruante vetë numrin e nënshkrimeve nga
-- konsola — pikërisht ajo që rregulli "vetëm udhëheqësi raporton" ndalon.
revoke all on public.checkins from anon, authenticated;
grant select, delete on public.checkins to authenticated;
drop policy if exists chk_insert on public.checkins;
drop policy if exists chk_update on public.checkins;

-- Fshirja mbetet: dikush që bëri check-in gabimisht e heq të vetin, dhe
-- koordinatori/qendra pastron historikun.
drop policy if exists chk_delete on public.checkins;
create policy chk_delete on public.checkins for delete to authenticated
  using (volunteer_id = auth.uid() or public.vol_is_center() or public.vol_coordinates_unit(unit_id));

-- ---- shifts / shift_signups -----------------------------------------------
-- Turnet i planifikojnë VETËM koordinatori dhe mbledhësi i autorizuar — ata
-- udhëheqin ekipe në terren dhe ata mbajnë përgjegjësinë për turnin. Qendra i
-- sheh të gjitha por nuk planifikon: nuk i përket asnjë ekipi. Vullnetari i
-- terrenit sheh vetëm turnet e degës së vet (`vol_my_team_ids`).
revoke all on public.shifts from anon, authenticated;
grant select, delete on public.shifts to authenticated;
grant insert (unit_id, starts_at, ends_at, capacity, notes, created_by, created_by_name)
  on public.shifts to authenticated;

drop policy if exists sh_read on public.shifts;
create policy sh_read on public.shifts for select to authenticated
  using ( public.vol_is_qendra()
          or exists (select 1 from public.vol_my_team_ids() t(id) where t.id = created_by) );

-- `created_by = auth.uid()` te inserti: turni i mbetet gjithmonë atij që e hapi,
-- sepse më vonë vetëm ai e mbyll dhe raporton nënshkrimet.
drop policy if exists sh_write on public.shifts;
drop policy if exists sh_insert on public.shifts;
drop policy if exists sh_delete on public.shifts;
create policy sh_insert on public.shifts for insert to authenticated
  with check (created_by = auth.uid() and public.vol_can_plan_unit(unit_id));
create policy sh_delete on public.shifts for delete to authenticated
  using (created_by = auth.uid() or public.vol_is_admin());

-- Regjistrimi në turn kalon nga `shift_join` (kontrollon ekipin dhe kapacitetin).
revoke all on public.shift_signups from anon, authenticated;
grant select, delete on public.shift_signups to authenticated;

drop policy if exists su_read on public.shift_signups;
create policy su_read on public.shift_signups for select to authenticated
  using ( public.vol_is_qendra()
          or volunteer_id = auth.uid()
          or exists (select 1 from public.shifts s
                      where s.id = shift_id
                        and exists (select 1 from public.vol_my_team_ids() t(id)
                                     where t.id = s.created_by)) );
drop policy if exists su_insert on public.shift_signups;
drop policy if exists su_delete on public.shift_signups;
create policy su_delete on public.shift_signups for delete to authenticated
  using ( volunteer_id = auth.uid()
          or public.vol_is_center()
          or exists (select 1 from public.shifts s
                      where s.id = shift_id and s.created_by = auth.uid()) );

-- ---- campaign -------------------------------------------------------------
revoke all on public.campaign from anon, authenticated;
grant select on public.campaign to authenticated;
grant update (title, goal, deadline, updated_at) on public.campaign to authenticated;
drop policy if exists camp_read on public.campaign;
create policy camp_read on public.campaign for select to authenticated using (true);
drop policy if exists camp_write on public.campaign;
create policy camp_write on public.campaign for update to authenticated
  using (public.vol_is_admin()) with check (public.vol_is_admin());

-- ---- change_requests -------------------------------------------------------
-- Vetë personi sheh kërkesat e veta; admini i sheh të gjitha. Askush s'shkruan
-- drejtpërdrejt te tabela — vetëm përmes `submit_change_request` /
-- `review_change_request` (security definer), që kështu validojnë çdo rast.
revoke all on public.change_requests from anon, authenticated;
grant select on public.change_requests to authenticated;
drop policy if exists cr_select on public.change_requests;
create policy cr_select on public.change_requests for select to authenticated
  using (volunteer_id = auth.uid() or public.vol_is_admin());

-- ---- push_subscriptions ----------------------------------------------------
-- Secili sheh e heq vetëm pajisjet e veta. Shkrimi kalon nga `push_subscribe`,
-- që rreshti t'i mbetet gjithmonë atij që e krijoi: pa këtë, dikush mund të
-- regjistronte adresën e pajisjes së vet nën emrin e tjetrit dhe të merrte
-- njoftimet e destinuara për qendrën. Vetë dërgimi bëhet nga Edge Function-i
-- `send-push`, që punon me çelësin e shërbimit dhe i lexon të gjitha.
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select to authenticated
  using (volunteer_id = auth.uid());


-- ============================ VEPRIMET E QENDRËS ============================
-- Ndryshimi i statusit / rolit / njësisë bëhet vetëm këtu, me kontroll roli.

create or replace function public.vol_set_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_staff() then
    raise exception 'Nuk keni të drejtë ta bëni këtë veprim.';
  end if;
  if p_status not in ('pending','approved','suspended') then
    raise exception 'Status i pavlefshëm: %', p_status;
  end if;
  -- Koordinatori vepron vetëm mbi njerëzit e vet. Pa këtë, do të mjaftonte
  -- t'ia dinte id-në dikujt nga një zonë tjetër për ta pezulluar.
  if not public.vol_is_center() and not public.vol_can_see_volunteer(p_id) then
    raise exception 'Ky vullnetar nuk është në hierarkinë tuaj.';
  end if;
  update public.volunteers
     set status      = p_status,
         approved_at = case when p_status = 'approved' then now() else approved_at end,
         approved_by = case when p_status = 'approved' then auth.uid() else approved_by end
   where id = p_id;
end $$;

create or replace function public.vol_set_role(p_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini ndryshon rolet.';
  end if;
  if p_role not in ('ndihmes','mbledhes','koordinator','jurist','admin',
                     'logjistike','burime_njerezore','pr_edukim','it') then
    raise exception 'Rol i pavlefshëm: %', p_role;
  end if;
  update public.volunteers set role = p_role where id = p_id;
end $$;

-- Vendimi për një vullnetar TË RI (status 'pending') — vetëm admini, jo
-- koordinatori/juristi. Miratimi i vullnetarëve të rinj rri tërësisht te
-- faqja "Admin". Refuzimi thjesht e lë 'suspended', si më parë; nëse duhet
-- pezulluar/riaktivizuar dikë të MIRATUAR tashmë, kjo bëhet ende nga
-- `vol_set_status` te Paneli (staf, jo vetëm admin) — s'ka lidhje me këtë.
create or replace function public.vol_decide_pending(p_id uuid, p_approve boolean, p_role text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini vendos për vullnetarët e rinj.';
  end if;
  if p_approve and p_role is not null and p_role not in
     ('ndihmes','mbledhes','koordinator','jurist','admin',
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

-- Caktimi i njësisë. Koordinatori i shpërndan njerëzit VETËM brenda zonave
-- të veta; qendra kudo.
create or replace function public.vol_set_unit(p_id uuid, p_unit uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_staff() then
    raise exception 'Nuk keni të drejtë ta bëni këtë veprim.';
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
end $$;

-- Struktura Koordinator → Mbledhës → Ndihmës. E ndarë nga njësia/zona
-- (`unit_id`): kjo është zinxhiri i raportimit, jo territori. Vetëm mbledhësi
-- ka supervizor koordinator, dhe vetëm ndihmësi ka supervizor mbledhës —
-- çdo kombinim tjetër refuzohet, që pema të mos prishet me role të papërshtatshme.
create or replace function public.vol_set_supervisor(p_id uuid, p_supervisor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_sup_role text;
begin
  if not public.vol_is_staff() then
    raise exception 'Nuk keni të drejtë ta bëni këtë veprim.';
  end if;
  if not public.vol_is_center() and not public.vol_can_see_volunteer(p_id) then
    raise exception 'Ky vullnetar nuk është në hierarkinë tuaj.';
  end if;

  select role into v_role from public.volunteers where id = p_id;
  if v_role not in ('mbledhes','ndihmes') then
    raise exception 'Vetëm mbledhësit dhe ndihmësit kanë supervizor në këtë strukturë.';
  end if;

  if p_supervisor is not null then
    select role into v_sup_role from public.volunteers where id = p_supervisor;
    if v_role = 'mbledhes' and v_sup_role <> 'koordinator' then
      raise exception 'Mbledhësi mund të ketë supervizor vetëm një koordinator.';
    end if;
    if v_role = 'ndihmes' and v_sup_role <> 'mbledhes' then
      raise exception 'Ndihmësi mund të ketë supervizor vetëm një mbledhës.';
    end if;
  end if;

  update public.volunteers set supervisor_id = p_supervisor where id = p_id;
end $$;


-- ============================ KËRKESAT PËR NDRYSHIM =========================
-- Foto, të dhëna profili dhe zona nuk ndryshohen më drejtpërdrejt nga
-- vullnetari pas plotësimit të parë — propozohen këtu dhe shqyrtohen VETËM
-- nga admini, te faqja "Admin".

create or replace function public.submit_change_request(p_kind text, p_payload jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_me public.volunteers;
begin
  select * into v_me from public.volunteers where id = auth.uid();
  if v_me.id is null or v_me.status <> 'approved' then
    raise exception 'Vetëm vullnetarët e miratuar bëjnë kërkesa për ndryshim.';
  end if;
  if p_kind not in ('profile','photo','zone') then
    raise exception 'Lloj kërkese i pavlefshëm: %', p_kind;
  end if;
  if p_kind = 'photo' and v_me.photo_path is null then
    raise exception 'Ende s''keni foto — ngarkojeni direkt, s''ju duhet kërkesë.';
  end if;
  if p_kind = 'zone' then
    if v_me.unit_id is null then
      raise exception 'Ende s''keni zonë të caktuar.';
    end if;
    if v_me.role not in ('ndihmes','mbledhes') then
      raise exception 'Ndryshimin e zonës e propozojnë vetëm vullnetarët e terrenit.';
    end if;
  end if;
  if exists (select 1 from public.change_requests
              where volunteer_id = auth.uid() and kind = p_kind and status = 'pending') then
    raise exception 'Keni tashmë një kërkesë të këtij lloji në pritje.';
  end if;

  insert into public.change_requests (volunteer_id, kind, payload, note)
  values (auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb), nullif(trim(p_note),''))
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.submit_change_request(text, jsonb, text) to authenticated;

-- Admini vendos: mirato (dhe ndryshimi zbatohet vetë) ose refuzo. Fshirja e
-- fotos së vjetër nga storage bëhet nga klienti PARA këtij thirrjeje (njësoj
-- si `removePhoto` sot) — këtu thjesht zbrazet `photo_path`.
create or replace function public.review_change_request(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.change_requests;
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm admini shqyrton kërkesat për ndryshim.';
  end if;
  select * into r from public.change_requests where id = p_id for update;
  if not found then raise exception 'Kërkesa nuk ekziston.'; end if;
  if r.status <> 'pending' then raise exception 'Kjo kërkesë është shqyrtuar tashmë.'; end if;

  if p_approve then
    if r.kind = 'profile' then
      update public.volunteers
         set full_name = coalesce(r.payload->>'full_name', full_name),
             city       = nullif(r.payload->>'city', '')
       where id = r.volunteer_id;
      update public.volunteer_private
         set phone             = nullif(r.payload->>'phone', ''),
             emergency_contact = nullif(r.payload->>'emergency_contact', '')
       where id = r.volunteer_id;
    elsif r.kind = 'photo' then
      update public.volunteers set photo_path = null where id = r.volunteer_id;
    elsif r.kind = 'zone' then
      update public.volunteers set unit_id = (r.payload->>'unit_id')::uuid where id = r.volunteer_id;
    end if;
  end if;

  update public.change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), reviewed_note = nullif(trim(p_note),'')
   where id = p_id;
end $$;

grant execute on function public.review_change_request(uuid, boolean, text) to authenticated;


-- ============================ NJOFTIMET NË TELEFON ==========================
-- Pajisja regjistrohet dhe çregjistrohet vetëm përmes këtyre dy funksioneve.
-- `on conflict (endpoint)`: i njëjti telefon mund ta ndërrojë çelësin ose
-- përdoruesin (dikush tjetër hyn në po atë pajisje) — atëherë rreshti
-- rishkruhet, nuk shtohet një i dytë që do t'i çonte njoftimet te i pari.

create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_approved() then
    raise exception 'Vetëm vullnetarët e miratuar marrin njoftime.';
  end if;
  if coalesce(trim(p_endpoint),'') = '' or coalesce(trim(p_p256dh),'') = ''
     or coalesce(trim(p_auth),'') = '' then
    raise exception 'Të dhëna të paplota për njoftimet.';
  end if;

  insert into public.push_subscriptions (volunteer_id, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth), left(coalesce(p_agent,''), 300))
  on conflict (endpoint) do update
    set volunteer_id = auth.uid(),
        p256dh       = excluded.p256dh,
        auth_key     = excluded.auth_key,
        user_agent   = excluded.user_agent,
        last_seen_at = now();
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions
   where endpoint = p_endpoint and volunteer_id = auth.uid();
end $$;

grant execute on function public.push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.push_unsubscribe(text) to authenticated;


-- ---- njësitë: hapja/mbyllja dhe koordinatori (vetëm qendra) ----------------

create or replace function public.unit_set_open(p_unit uuid, p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm qendra i hap dhe i mbyll njësitë.';
  end if;
  update public.units
     set is_open   = p_open,
         opened_at = case when p_open then now() else opened_at end,
         closed_at = case when p_open then closed_at else now() end
   where id = p_unit;
end $$;

create or replace function public.unit_set_coordinator(p_unit uuid, p_coord uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm qendra cakton koordinatorët e zonave.';
  end if;
  if p_coord is not null
     and not exists (select 1 from public.volunteers
                      where id = p_coord and role in ('koordinator','admin')) then
    raise exception 'Zona i caktohet vetëm një koordinatori.';
  end if;
  update public.units set coordinator_id = p_coord where id = p_unit;
end $$;

-- Korrigjimi i historikut të një turni (vetëm qendra) — numri i firmave dhe orët.
create or replace function public.checkin_edit(
  p_id uuid, p_signatures integer, p_started timestamptz,
  p_ended timestamptz, p_unit uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vol_is_admin() then
    raise exception 'Vetëm qendra e ndryshon historikun.';
  end if;
  if p_signatures < 0 then
    raise exception 'Numri i firmave nuk mund të jetë negativ.';
  end if;
  if p_ended is not null and p_started is not null and p_ended < p_started then
    raise exception 'Mbarimi nuk mund të jetë para fillimit.';
  end if;
  update public.checkins
     set signatures = p_signatures,
         started_at = coalesce(p_started, started_at),
         ended_at   = p_ended,
         unit_id    = coalesce(p_unit, unit_id),
         notes      = p_notes
   where id = p_id;
end $$;


-- ============================ VERIFIKIMI PUBLIK =============================
-- Qytetari skanon QR-in e kartës → sheh foton, emrin dhe nëse është i vlefshëm.
-- Publik me qëllim, por kthen VETËM këto fusha — pa telefon, pa email.

create or replace function public.verify_volunteer(p_code text)
returns table (full_name text, volunteer_code text, photo_path text,
               unit_name text, region text, city text, role text, valid boolean)
language sql stable security definer set search_path = public as $$
  select v.full_name, v.volunteer_code, v.photo_path,
         u.name, u.region, v.city, v.role,
         (v.status = 'approved')
    from public.volunteers v
    left join public.units u on u.id = v.unit_id
   where upper(v.volunteer_code) = upper(trim(p_code));
$$;

grant execute on function public.verify_volunteer(text) to anon, authenticated;


-- ============================ STATISTIKAT ===================================

create or replace function public.campaign_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'signatures',    coalesce((select sum(signatures) from public.checkins), 0),
    'shifts',        (select count(*) from public.checkins),
    'active_shifts', (select count(*) from public.checkins where ended_at is null),
    'volunteers',    (select count(*) from public.volunteers where status = 'approved'),
    'pending',       (select count(*) from public.volunteers where status = 'pending'),
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

-- Progresi për çdo njësi (për tabelën në Ballinë dhe për listën e check-in-it).
-- Kolonat e kthyera ndryshuan (u shtuan `is_open` dhe koordinatori), ndaj duhet
-- hedhur e vjetra: Postgres nuk e lejon `create or replace` të ndryshojë tipin.
drop function if exists public.unit_totals();
create or replace function public.unit_totals()
returns table (id uuid, code text, name text, region text, territory text,
               target integer, is_open boolean, coordinator_id uuid,
               coordinator_name text, signatures bigint, members bigint)
language sql stable security definer set search_path = public as $$
  select u.id, u.code, u.name, u.region, u.territory, u.target,
         u.is_open, u.coordinator_id,
         -- Emri i koordinatorit del vetëm te qendra dhe te vetë ai. Ndryshe
         -- kushdo do t'i numëronte koordinatorët nga kjo listë, ndërkohë që
         -- politika e `volunteers` pikërisht këtë e ndalon.
         case when public.vol_is_center() or u.coordinator_id = auth.uid()
              then k.full_name end,
         coalesce((select sum(c.signatures) from public.checkins c where c.unit_id = u.id), 0),
         (select count(*) from public.volunteers v where v.unit_id = u.id and v.status = 'approved')
    from public.units u
    left join public.volunteers k on k.id = u.coordinator_id
   where public.vol_is_approved()
   order by u.code;
$$;


-- ============================ STRUKTURA =====================================
-- Diagrami i raportimit: Koordinator → Mbledhës → Ndihmës (i ndarë nga
-- njësia/zona, shih `supervisor_id`). Secili sheh vetëm degën e vet:
--   • Qendra (admin/jurist/logjistikë/burime njerëzore/PR & edukim/IT) → gjithçka
--   • Koordinatori   → veten, mbledhësit e vet, ndihmësit e atyre mbledhësve
--   • Mbledhësi      → koordinatorin e vet, veten, ndihmësit e vet
--   • Ndihmësi       → mbledhësin e vet, koordinatorin e atij mbledhësi, veten
-- `security definer` sepse kjo pamje shkon PËRTEJ politikës bazë të
-- `volunteers` (ndihmësi/mbledhësi tani mund të shohin pjesë të hierarkisë
-- që RLS-ja normalisht s'ua lejon) — njësoj si `field_active()`.
create or replace function public.struktura_tree()
returns table (id uuid, full_name text, role text, photo_path text,
               volunteer_code text, supervisor_id uuid)
language sql stable security definer set search_path = public as $$
  with me as (select id, role from public.volunteers where id = auth.uid())
  select v.id, v.full_name, v.role, v.photo_path, v.volunteer_code, v.supervisor_id
    from public.volunteers v, me
   where v.status = 'approved'
     and v.role in ('koordinator','mbledhes','ndihmes')
     and (
       me.role in ('admin','jurist','logjistike','burime_njerezore','pr_edukim','it')
       or (me.role = 'koordinator' and (
             v.id = me.id
             or (v.role = 'mbledhes' and v.supervisor_id = me.id)
             or (v.role = 'ndihmes' and v.supervisor_id in
                   (select id from public.volunteers where supervisor_id = me.id and role = 'mbledhes'))
       ))
       or (me.role = 'mbledhes' and (
             v.id = me.id
             or v.id = (select supervisor_id from public.volunteers where id = me.id)
             or (v.role = 'ndihmes' and v.supervisor_id = me.id)
       ))
       or (me.role = 'ndihmes' and (
             v.id = me.id
             or v.id = (select supervisor_id from public.volunteers where id = me.id)
             or v.id = (select supervisor_id from public.volunteers
                         where id = (select supervisor_id from public.volunteers where id = me.id))
       ))
     )
   order by v.full_name;
$$;

grant execute on function public.struktura_tree() to authenticated;


-- ============================ TERRENI DHE HARTA =============================
-- Kush po mbledh nënshkrime pikërisht tani, me vendndodhjen për hartën.
-- `security definer` sepse vullnetarët nuk e lexojnë më njëri-tjetrin
-- drejtpërdrejt: këtu dalin VETËM emri, fotoja, njësia dhe pika në hartë —
-- pa telefon, pa email, pa asgjë tjetër personale.
-- `role` u shtua që lista "Në terren tani", e cila tani i grupon njerëzit si
-- fytyra nën njësinë e tyre, ta tregojë rolin kur klikohet një fytyrë.
drop function if exists public.field_active();
create or replace function public.field_active()
returns table (checkin_id uuid, volunteer_name text, photo_path text,
               volunteer_code text, role text, unit_id uuid,
               unit_code text, unit_name text,
               location_name text, city text,
               lat double precision, lng double precision, started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(nullif(v.full_name,''), c.volunteer_name, 'Vullnetar'),
         v.photo_path, v.volunteer_code, v.role, c.unit_id, u.code, u.name,
         c.location_name, c.city, c.lat, c.lng, c.started_at
    from public.checkins c
    left join public.volunteers v on v.id = c.volunteer_id
    left join public.units      u on u.id = c.unit_id
   where c.ended_at is null
     and public.vol_is_approved()
   order by c.started_at desc;
$$;

-- Historiku i turneve sipas njësisë — faqja e qendrës.
-- `shift_id` dhe `is_lead` dalin këtu që admini të mos hutohet kur sheh disa
-- rreshta të të njëjtit turn ekipi: nënshkrimet i mban VETËM rreshti i
-- udhëheqësit, të tjerët rrinë me 0 që totali të mos dyfishohet.
drop function if exists public.unit_history();
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
   where public.vol_is_admin()
   order by c.started_at desc;
$$;

-- Turnet e MIA, me nënshkrimet e "kredituara". Te një turn ekipi numri real
-- rri vetëm te rreshti i udhëheqësit; këtu secilit i shfaqet totali i turnit
-- (`credited`), sepse ai është rezultati i punës së tij. Totali i fushatës
-- vazhdon të mblidhet nga `checkins.signatures` — pra numërohet një herë të vetme.
create or replace function public.my_checkins(p_limit integer default null)
returns table (id uuid, unit_id uuid, unit_code text, unit_name text, shift_id uuid,
               location_name text, city text,
               started_at timestamptz, ended_at timestamptz,
               signatures integer, credited integer, team_size integer,
               i_am_lead boolean, notes text)
language sql stable security definer set search_path = public as $$
  select c.id, c.unit_id, u.code, u.name, c.shift_id,
         c.location_name, c.city, c.started_at, c.ended_at, c.signatures,
         case when c.shift_id is null then c.signatures
              else coalesce((select sum(x.signatures)::integer from public.checkins x
                              where x.shift_id = c.shift_id), 0) end,
         case when c.shift_id is null then 1
              else (select count(*)::integer from public.checkins x
                     where x.shift_id = c.shift_id) end,
         (c.shift_id is null or s.created_by = auth.uid()),
         c.notes
    from public.checkins c
    left join public.units  u on u.id = c.unit_id
    left join public.shifts s on s.id = c.shift_id
   where c.volunteer_id = auth.uid()
     and public.vol_is_approved()
   order by c.started_at desc
   -- Pa argument kthehen TË GJITHA: ballina mbledh mbi këtë listë numrin
   -- "Nënshkrimet e mia", dhe një kufi i heshtur do ta tregonte të vogël.
   limit (case when coalesce(p_limit, 0) > 0 then p_limit end);
$$;

grant execute on function public.my_checkins(integer) to authenticated;


-- ============================ TURNET E PLANIFIKUARA =========================
-- Sa para fillimit të turnit hapet check-in-i. Njerëzit mbërrijnë pak më herët;
-- pa këtë hapësirë do të rrinin duke pritur orën e saktë. E njëjta vlerë
-- përsëritet te `index.html` (CHECKIN_GRACE_MIN) vetëm për tekstin në ekran —
-- vendimi merret KËTU, te `shift_check_in`.
create or replace function public.shift_grace() returns interval
language sql immutable as $$ select interval '15 minutes' $$;

-- Lista e turneve me numrin e të regjistruarve dhe emrat e tyre. Përsëri
-- `security definer`, që emrat të dalin pa hapur tabelën e vullnetarëve.
-- Kolonat u shtuan (udhëheqësi, gjendja, ekipi), ndaj funksioni hidhet e rikrijohet.
drop function if exists public.shift_list(timestamptz);
create or replace function public.shift_list(p_from timestamptz default null)
returns table (id uuid, unit_id uuid, unit_code text, unit_name text,
               starts_at timestamptz, ends_at timestamptz, capacity integer,
               notes text, created_by uuid, created_by_name text, created_by_role text,
               closed_at timestamptz, unit_is_open boolean,
               signed_count bigint, signed jsonb, i_am_in boolean,
               i_am_on_team boolean, i_can_manage boolean,
               checked_in_count bigint, signatures integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.unit_id, u.code, u.name, s.starts_at, s.ends_at, s.capacity,
         s.notes, s.created_by, s.created_by_name, k.role, s.closed_at, u.is_open,
         (select count(*) from public.shift_signups g where g.shift_id = s.id),
         -- Kush është regjistruar: emri, roli dhe fotoja, që orari t'i tregojë
         -- si fytyra. Vetëm këto tri fusha — asgjë tjetër personale, njësoj si
         -- te `field_active()`.
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
         -- "Në ekip" = turni u hap nga unë ose nga dikush MBI mua; vetëm atëherë
         -- regjistrohem dhe bëj check-in.
         exists (select 1 from public.vol_my_lead_ids() t(id) where t.id = s.created_by),
         (s.created_by = auth.uid() or public.vol_is_admin()),
         (select count(*) from public.checkins c where c.shift_id = s.id),
         coalesce((select sum(c.signatures)::integer from public.checkins c
                    where c.shift_id = s.id), 0)
    from public.shifts s
    join public.units u on u.id = s.unit_id
    left join public.volunteers k on k.id = s.created_by
   where public.vol_is_approved()
     and ( public.vol_is_qendra()
           or exists (select 1 from public.vol_my_team_ids() t(id) where t.id = s.created_by) )
     and s.ends_at >= coalesce(p_from, now() - interval '12 hours')
   order by s.starts_at;
$$;

grant execute on function public.shift_list(timestamptz) to authenticated;

-- NJË turn i vetëm për faqen "Terreni": ai që më intereson tani.
-- Radha e zgjedhjes:
--   1. turni ku kam një check-in TË HAPUR (jam në terren pikërisht tani);
--   2. turni i ardhshëm i paMbyllur i ekipit tim.
-- Udhëheqësi i sheh edhe turnet e veta që kaluan pa u mbyllur (deri 7 ditë):
-- pa këtë, një turn i harruar do të zhdukej nga ekrani dhe nënshkrimet e tij
-- nuk do të regjistroheshin kurrë.
drop function if exists public.my_next_shift();
create or replace function public.my_next_shift()
returns table (id uuid, unit_id uuid, unit_code text, unit_name text,
               starts_at timestamptz, ends_at timestamptz, capacity integer,
               notes text, created_by uuid, created_by_name text,
               unit_is_open boolean, signed_count bigint, signed jsonb,
               checked_in_count bigint,
               i_am_in boolean, i_am_checked_in boolean, i_am_lead boolean)
language sql stable security definer set search_path = public as $$
  with vis as (
    select s.* from public.shifts s
     where public.vol_is_approved()
       and exists (select 1 from public.vol_my_lead_ids() t(id) where t.id = s.created_by)
  ),
  pick as (
    select v.*, 0 as pri from vis v
     where exists (select 1 from public.checkins c
                    where c.shift_id = v.id and c.volunteer_id = auth.uid()
                      and c.ended_at is null)
    union all
    select v.*, 1 as pri from vis v
     where v.closed_at is null
       and ( v.ends_at >= now()
             or (v.created_by = auth.uid() and v.ends_at >= now() - interval '7 days') )
  )
  select p.id, p.unit_id, u.code, u.name, p.starts_at, p.ends_at, p.capacity,
         p.notes, p.created_by, p.created_by_name, u.is_open,
         (select count(*) from public.shift_signups g where g.shift_id = p.id),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'id',    g.volunteer_id,
                   'name',  coalesce(nullif(v.full_name,''), g.volunteer_name, 'Vullnetar'),
                   'role',  v.role,
                   'photo', v.photo_path) order by g.created_at), '[]'::jsonb)
            from public.shift_signups g
            left join public.volunteers v on v.id = g.volunteer_id
           where g.shift_id = p.id),
         (select count(*) from public.checkins c
           where c.shift_id = p.id and c.ended_at is null),
         exists (select 1 from public.shift_signups g
                  where g.shift_id = p.id and g.volunteer_id = auth.uid()),
         exists (select 1 from public.checkins c
                  where c.shift_id = p.id and c.volunteer_id = auth.uid() and c.ended_at is null),
         (p.created_by = auth.uid())
    from pick p
    join public.units u on u.id = p.unit_id
   order by p.pri, p.starts_at
   limit 1;
$$;

grant execute on function public.my_next_shift() to authenticated;

-- Check-in brenda një turni. Këtu mblidhen të gjitha rregullat që dikur nuk
-- ekzistonin: turni duhet të jetë i ekipit tim, ora duhet të ketë ardhur, dhe
-- njësia duhet të jetë e hapur nga qendra. Vendndodhja ruhet si më parë —
-- ndryshimi i vetëm është se nuk bëhet check-in kur t'i teket kujt.
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
  if v.role not in ('ndihmes','mbledhes','koordinator') then
    raise exception 'Check-in bëjnë vetëm ndihmësit, mbledhësit dhe koordinatorët e terrenit.';
  end if;

  select * into s from public.shifts where id = p_shift;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if s.closed_at is not null then raise exception 'Ky turn është mbyllur tashmë.'; end if;
  if not exists (select 1 from public.vol_my_lead_ids() t(id) where t.id = s.created_by) then
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

grant execute on function public.shift_check_in(uuid, double precision, double precision, text, text)
  to authenticated;

-- Mbyllja e turnit — vetëm koordinatori/mbledhësi që e hapi. Ai raporton sa
-- nënshkrime mblodhi EKIPI, dhe në atë çast turni mbaron për të gjithë.
--
-- Numri rri i tëri te rreshti i tij; rreshtat e ekipit mbyllen me 0. Kështu
-- "Turnet e mia" i tregon secilit totalin e turnit (shih `my_checkins`), ndërsa
-- "Progresi i fushatës" — që mbledh `checkins.signatures` — e numëron një herë.
create or replace function public.shift_check_out(
  p_shift uuid, p_signatures integer, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.shifts; v public.volunteers; v_open uuid;
begin
  select * into v from public.volunteers where id = auth.uid();
  if v.id is null or v.status <> 'approved' then
    raise exception 'Vetëm vullnetarët e miratuar mbyllin turne.';
  end if;
  if v.role not in ('koordinator','mbledhes') then
    raise exception 'Turnin e mbyllin vetëm koordinatorët dhe mbledhësit e autorizuar.';
  end if;
  if p_signatures is null or p_signatures < 0 then
    raise exception 'Numri i nënshkrimeve nuk mund të jetë negativ.';
  end if;

  select * into s from public.shifts where id = p_shift for update;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if s.created_by is distinct from auth.uid() then
    raise exception 'Turnin e mbyll vetëm ai që e hapi.';
  end if;
  if s.closed_at is not null then raise exception 'Ky turn është mbyllur tashmë.'; end if;

  select id into v_open from public.checkins
   where shift_id = p_shift and volunteer_id = auth.uid() and ended_at is null
   order by started_at limit 1;

  if v_open is null then
    -- Udhëheqësi mund ta ketë harruar check-in-in e vet. Turni ndodhi
    -- gjithsesi, ndaj nënshkrimet duhet të kenë ku të shkojnë.
    insert into public.checkins (volunteer_id, volunteer_name, unit_id, shift_id,
                                 location_name, started_at, ended_at, signatures, notes)
    values (auth.uid(), v.full_name, s.unit_id, s.id,
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

-- Mbyllja e një turni TË VJETËR, pa planifikim (`shift_id is null`) — nga
-- koha kur secili bënte check-in vetë. Ekziston që ata turne të mos mbeten
-- përgjithmonë të hapur dhe nënshkrimet e tyre të mos humbasin. Për turnet e
-- reja të ekipit nuk vlen: aty raporton vetëm udhëheqësi.
create or replace function public.checkin_close_own(
  p_id uuid, p_signatures integer, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.checkins;
begin
  if p_signatures is null or p_signatures < 0 then
    raise exception 'Numri i nënshkrimeve nuk mund të jetë negativ.';
  end if;
  select * into c from public.checkins where id = p_id for update;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if c.volunteer_id <> auth.uid() then
    raise exception 'Ky turn nuk është i juaji.';
  end if;
  if c.shift_id is not null then
    raise exception 'Këtë turn e mbyll koordinatori ose mbledhësi që e hapi.';
  end if;
  if c.ended_at is not null then raise exception 'Ky turn është mbyllur tashmë.'; end if;

  update public.checkins
     set ended_at = now(), signatures = p_signatures, notes = nullif(trim(p_notes),'')
   where id = p_id;
end $$;

grant execute on function public.checkin_close_own(uuid, integer, text) to authenticated;

-- Regjistrimi në turn ("do të vij"). Kapaciteti kontrollohet këtu, brenda një
-- transaksioni, që dy veta të mos zënë njëkohësisht vendin e fundit.
create or replace function public.shift_join(p_shift uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap integer; v_taken integer; v_ends timestamptz; v_closed timestamptz;
        v_by uuid; v_name text; v_role text;
begin
  if not public.vol_is_approved() then
    raise exception 'Vetëm vullnetarët e miratuar regjistrohen në turne.';
  end if;
  select full_name, role into v_name, v_role from public.volunteers where id = auth.uid();
  if v_role not in ('ndihmes','mbledhes','koordinator') then
    raise exception 'Në turne regjistrohen vetëm vullnetarët e terrenit.';
  end if;

  select capacity, ends_at, closed_at, created_by into v_cap, v_ends, v_closed, v_by
    from public.shifts where id = p_shift for update;
  if not found then raise exception 'Ky turn nuk ekziston.'; end if;
  if v_closed is not null then raise exception 'Ky turn është mbyllur.'; end if;
  if v_ends < now() then raise exception 'Ky turn ka mbaruar.'; end if;
  if not exists (select 1 from public.vol_my_lead_ids() t(id) where t.id = v_by) then
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

create or replace function public.shift_leave(p_shift uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.shift_signups
   where shift_id = p_shift and volunteer_id = auth.uid();
end $$;


-- ============================ STORAGE =======================================
-- vol-photos    → fotot e kartave. Publike: karta ekziston pikërisht që
--                 qytetari ta shohë kur skanon QR-in.
-- vol-materials → guide-book, fletë-palosje, formularë. Publike (shpërndahen).
-- vol-reports   → foto të incidenteve. PRIVAT: i sheh vetëm autori dhe qendra.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vol-photos','vol-photos', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vol-materials','vol-materials', true, 26214400,
        array['application/pdf','image/png','image/jpeg','image/webp',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vol-reports','vol-reports', false, 15728640,
        array['image/png','image/jpeg','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Fotot e kartave: lexon kushdo; ngarkon/fshin secili në dosjen e vet (userId/…).
drop policy if exists volph_read   on storage.objects;
drop policy if exists volph_write  on storage.objects;
drop policy if exists volph_delete on storage.objects;
create policy volph_read on storage.objects for select
  using (bucket_id = 'vol-photos');
create policy volph_write on storage.objects for insert to authenticated
  with check (bucket_id = 'vol-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy volph_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vol-photos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.vol_is_staff()));

-- Materialet: lexon kushdo; ngarkon/fshin vetëm qendra.
drop policy if exists volmat_read   on storage.objects;
drop policy if exists volmat_write  on storage.objects;
drop policy if exists volmat_delete on storage.objects;
create policy volmat_read on storage.objects for select
  using (bucket_id = 'vol-materials');
create policy volmat_write on storage.objects for insert to authenticated
  with check (bucket_id = 'vol-materials' and public.vol_is_staff());
create policy volmat_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vol-materials' and public.vol_is_staff());

-- Fotot e raportimeve: PRIVATE. Vetëm autori (dosja e vet) dhe qendra.
drop policy if exists volrep_read   on storage.objects;
drop policy if exists volrep_write  on storage.objects;
drop policy if exists volrep_delete on storage.objects;
create policy volrep_read on storage.objects for select to authenticated
  using (bucket_id = 'vol-reports'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.vol_is_staff()));
create policy volrep_write on storage.objects for insert to authenticated
  with check (bucket_id = 'vol-reports'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.vol_is_approved());
create policy volrep_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vol-reports'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.vol_is_staff()));


-- ============================ NË FUND =======================================
-- PostgREST e mban skemën në kujtesë. Pa këtë sinjal, funksionet e reja
-- (`shift_check_in`, `my_next_shift`, …) kthejnë 404 derisa ai të rifreskohet
-- vetë — dhe portali del i prishur pikërisht pasi skema u ngarkua me sukses.
notify pgrst, 'reload schema';


