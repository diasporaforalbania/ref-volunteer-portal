import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  onRequestGet,
  sanitizePoint,
  sanitizePoints,
} from '../../functions/api/points.js';

const ALLOWED_KEYS = [
  'id',
  'unit_code',
  'unit_name',
  'point_name',
  'city',
  'lat',
  'lng',
  'opens_at',
  'closes_at',
];

const VALID_ID = 'a1b2c3d4e5f60718';

function row(overrides = {}) {
  return {
    id: VALID_ID,
    unit_code: 'A1',
    unit_name: 'Bulevardi',
    point_name: 'Sheshi Skënderbej',
    city: 'Tiranë',
    lat: 41.328,
    lng: 19.819,
    opens_at: '2026-08-18T08:00:00.000Z',
    closes_at: '2026-08-18T18:00:00.000Z',
    ...overrides,
  };
}

async function callWithUpstream(rows, env) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const request = new Request('https://portal.referendum21.org/api/points', {
      headers: { Origin: 'https://referendum21.org' },
    });
    return await onRequestGet({
      request,
      env: env || { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'k' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('Suite 7: /api/points — Zero-PII output contract', () => {
  it('drops every sensitive column injected by upstream', async () => {
    const poisoned = row({
      // Everything below is what must never reach the public site.
      volunteer_id: '3f1c9a6e-0000-4000-8000-000000000001',
      volunteer_name: 'Ana Kelmendi',
      volunteer_code: 'V-0042',
      photo_path: '3f1c9a6e/avatar.jpg',
      phone: '+355691112233',
      email: 'ana@example.com',
      signatures: 137,
      active_volunteers: 4,
      checkin_id: '9c2b1d4a-0000-4000-8000-000000000002',
      notes: 'Shënime të brendshme të turnit',
      supervisor_id: '11111111-1111-1111-1111-111111111111',
    });

    const response = await callWithUpstream([poisoned]);
    assert.strictEqual(response.status, 200);

    const payload = await response.json();
    assert.deepStrictEqual(Object.keys(payload).sort(), [
      'count',
      'generated_at',
      'points',
    ]);
    assert.strictEqual(payload.count, 1);

    const point = payload.points[0];
    assert.deepStrictEqual(Object.keys(point).sort(), [...ALLOWED_KEYS].sort());

    const serialized = JSON.stringify(payload);
    for (const forbidden of [
      'Ana Kelmendi',
      'V-0042',
      'avatar.jpg',
      '+355691112233',
      'ana@example.com',
      '137',
      'checkin_id',
      'supervisor_id',
      'Shënime',
    ]) {
      assert.ok(
        !serialized.includes(forbidden),
        `response must not contain ${forbidden}`
      );
    }
  });

  it('exposes no volunteer headcount, even aggregated', async () => {
    const response = await callWithUpstream([row({ active_volunteers: 9, members: 9 })]);
    const point = (await response.json()).points[0];
    assert.strictEqual(point.active_volunteers, undefined);
    assert.strictEqual(point.members, undefined);
  });

  it('rounds coordinates to 3 decimals so a person cannot be pinpointed', () => {
    const point = sanitizePoint(row({ lat: 41.3281234567, lng: 19.8186987654 }));
    assert.strictEqual(point.lat, 41.328);
    assert.strictEqual(point.lng, 19.819);
  });

  it('rejects out-of-range and non-numeric coordinates', () => {
    assert.strictEqual(sanitizePoint(row({ lat: 91 })), null);
    assert.strictEqual(sanitizePoint(row({ lat: -91 })), null);
    assert.strictEqual(sanitizePoint(row({ lng: 181 })), null);
    assert.strictEqual(sanitizePoint(row({ lng: -181 })), null);
    assert.strictEqual(sanitizePoint(row({ lat: 'abc' })), null);
    assert.strictEqual(sanitizePoint(row({ lat: null })), null);
    assert.strictEqual(sanitizePoint(row({ lng: undefined })), null);
    assert.strictEqual(sanitizePoint(row({ lat: Infinity })), null);
    assert.strictEqual(sanitizePoint(row({ lat: NaN })), null);
  });

  it('rejects rows whose id is not the expected 16-char hex digest', () => {
    assert.strictEqual(sanitizePoint(row({ id: 'not-a-digest' })), null);
    // A raw internal UUID must never be accepted as an id.
    assert.strictEqual(
      sanitizePoint(row({ id: '3f1c9a6e-0000-4000-8000-000000000001' })),
      null
    );
    assert.strictEqual(sanitizePoint(row({ id: 'A1B2C3D4E5F60718' })), null); // uppercase
    assert.strictEqual(sanitizePoint(row({ id: 'a1b2c3' })), null); // too short
    assert.strictEqual(sanitizePoint(row({ id: null })), null);
  });

  it('strips angle brackets and control characters from human-typed text', () => {
    const point = sanitizePoint(
      row({
        point_name: '<img src=x onerror=alert(1)>Sheshi',
        city: 'Tira\u0000n\u001Fe',
      })
    );
    assert.ok(!point.point_name.includes('<'));
    assert.ok(!point.point_name.includes('>'));
    assert.strictEqual(point.point_name, 'img src=x onerror=alert(1)Sheshi');
    assert.ok(!/[\u0000-\u001F\u007F]/.test(point.city));
    assert.strictEqual(point.city, 'Tira n e');
  });

  it('clamps absurdly long text fields', () => {
    const point = sanitizePoint(
      row({ point_name: 'x'.repeat(5000), city: 'y'.repeat(5000) })
    );
    assert.ok(point.point_name.length <= 160);
    assert.ok(point.city.length <= 80);
  });

  it('drops rows with no usable point name', () => {
    assert.strictEqual(sanitizePoint(row({ point_name: '' })), null);
    assert.strictEqual(sanitizePoint(row({ point_name: '   ' })), null);
    assert.strictEqual(sanitizePoint(row({ point_name: null })), null);
    assert.strictEqual(sanitizePoint(row({ point_name: '<<>>' })), null);
  });

  it('normalises invalid timestamps to null instead of echoing them', () => {
    const point = sanitizePoint(row({ opens_at: 'yesterday', closes_at: 12345 }));
    assert.strictEqual(point.opens_at, null);
    assert.strictEqual(point.closes_at, null);
  });

  it('caps the number of points to protect the consumer', () => {
    const many = Array.from({ length: 500 }, () => row());
    assert.strictEqual(sanitizePoints(many).length, 200);
  });

  it('survives a malformed upstream body without throwing', async () => {
    assert.deepStrictEqual(sanitizePoints(null), []);
    assert.deepStrictEqual(sanitizePoints('not an array'), []);
    assert.deepStrictEqual(sanitizePoints([null, undefined, 42, 'x', {}]), []);

    const response = await callWithUpstream({ unexpected: 'object' });
    assert.strictEqual(response.status, 200);
    const payload = await response.json();
    assert.deepStrictEqual(payload.points, []);
    assert.strictEqual(payload.count, 0);
  });

  it('sets caching and hardening headers', async () => {
    const response = await callWithUpstream([row()]);
    assert.match(response.headers.get('Cache-Control'), /max-age=60/);
    assert.match(response.headers.get('Cache-Control'), /s-maxage=60/);
    assert.strictEqual(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.strictEqual(response.headers.get('X-Robots-Tag'), 'noindex');
    assert.match(response.headers.get('Content-Type'), /application\/json/);
  });

  it('returns an empty list rather than an error when nothing is active', async () => {
    const response = await callWithUpstream([]);
    assert.strictEqual(response.status, 200);
    const payload = await response.json();
    assert.deepStrictEqual(payload.points, []);
    assert.strictEqual(payload.count, 0);
    assert.ok(payload.generated_at);
  });
});
