import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestOptions, onRequestGet } from '../../functions/api/points.js';
import { isOriginAllowed, getCorsHeaders } from '../../functions/api/_origins.js';

describe('Suite 6: /api/points — Origin Allowlist & CORS', () => {
  const allowedOrigins = [
    'https://referendum21.org',
    'https://www.referendum21.org',
    'https://portal.referendum21.org',
    'http://localhost:3000',
    'http://localhost:8788',
    'http://127.0.0.1:5173',
    'https://ref-landing-page.pages.dev',
    'https://preview-123.ref-landing-page.pages.dev',
    'https://dev.referendum21.org',
  ];

  for (const origin of allowedOrigins) {
    it(`allows ${origin} and echoes it back with Vary: Origin`, () => {
      assert.strictEqual(isOriginAllowed(origin), true);
      const headers = getCorsHeaders(origin);
      assert.strictEqual(headers['Access-Control-Allow-Origin'], origin);
      assert.ok(headers['Vary'].includes('Origin'));
    });
  }

  const disallowedOrigins = [
    'https://malicious-site.com',
    'https://malicious-tenant.pages.dev',
    'https://referendum21.org.attacker.com',
    'https://evil-pages.dev.attacker.com',
    'http://attacker-controlled.net',
    'null',
  ];

  for (const origin of disallowedOrigins) {
    it(`rejects ${origin} and emits no ACAO header`, () => {
      assert.strictEqual(isOriginAllowed(origin), false);
      const headers = getCorsHeaders(origin);
      assert.strictEqual(headers['Access-Control-Allow-Origin'], undefined);
      assert.ok(headers['Vary'].includes('Origin'));
    });
  }

  it('never sends a wildcard Access-Control-Allow-Origin', () => {
    for (const origin of allowedOrigins) {
      assert.notStrictEqual(getCorsHeaders(origin)['Access-Control-Allow-Origin'], '*');
    }
  });

  it('allows server-to-server calls that send no Origin at all', () => {
    assert.strictEqual(isOriginAllowed(undefined), true);
    assert.strictEqual(isOriginAllowed(null), true);
    assert.strictEqual(isOriginAllowed(''), true);
  });

  it('returns 204 with full CORS headers on preflight from an allowed origin', async () => {
    const origin = 'https://referendum21.org';
    const request = new Request('https://portal.referendum21.org/api/points', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
    });

    const response = await onRequestOptions({ request });
    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    assert.strictEqual(response.headers.get('Access-Control-Max-Age'), '86400');
    assert.ok(response.headers.get('Vary').includes('Origin'));
  });

  it('returns 403 on preflight from an unauthorized origin', async () => {
    const request = new Request('https://portal.referendum21.org/api/points', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil-scam-site.org' },
    });

    const response = await onRequestOptions({ request });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), null);
  });

  it('returns 403 on GET from an unauthorized origin, before touching upstream', async () => {
    let upstreamCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      upstreamCalled = true;
      return new Response('[]', { status: 200 });
    };

    try {
      const request = new Request('https://portal.referendum21.org/api/points', {
        method: 'GET',
        headers: { Origin: 'https://evil-scam-site.org' },
      });

      const response = await onRequestGet({
        request,
        env: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'k' },
      });

      assert.strictEqual(response.status, 403);
      assert.strictEqual((await response.json()).error, 'forbidden_origin');
      assert.strictEqual(upstreamCalled, false, 'upstream must not be reached');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns 503 when Supabase credentials are not configured', async () => {
    const request = new Request('https://portal.referendum21.org/api/points', {
      headers: { Origin: 'https://referendum21.org' },
    });

    const response = await onRequestGet({ request, env: {} });
    assert.strictEqual(response.status, 503);
    assert.strictEqual((await response.json()).error, 'service_misconfigured');
  });

  it('returns 502 when upstream answers with an error status', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('boom', { status: 500 });

    try {
      const request = new Request('https://portal.referendum21.org/api/points', {
        headers: { Origin: 'https://referendum21.org' },
      });
      const response = await onRequestGet({
        request,
        env: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'k' },
      });
      assert.strictEqual(response.status, 502);
      assert.strictEqual((await response.json()).error, 'upstream_unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns 504 when upstream throws or times out', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('aborted');
    };

    try {
      const request = new Request('https://portal.referendum21.org/api/points', {
        headers: { Origin: 'https://referendum21.org' },
      });
      const response = await onRequestGet({
        request,
        env: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'k' },
      });
      assert.strictEqual(response.status, 504);
      assert.strictEqual((await response.json()).error, 'gateway_timeout_or_error');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('never leaks the Supabase anon key into the response body or headers', async () => {
    const secret = 'super-secret-anon-key-value';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      const request = new Request('https://portal.referendum21.org/api/points', {
        headers: { Origin: 'https://referendum21.org' },
      });
      const response = await onRequestGet({
        request,
        env: { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: secret },
      });

      const body = await response.text();
      assert.ok(!body.includes(secret), 'anon key must not appear in the body');
      for (const [, value] of response.headers) {
        assert.ok(!String(value).includes(secret), 'anon key must not appear in headers');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
