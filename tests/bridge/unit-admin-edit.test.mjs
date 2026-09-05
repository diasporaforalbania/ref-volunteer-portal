import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../../src/views/panel.ts', import.meta.url), 'utf8');

describe('admin organizational-unit editing', () => {
  it('enforces admin authorization and validates every editable field in SQL', () => {
    const start = schema.indexOf('create or replace function public.unit_update(');
    const end = schema.indexOf('create or replace function public.unit_delete(', start);
    const fn = schema.slice(start, end);
    assert.match(fn, /if not public\.vol_is_admin\(\)/);
    for (const field of ['code', 'name', 'region', 'territory', 'target']) {
      assert.match(fn, new RegExp(`${field}\\s*=`));
    }
    assert.match(fn, /set search_path = public/);
    assert.match(schema, /revoke all on function public\.unit_update/);
  });

  it('provides one admin form for code, name, region, territory, and target', () => {
    for (const id of ['eu_code', 'eu_name', 'eu_region', 'eu_territory', 'eu_target']) {
      assert.match(panel, new RegExp(`id="${id}"`));
    }
    assert.match(panel, /sb\.rpc\('unit_update'/);
  });
});
