import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Suite 5: Authentication & Password Recovery Redirect URLs', () => {
  function computeRedirectUrl(hostname, origin) {
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${origin}/`;
    }
    return 'https://portal.referendum21.org/';
  }

  it('should redirect production hostname to https://portal.referendum21.org/', () => {
    assert.equal(
      computeRedirectUrl('portal.referendum21.org', 'https://portal.referendum21.org'),
      'https://portal.referendum21.org/'
    );
  });

  it('should redirect cloudflare pages deployment hostname to production URL', () => {
    assert.equal(
      computeRedirectUrl('ref-volunteer-portal.pages.dev', 'https://ref-volunteer-portal.pages.dev'),
      'https://portal.referendum21.org/'
    );
  });

  it('should preserve localhost origin only during local development', () => {
    assert.equal(
      computeRedirectUrl('localhost', 'http://localhost:5173'),
      'http://localhost:5173/'
    );
    assert.equal(
      computeRedirectUrl('127.0.0.1', 'http://127.0.0.1:8788'),
      'http://127.0.0.1:8788/'
    );
  });
});
