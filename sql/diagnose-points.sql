-- ============================================================================
-- DIAGNOSTIKË: pse `/api/points` kthen listë bosh?
--
-- Pamja `public_signing_points` kërkon SEI kushte njëherësh. Kjo query i tregon
-- të gjashtë veç e veç për çdo check-in, që të dukshëm cili po e heq rreshtin.
-- Vetëm LEXIM — nuk ndryshon asgjë.
--
-- Ekzekutoje si pronar (SQL Editor te Supabase), NUK si `anon`.
-- ============================================================================

select
  u.code                                       as njesia,
  coalesce(nullif(trim(c.location_name), ''), '(bosh)') as pika,
  c.volunteer_name                             as vullnetari,
  c.lat,
  c.lng,
  to_char(s.ends_at, 'DD Mon HH24:MI')         as turni_mbaron,

  -- ---- gjashtë kushtet e pamjes, në rend ----
  (c.ended_at is null)                          as "1_checkin_hapur",
  (c.shift_id is not null)                      as "2_lidhur_me_turn",
  (s.closed_at is null)                         as "3_turni_hapur",
  coalesce(u.is_open, false)                    as "4_njesia_hapur",
  (now() < s.ends_at)                           as "5_brenda_orarit",
  (c.lat is not null and c.lng is not null)     as "6_ka_gps",

  -- ---- verdikti ----
  case
    when c.ended_at is not null                 then 'HEQET: check-in i mbyllur'
    when c.shift_id is null                     then 'HEQET: check-in pa turn (i vjeter)'
    when s.closed_at is not null                then 'HEQET: turni u mbyll'
    when not coalesce(u.is_open, false)         then 'HEQET: njesia e mbyllur -> hape te Paneli'
    when now() >= s.ends_at                     then 'HEQET: ora e turnit kaloi'
    when c.lat is null or c.lng is null         then 'HEQET: pa GPS -> lejo vendndodhjen dhe bej check-in te ri'
    else                                             'DUKET NE KARTA'
  end                                           as verdikti

from public.checkins c
left join public.shifts s on s.id = c.shift_id
left join public.units  u on u.id = c.unit_id
order by c.started_at desc
limit 20;
