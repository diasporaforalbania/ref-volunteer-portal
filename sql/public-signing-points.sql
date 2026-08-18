-- ============================================================================
-- PIKAT PUBLIKE TË NËNSHKRIMIT — burimi i vetëm i `GET /api/points`
--
-- Kartat te faqja publike ("Ku të nënshkruani") shfaqin ku ndodhen AKTUALISHT
-- stendat e mbledhjes. Vendndodhja e vetme që ekziston në bazë është ajo e
-- marrë nga GPS-i në çastin e check-in-it (`checkins.lat/lng`), ndaj kjo pamje
-- ndërtohet mbi check-in-et e hapura.
--
-- Rregullat e sigurisë të zbatuara KËTU, jo te fronti dhe jo te endpointi:
--
--   1. ZERO PII. Nuk del asnjë `volunteer_id`, emër, kod vullnetari, foto,
--      numër nënshkrimesh, as `checkin_id`. Vetëm pika dhe orari.
--   2. ZERO NUMËRIM. Nuk del sa veta janë në një pikë. Për një fushatë politike
--      ky numër është informacion operativ: tregon publikisht sa dobët mbulohet
--      një pikë në një moment të dhënë.
--   3. AGREGIM, NUK ËSHTË GJURMIM. Rreshtat grupohen sipas (njësi, pikë, qytet)
--      dhe koordinatat mesatarizohen. Pesë vullnetarë në një stendë = 1 rresht,
--      i palidhur nga secili prej tyre.
--   4. PRECIZION I ULUR. Koordinatat rrumbullakosen në 3 dhjetore (~110 m).
--      Mjafton për "Merr drejtimet" te qoshja e duhur; nuk mjafton për të
--      pikasur një person mbi trotuar. Ndrysho `3` më poshtë vetëm me vetëdije.
--   5. SKADIM AUTOMATIK. Një check-in i lënë hapur (udhëheqësi harroi ta
--      mbyllte) NUK e mban kartën gjallë përjetë: `now() < s.ends_at` e heq
--      pikën sapo kalon ora e turnit. Dështimi shkon nga ana e sigurt.
--
-- E sigurt për rileximin: `create or replace`, nuk prek të dhëna.
-- ============================================================================

-- ⚠ MOS shto `with (security_invoker = true)`.
-- Pamja duhet të ekzekutohet me privilegjet e PRONARIT (si `signature_totals`),
-- sepse `checkins` ka RLS që kërkon `vol_is_approved()` — vizitori anonim nuk
-- e lexon dot tabelën. Me `security_invoker = true` pamja do të kthente
-- gjithmonë zero rreshta për `anon`, dhe kartat do të dukeshin bosh.
create or replace view public.public_signing_points as
with active as (
  select
    u.code                                              as unit_code,
    u.name                                              as unit_name,
    -- Emri i pikës: teksti që shkroi vullnetari te check-in-i, ose shënimi i
    -- turnit, ose — si rrugë e fundit — emri i njësisë. Kurrë bosh.
    coalesce(nullif(trim(c.location_name), ''), u.name)  as point_name,
    nullif(trim(c.city), '')                            as city,
    c.lat,
    c.lng,
    s.starts_at,
    s.ends_at
  from public.checkins c
  join public.shifts   s on s.id = c.shift_id
  join public.units    u on u.id = c.unit_id
  where c.ended_at  is null      -- turni i personit ende i hapur
    and s.closed_at is null      -- turni i ekipit ende i hapur
    and u.is_open                -- njësia e hapur nga qendra
    and now() < s.ends_at        -- ora e turnit ende brenda (shih rregullin 5)
    -- Pa koordinata nuk ka kartë: GPS-i mund të jetë refuzuar ose të ketë
    -- skaduar te `getLocation()`. Këta check-in-e janë të vlefshëm për
    -- portalin, por të papërdorshëm për hartën publike.
    and c.lat is not null
    and c.lng is not null
    and c.lat between  -90 and  90
    and c.lng between -180 and 180
)
select
  -- ID e stabil dhe e paidentifikueshme, për `key` te fronti. Prejardhur nga
  -- emri i pikës, nuk është identifikues i bazës — kështu nuk ekspozohet
  -- asnjë UUID i brendshëm që mund t'i vihej sonda.
  left(md5(a.unit_code || '|' || a.point_name || '|' || coalesce(a.city, '')), 16)
                                                        as id,
  a.unit_code,
  a.unit_name,
  a.point_name,
  a.city,
  round(avg(a.lat)::numeric, 3)::double precision        as lat,
  round(avg(a.lng)::numeric, 3)::double precision        as lng,
  min(a.starts_at)                                       as opens_at,
  max(a.ends_at)                                         as closes_at
from active a
group by a.unit_code, a.unit_name, a.point_name, a.city
order by a.unit_code, a.point_name;

comment on view public.public_signing_points is
  'Pikat aktive të nënshkrimit për /api/points dhe faqen publike. '
  'Agregat, zero-PII, koordinata të rrumbullakosura në ~110 m. '
  'Mos e ndrysho në security_invoker — anon nuk lexon checkins.';

-- Vetëm LEXIM, dhe vetëm i kësaj pamjeje. `anon` mbetet pa asnjë leje mbi
-- `checkins`, `shifts`, `units` — pamja është e vetmja dritare.
revoke all on public.public_signing_points from anon, authenticated;
grant select on public.public_signing_points to anon, authenticated;

-- PostgREST e mban skemën në kujtesë: pa këtë, `/rest/v1/public_signing_points`
-- kthen 404 derisa ai të rifreskohet vetë.
notify pgrst, 'reload schema';
