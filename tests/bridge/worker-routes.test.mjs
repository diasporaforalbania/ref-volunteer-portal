import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Suita 8: rutimi te src/worker.ts
 *
 * `wrangler.toml` ka `main = "src/worker.ts"`, ndaj dosja `functions/` NUK
 * rutohet nga Cloudflare — ai skedar është i vetmi ruter. Një endpoint i ri nën
 * `functions/api/` nuk shfaqet vetvetiu: pa u regjistruar këtu, prodhimi kthen
 * `error code: 1101`. Ky test ekziston sepse pikërisht kjo ndodhi njëherë.
 */
describe('Suite 8: Worker entry point routes every /api endpoint', () => {
  const worker = readFileSync(new URL('../../src/worker.ts', import.meta.url), 'utf8');
  const wrangler = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');

  it('still uses src/worker.ts as the single entry point', () => {
    assert.match(wrangler, /main\s*=\s*"src\/worker\.ts"/,
      'Nëse `main` hiqet, ky test duhet rishikuar bashkë me rutimin.');
  });

  const ENDPOINTS = ['/api/count', '/api/points', '/api/send-push', '/api/reset-password'];

  for (const path of ENDPOINTS) {
    it(`routes ${path}`, () => {
      assert.ok(
        worker.includes(`url.pathname === '${path}'`),
        `${path} nuk është regjistruar te src/worker.ts — do të binte te env.ASSETS dhe do të jepte 1101`
      );
    });
  }

  it('imports a handler for every routed endpoint', () => {
    assert.match(worker, /from '\.\.\/functions\/api\/count\.js'/);
    assert.match(worker, /from '\.\.\/functions\/api\/points\.js'/);
    assert.match(worker, /from '\.\.\/functions\/api\/send-push\.js'/);
    assert.match(worker, /from '\.\.\/functions\/api\/reset-password\.js'/);
  });

  it('handles OPTIONS and GET for /api/points', () => {
    const i = worker.indexOf("url.pathname === '/api/points'");
    const block = worker.slice(i, worker.indexOf("url.pathname === '/api/send-push'"));
    assert.ok(block.includes('handlePointsOptions'), 'OPTIONS/preflight mungon për /api/points');
    assert.ok(block.includes('handlePointsGet'), 'GET mungon për /api/points');
    assert.ok(block.includes('method_not_allowed'), 'metodat e tjera duhet të kthejnë 405');
  });

  it('has a handler file for every endpoint the router declares', () => {
    // Anasjelltas: çdo rrugë e deklaruar duhet të ketë skedarin përkatës.
    const declared = [...worker.matchAll(/url\.pathname === '\/api\/([a-z-]+)'/g)].map((m) => m[1]);
    assert.ok(declared.length >= 3, 'pritej të paktën 3 rrugë');
    for (const name of declared) {
      const file = new URL(`../../functions/api/${name}.js`, import.meta.url);
      assert.doesNotThrow(() => readFileSync(file), `functions/api/${name}.js mungon`);
    }
  });
});
