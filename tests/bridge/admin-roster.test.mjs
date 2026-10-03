import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
const repair = readFileSync(new URL('../../fix-user-profile.sql', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../../src/views/admin.ts', import.meta.url), 'utf8');

describe('admin roster entry security', () => {
  it('keeps ordinary account signup pending with the default helper role', () => {
    const signup = schema.slice(
      schema.indexOf('create or replace function public.handle_new_volunteer()'),
      schema.indexOf('drop trigger if exists on_auth_volunteer_created'),
    );
    assert.match(signup, /insert into public\.volunteers \(id, full_name, city, requested_role\)/);
    assert.doesNotMatch(signup, /(?:role|status|roster_only)\s*=/);
  });

  it('requires an approved admin in the database and isolates contact fields', () => {
    for (const sql of [schema, repair]) {
      const start = sql.indexOf('create or replace function public.vol_create_roster(');
      assert.ok(start >= 0);
      const fn = sql.slice(start, sql.indexOf('end $$;', start));
      assert.match(fn, /security definer set search_path = public/);
      assert.match(fn, /if not public\.vol_is_admin\(\)/);
      assert.match(fn, /insert into public\.volunteers[\s\S]*roster_only/);
      assert.match(fn, /insert into public\.volunteer_private[\s\S]*phone, email, emergency_contact, note/);
      assert.match(sql, /revoke all on function public\.vol_create_roster\([^\n]+\) from public, anon;/);
      assert.match(sql, /grant execute on function public\.vol_create_roster\([^\n]+\) to authenticated;/);
    }
  });

  it('uses the admin RPC and marks entries that have no login', () => {
    assert.match(admin, /sb\.rpc\('vol_create_roster'/);
    assert.match(admin, /v\.roster_only \? '<span class="pill gray">Pa llogari<\/span>'/);
  });
});
