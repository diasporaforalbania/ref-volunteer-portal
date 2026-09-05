import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');

const functionBody = (name) => {
  const start = schema.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `${name} is missing`);
  const nextFunction = schema.indexOf('\ncreate or replace function public.', start + 1);
  const end = nextFunction === -1 ? schema.length : nextFunction;
  assert.notEqual(end, -1, `${name} body is incomplete`);
  return schema.slice(start, end);
};

describe('shift visibility follows the selected unit, not the creator', () => {
  it('allows approved unit members and assigned coordinators', () => {
    const access = functionBody('vol_can_access_shift_unit');
    assert.match(access, /v\.unit_id = p_unit/);
    assert.match(access, /vol_coordinates_unit\(p_unit\)/);
    assert.match(access, /vol_is_approved\(\)/);
  });

  it('uses unit access for shift lists, registration, and check-in', () => {
    assert.match(functionBody('shift_list'), /vol_can_access_shift_unit\(s\.unit_id\)/);
    assert.match(functionBody('my_next_shift'), /vol_can_access_shift_unit\(s\.unit_id\)/);
    assert.match(functionBody('shift_join'), /vol_can_access_shift_unit\(v_unit\)/);
    assert.match(functionBody('shift_check_in'), /vol_can_access_shift_unit\(s\.unit_id\)/);
  });

  it('keeps upcoming shifts public without depending on created_by', () => {
    const viewStart = schema.indexOf('create or replace view public.public_upcoming_shifts');
    const viewEnd = schema.indexOf('comment on view public.public_upcoming_shifts', viewStart);
    const view = schema.slice(viewStart, viewEnd);
    assert.match(view, /s\.unit_id/);
    assert.doesNotMatch(view, /created_by/);
    assert.doesNotMatch(view, /and u\.is_open/);
  });
});
