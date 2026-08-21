import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../../functions/api/count.js';

describe('Suite 4: Zero-PII Payload & Upstream Sanitization', () => {
  it('should return strict integer fields and ISO date format from upstream', async () => {
    // Mock global fetch for upstream Supabase PostgREST
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify([{
        signatures: 24150,
        goal: 50000,
        week: 1420.9,
        updated: '2026-08-18T00:30:00.000Z',
        // Injected malicious/sensitive internal columns
        volunteer_id: 'vol_secret_123',
        full_name: 'Audit Infiltrator',
        phone: '+355691112233',
        notes: 'Secret internal field notes'
      }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const request = new Request('https://portal.referendum21.org/api/count', {
        headers: { 'Origin': 'https://referendum21.org' }
      });

      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key'
      };

      const response = await onRequestGet({ request, env });
      assert.strictEqual(response.status, 200);

      const payload = await response.json();

      // Strict allowed keys only
      const keys = Object.keys(payload).sort();
      assert.deepStrictEqual(keys, ['generated_at', 'goal', 'signatures', 'updated', 'week']);

      // Validate numeric types
      assert.strictEqual(payload.signatures, 24150);
      assert.strictEqual(payload.goal, 50000);
      assert.strictEqual(payload.week, 1420);
      assert.strictEqual(payload.updated, '2026-08-18T00:30:00.000Z');
      assert.ok(payload.generated_at);

      // Verify no PII fields leaked
      assert.strictEqual(payload.volunteer_id, undefined);
      assert.strictEqual(payload.full_name, undefined);
      assert.strictEqual(payload.phone, undefined);
      assert.strictEqual(payload.notes, undefined);

      // Verify Security & Caching Headers
      assert.strictEqual(response.headers.get('Cache-Control'), 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
      assert.strictEqual(response.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.ok(response.headers.get('Vary').includes('Origin'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return safe opaque error on upstream failures without leaking SQL errors', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        code: '42P01',
        message: 'relation "public.signature_totals" does not exist',
        hint: 'Table missing on internal server'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      const request = new Request('https://portal.referendum21.org/api/count', {
        headers: { 'Origin': 'https://referendum21.org' }
      });

      const env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-anon-key'
      };

      const response = await onRequestGet({ request, env });
      assert.strictEqual(response.status, 502);

      const body = await response.json();
      assert.strictEqual(body.error, 'upstream_unavailable');
      assert.strictEqual(body.message, undefined);
      assert.strictEqual(body.hint, undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('defaults week to 0 when the upstream view has no week column', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify([{
        signatures: 100,
        goal: 50000,
        updated: '2026-08-18T00:30:00.000Z',
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const response = await onRequestGet({
        request: new Request('https://portal.referendum21.org/api/count', {
          headers: { Origin: 'https://referendum21.org' },
        }),
        env: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'test-anon-key' },
      });
      const payload = await response.json();
      assert.strictEqual(payload.week, 0);
      assert.deepStrictEqual(Object.keys(payload).sort(),
        ['generated_at', 'goal', 'signatures', 'updated', 'week']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
