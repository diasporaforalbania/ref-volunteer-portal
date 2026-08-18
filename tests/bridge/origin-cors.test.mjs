import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isOriginAllowed, getCorsHeaders, onRequestOptions, onRequestGet } from '../../functions/api/count.js';

describe('Suite 1: Origin Allowlist Security & CORS Validation', () => {
  const allowedOrigins = [
    'https://referendum21.org',
    'https://www.referendum21.org',
    'https://portal.referendum21.org',
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8788',
    'http://127.0.0.1:8000',
    'https://ref-landing-page.pages.dev',
    'https://preview-123.ref-landing-page.pages.dev',
    'https://dev.referendum21.org',
  ];

  for (const origin of allowedOrigins) {
    it(`should allow valid origin: ${origin} with dynamic CORS header and Vary: Origin`, () => {
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
    'https://pages.dev.attacker.com',
    'http://attacker-controlled.net',
    'null',
  ];

  for (const origin of disallowedOrigins) {
    it(`should reject unauthorized origin: ${origin}`, () => {
      assert.strictEqual(isOriginAllowed(origin), false);
      const headers = getCorsHeaders(origin);
      assert.strictEqual(headers['Access-Control-Allow-Origin'], undefined);
      assert.ok(headers['Vary'].includes('Origin'));
    });
  }

  it('should allow direct server/curl requests without Origin header', () => {
    assert.strictEqual(isOriginAllowed(undefined), true);
    assert.strictEqual(isOriginAllowed(null), true);
    assert.strictEqual(isOriginAllowed(''), true);
  });
});

describe('Suite 2: OPTIONS Preflight Tests', () => {
  it('should return 204 No Content with complete CORS headers for allowed origin', async () => {
    const origin = 'https://referendum21.org';
    const request = new Request('https://portal.referendum21.org/api/count', {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
      },
    });

    const response = await onRequestOptions({ request });
    assert.strictEqual(response.status, 204);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    assert.strictEqual(response.headers.get('Access-Control-Max-Age'), '86400');
    assert.ok(response.headers.get('Vary').includes('Origin'));
  });

  it('should return 403 Forbidden on preflight for unauthorized origin', async () => {
    const origin = 'https://evil-scam-site.org';
    const request = new Request('https://portal.referendum21.org/api/count', {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
      },
    });

    const response = await onRequestOptions({ request });
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.headers.get('Access-Control-Allow-Origin'), null);
  });
});

describe('Suite 3: GET Cross-Origin Enforcement', () => {
  it('should return 403 Forbidden on GET for unauthorized origin', async () => {
    const origin = 'https://evil-scam-site.org';
    const request = new Request('https://portal.referendum21.org/api/count', {
      method: 'GET',
      headers: { 'Origin': origin },
    });

    const response = await onRequestGet({ request, env: {} });
    assert.strictEqual(response.status, 403);
    const body = await response.json();
    assert.strictEqual(body.error, 'forbidden_origin');
  });
});
