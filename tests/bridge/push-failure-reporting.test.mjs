import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeFailures } from '../../functions/api/send-push.js';

/**
 * Suita 11: një dërgim i dështuar duhet të thotë PSE dështoi
 *
 * Historiku: `sent: 0` kthehej i zhveshur, dhe portali e përkthente gjithmonë
 * në «Prova nuk u dërgua. Kontrolloni lidhjen dhe cilësimet e njoftimeve» —
 * çka e dërgonte përdoruesin te lidhja e tij edhe kur shkaku ishte një sekret
 * që mungonte te Cloudflare, ose një çift çelësash VAPID që s'përputhej.
 */
describe('Suite 11: a failed send explains itself', () => {
  it('groups push-service status codes', () => {
    assert.deepEqual(summarizeFailures([{ ok: false, status: 403 }, { ok: false, status: 403 }]), { 403: 2 });
  });

  it('ignores the deliveries that succeeded', () => {
    assert.deepEqual(summarizeFailures([{ ok: true, status: 201 }, { ok: false, status: 410 }]), { 410: 1 });
    assert.deepEqual(summarizeFailures([{ ok: true, status: 201 }]), {});
  });

  it('labels a request that never left as `network`, not as status 0', () => {
    // `0` do të lexohej si kod HTTP; nuk është.
    assert.deepEqual(summarizeFailures([{ ok: false, status: 0, error: 'timeout' }]), { network: 1 });
  });

  it('survives an empty or missing result set', () => {
    assert.deepEqual(summarizeFailures([]), {});
    assert.deepEqual(summarizeFailures(undefined), {});
  });

  it('sends the codes to the client only when something failed', () => {
    const sender = readFileSync(new URL('../../functions/api/send-push.js', import.meta.url), 'utf8');
    assert.match(sender, /\.\.\.\(failed \? \{ statuses \} : \{\}\)/,
      'kodet duhet të shoqërojnë përgjigjen kur ka dështime');
  });

  it('no longer blames the user connection for a server-side failure', () => {
    const home = readFileSync(new URL('../../src/views/home.ts', import.meta.url), 'utf8');
    assert.ok(!/Kontrolloni lidhjen dhe cilësimet e njoftimeve/.test(home),
      'mesazhi i vjetër i pakushtëzuar duhet hequr — ai gënjente në tri raste nga katër');
    assert.match(home, /notifyResultMessage\(res\)/,
      'karta duhet ta shfaqë arsyen e vërtetë');
  });

  it('names the two configuration faults it can actually diagnose', () => {
    const push = readFileSync(new URL('../../src/api/push.ts', import.meta.url), 'utf8');
    assert.match(push, /SUPABASE_SERVICE_ROLE_KEY/,
      'një 500 nga serveri duhet ta thotë cili sekret mungon');
    assert.match(push, /VAPID_PRIVATE_KEY/,
      'një 403 nga shërbimi i push-it duhet ta thotë se çifti i çelësave s\'përputhet');
  });

  it('keeps the endpoint error instead of discarding it as null', () => {
    const push = readFileSync(new URL('../../src/api/push.ts', import.meta.url), 'utf8');
    const i = push.indexOf('if (!res.ok)');
    const block = push.slice(i, i + 700);
    assert.ok(!/return null/.test(block),
      'statusi humbte këtu; tani duhet të kalojë deri te ekrani');
  });
});
