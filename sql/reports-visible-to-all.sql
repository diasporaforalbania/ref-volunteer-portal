-- ============================================================================
-- RAPORTIMET — të dukshme për çdo vullnetar të miratuar
--
-- Deri tani `rep_read` lejonte vetëm raportuesin dhe qendrën:
--
--     using (reporter_id = auth.uid() or public.vol_is_internal())
--
-- Ky skript e zgjeron leximin te ÇDO vullnetar i miratuar. Njoftimet NUK
-- ndryshojnë: raportimi vazhdon të njoftojë vetëm qendrën dhe koordinatorët
-- (shih INTERNAL_ROLES te functions/api/send-push.js).
--
-- ⚠️  LEXOJENI PARA SE TA EKZEKUTONI
--
-- Një raportim përmban emrin e raportuesit, tekstin e lirë të incidentit,
-- vendndodhjen e shkruar dhe koordinatat GPS të marra në çastin e dërgimit.
-- Pas këtij ndryshimi, ato i sheh i gjithë trupi i vullnetarëve — jo vetëm
-- qendra. Për një fushatë politike kjo do të thotë se një vullnetar që raporton
-- presion policor a konflikt bëhet i identifikueshëm te kushdo me llogari të
-- miratuar, përfshirë llogari të reja që qendra sapo i ka miratuar.
--
-- Nëse kjo nuk është ajo që doni, mos e ekzekutoni këtë skedar; politika
-- ekzistuese te schema.sql mbetet në fuqi.
--
-- Dy alternativa më të ngushta, nëse ju duhet vetëm transparenca e listës:
--   • lini `rep_read` si është dhe shtoni një pamje publike të agreguar
--     (numri i raportimeve sipas statusit), pa emra e pa koordinata;
--   • lejoni leximin e të gjithëve por fshihni `lat`, `lng` dhe `reporter_name`
--     me një pamje të veçantë, duke e lënë tabelën vetë të mbyllur.
--
-- Ekzekutohet me dorë te Supabase → SQL Editor, si çdo ndryshim tjetër skeme.
-- ============================================================================

begin;

drop policy if exists rep_read on public.reports;

-- Çdo vullnetar i miratuar i lexon të gjitha raportimet.
create policy rep_read on public.reports for select to authenticated
  using (public.vol_is_approved());

commit;

-- Kontroll pas ekzekutimit: duhet të kthejë saktësisht një rresht, me
-- qualifier-in `vol_is_approved()`.
--
--   select polname, pg_get_expr(polqual, polrelid) as using_expr
--     from pg_policy
--    where polrelid = 'public.reports'::regclass and polname = 'rep_read';
--
-- Shkrimi, përditësimi dhe fshirja NUK preken nga ky skript:
--   rep_insert  -> reporter_id = auth.uid() and vol_is_approved()
--   rep_update  -> vol_is_internal()
--   rep_delete  -> vol_is_admin()
