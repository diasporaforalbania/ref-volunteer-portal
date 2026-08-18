-- ============================================================================
-- REFERENDUMI — pgTAP Automated Security & RLS Test Suite
-- Run with pg_prove or Supabase CLI (`supabase test db`)
-- ============================================================================

begin;
select plan(10);

-- Test 1: Verify essential tables exist
select tables_are(
  'public',
  ARRAY[
    'units', 'volunteers', 'volunteer_private', 'change_requests',
    'announcements', 'materials', 'reports', 'checkins',
    'shifts', 'shift_signups', 'push_subscriptions', 'campaign'
  ],
  'All 12 core tables exist in schema public'
);

-- Test 2: Verify public.signature_totals view exists
select has_view('public', 'signature_totals', 'signature_totals view exists');

-- Test 3: Public counter view is readable by anonymous users
set local role anon;
select lives_ok(
  'select signatures, goal from public.signature_totals',
  'Anon role can query signature_totals without error'
);

-- Test 4: Volunteer private PII is blocked from anon
select throws_ok(
  'select * from public.volunteer_private',
  '42501',
  NULL,
  'Anon role is denied select on volunteer_private'
);

-- Test 5: Table mutations directly from authenticated role are blocked
set local role authenticated;
select throws_ok(
  'insert into public.volunteers (id, full_name) values (gen_random_uuid(), ''Infiltrator'')',
  '42501',
  NULL,
  'Direct table insert on volunteers is denied to authenticated role'
);

-- Test 6: Shift check-in RPC has search_path = public
select results_eq(
  $$ select proconfig from pg_proc where proname = 'shift_check_in' $$,
  $$ values (array['search_path=public']::text[]) $$,
  'shift_check_in enforces search_path = public'
);

-- Test 7: Role escalation RPC is SECURITY DEFINER
select results_eq(
  $$ select count(*)::integer from pg_proc where proname = 'vol_set_role' and prosecdef = true $$,
  $$ values (1) $$,
  'vol_set_role is marked SECURITY DEFINER'
);

-- Test 8: verify_volunteer RPC is executable by anon
set local role anon;
select lives_ok(
  'select * from public.verify_volunteer(''V-0000'')',
  'Anon role can execute verify_volunteer'
);

-- Test 9: Active checkin index exists
select has_index(
  'public',
  'checkins',
  'idx_checkins_active',
  'idx_checkins_active partial index exists on checkins'
);

-- Test 10: Unit started index exists
select has_index(
  'public',
  'checkins',
  'idx_checkins_unit_started',
  'idx_checkins_unit_started composite index exists on checkins'
);

select * from finish();
rollback;
