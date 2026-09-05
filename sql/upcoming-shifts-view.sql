-- ============================================================================
-- TURNET E ARDHSHME — pamje publike për /api/shifts dhe faqen publike
--
-- PSE DUHET NJË PAMJE E DYTË
--
-- `public_signing_points` nis nga `checkins`:
--
--     from public.checkins c
--     join public.shifts   s on s.id = c.shift_id
--     join public.units    u on u.id = c.unit_id
--
-- Domethënë një pikë ekziston vetëm pasi një vullnetar ka bërë check-in me GPS.
-- Një turn i PLANIFIKUAR — rresht te `shifts` me `starts_at` në të ardhmen dhe
-- ende asnjë check-in — nuk prodhon asnjë rresht atje, dhe nuk është çështje
-- filtri kohor: te ajo pamje `id`-ja, koordinatat dhe `point_name` burojnë të
-- gjitha nga check-in-e që nuk kanë ndodhur ende.
--
-- Prandaj kjo pamje e dytë: turnet e planifikuara nuk janë vende, janë orare.
--
-- ÇFARË EKSPOZOHET (dhe çfarë jo)
--
-- Dalja është allowlist, e ndërtuar kolonë pas kolone. Nga `shifts` merren
-- `starts_at`, `ends_at` dhe `notes` (si `spot`). Mbeten jashtë me qëllim:
--
--   • `created_by_name` — emri i plotë i vullnetarit që hapi turnin. Kjo është
--     arsyeja kryesore pse tabela `shifts` nuk ekspozohet kurrë e drejtpërdrejtë.
--   • `created_by`      — UUID i vullnetarit.
--   • `capacity`        — sa vullnetarë priten; informacion operacional i
--                         brendshëm, pa vlerë për qytetarin.
--
-- ⚠️  `notes` → `spot` ËSHTË PUBLIK. Është pika e saktë e takimit që qytetari
-- sheh në faqe (p.sh. "te hyrja kryesore e parkut"). Portali e paralajmëron
-- vullnetarin te forma e turnit se ky tekst shfaqet publikisht, ndaj aty NUK
-- duhet të shkruhen emra, numra telefoni apo marrëveshje të brendshme. Nëse
-- doni ta mbyllni sërish, hiqni kolonën `spot` më poshtë dhe fushën `notes`
-- te `functions/api/shifts.js`.
--
-- Nuk ka koordinata: askush nuk ka mbërritur ende në terren, ndaj GPS nuk
-- ekziston. Faqja publike tregon emrin e zonës, pikën e takimit dhe orarin,
-- jo hartë.
--
-- Turni i planifikuar publikohet pavarësisht `u.is_open`: krijimi i turnit
-- është vendimi eksplicit që ai orar duhet të shfaqet. `is_open` vazhdon të
-- kontrollojë check-in-in në terren.
-- ============================================================================

create or replace view public.public_upcoming_shifts as
select
  -- ID e qëndrueshme dhe e paidentifikueshme, në të njëjtin format 16-hex që
  -- pret `cleanId()` te functions/api/shifts.js. Nuk është UUID i bazës, ndaj
  -- nuk i vihet sondë asnjë identifikues i brendshëm.
  left(md5(s.id::text), 16)                       as id,
  u.code                                          as unit_code,
  u.name                                          as unit_name,
  -- Titulli i zonës ku do të mblidhen firmat ('Tiranë, njësia bashkiake 5').
  nullif(trim(u.territory), '')                   as area,
  nullif(trim(u.region), '')                      as region,
  -- Emërtohen `opens_at`/`closes_at` që konsumatori të ketë të njëjtin
  -- fjalor si te `/api/points` dhe të mos mbajë dy harta fushash.
  s.starts_at                                     as opens_at,
  s.ends_at                                       as closes_at,
  -- Pika e saktë e takimit, e shkruar nga vullnetari te portali. PUBLIKE.
  nullif(trim(s.notes), '')                       as spot,
  -- Shtohet në fund që CREATE OR REPLACE VIEW të ruajë rendin e kolonave.
  s.time_zone                                     as time_zone
from public.shifts s
join public.units  u on u.id = s.unit_id
where s.closed_at is null        -- turni jo i mbyllur nga udhëheqësi
  and s.starts_at > now()        -- VETËM ato që nuk kanë nisur ende
order by s.starts_at, u.code;

comment on view public.public_upcoming_shifts is
  'Turnet e planifikuara që nuk kanë nisur, për /api/shifts dhe faqen publike. '
  'Ekspozon `spot` (= shifts.notes, pika e takimit) si tekst PUBLIK; pa '
  'created_by, created_by_name, capacity. Pa koordinata. '
  'Mos e ndrysho në security_invoker — anon nuk lexon shifts as units.';

-- Vetëm LEXIM, dhe vetëm i kësaj pamjeje. `anon` mbetet pa asnjë leje mbi
-- `shifts` e `units` — pamja është e vetmja dritare.
revoke all on public.public_upcoming_shifts from anon, authenticated;
grant select on public.public_upcoming_shifts to anon, authenticated;

-- PostgREST e mban skemën në kujtesë: pa këtë, `/rest/v1/public_upcoming_shifts`
-- kthen 404 derisa ai të rifreskohet vetë.
notify pgrst, 'reload schema';


-- ============================================================================
-- DIAGNOSTIKË — ekzekutojeni veç, nëse një turn nuk duket te faqja publike.
-- Tregon çdo turn të ardhshëm dhe pse hyn ose nuk hyn te pamja.
-- ============================================================================
-- select
--   u.code,
--   u.name,
--   s.starts_at,
--   s.closed_at is null                    as turni_i_hapur,
--   s.starts_at > now()                    as ende_pa_nisur,
--   (s.closed_at is null and s.starts_at > now())
--                                          as del_te_faqja
-- from public.shifts s
-- join public.units  u on u.id = s.unit_id
-- where s.ends_at > now()
-- order by s.starts_at;
