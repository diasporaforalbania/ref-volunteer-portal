import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeShift } from '../../functions/api/shifts.js';

const row = {
  id: '0123456789abcdef',
  unit_code: 'TR-1',
  unit_name: 'Tiranë',
  area: 'Qendër',
  region: 'Tiranë',
  opens_at: '2026-09-05T08:00:00.000Z',
  closes_at: '2026-09-05T10:00:00.000Z',
  spot: 'Hyrja kryesore',
};

describe('/api/shifts — time zone and Zero-PII contract', () => {
  it('keeps an allowed IANA time zone', () => {
    assert.equal(sanitizeShift({ ...row, time_zone: 'America/Los_Angeles' }).time_zone, 'America/Los_Angeles');
  });

  it('defaults missing or unapproved zones to Central European time', () => {
    assert.equal(sanitizeShift(row).time_zone, 'Europe/Tirane');
    assert.equal(sanitizeShift({ ...row, time_zone: '<script>' }).time_zone, 'Europe/Tirane');
  });

  it('never copies private or internal fields from upstream', () => {
    const result = sanitizeShift({
      ...row,
      time_zone: 'Europe/London',
      created_by: 'private-id',
      created_by_name: 'Private Name',
      capacity: 20,
      phone: '+355000000',
    });
    assert.deepEqual(Object.keys(result).sort(), [
      'area', 'closes_at', 'id', 'opens_at', 'region', 'spot',
      'time_zone', 'unit_code', 'unit_name',
    ].sort());
  });
});
