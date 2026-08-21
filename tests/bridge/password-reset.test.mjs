import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildRecoveryUrl,
  renderResetEmail,
  sendResetEmail,
  onRequestPost,
} from '../../functions/api/reset-password.js';

const PORTAL = 'https://portal.referendum21.org';

function makeEnv(overrides = {}) {
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    PORTAL_URL: PORTAL,
    ...overrides,
  };
}

/** Binding-u i Cloudflare Email Sending, i imituar sa duhet për të parë ç'niset. */
function recordingEmailBinding(outbox) {
  return { send: async (message) => { outbox.push(message); } };
}

function makeRequest(body, origin = PORTAL) {
  return new Request(`${PORTAL}/api/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Përgjigjet e `/auth/v1/admin/generate_link`, sipas ekzistencës së llogarisë. */
function stubSupabase({ found = true, hashedToken = 'tok_abc123' } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (!found) {
      return new Response(JSON.stringify({ msg: 'User not found' }), { status: 404 });
    }
    return new Response(
      JSON.stringify({ action_link: 'https://project.supabase.co/auth/v1/verify?token=…', hashed_token: hashedToken }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
  return calls;
}

describe('Suite 16: Rivendosja e fjalëkalimit — lidhja', () => {
  it('e vendos tokenin te fragmenti, kurrë te query-ja', () => {
    const url = buildRecoveryUrl(PORTAL, 'tok_abc123');

    // Fragmenti nuk dërgohet kurrë te asnjë server, ndaj tokeni nuk përfundon
    // te regjistrat e Cloudflare-it e as te `Referer` i kërkesave të faqes.
    assert.ok(url.includes('#token_hash=tok_abc123'), `pritej fragment, u mor ${url}`);
    assert.equal(new URL(url).search, '', 'tokeni nuk duhet të shkojë kurrë te query-ja');
    assert.ok(url.includes('type=recovery'));
  });

  it('nuk dyfishon slash-in kur portali jepet me slash në fund', () => {
    assert.equal(
      buildRecoveryUrl('https://portal.referendum21.org/', 'tok'),
      'https://portal.referendum21.org/#token_hash=tok&type=recovery'
    );
  });

  it('kodon tokenat me karaktere të veçanta', () => {
    const url = buildRecoveryUrl(PORTAL, 'a+b/c=d');
    assert.ok(url.includes('token_hash=a%2Bb%2Fc%3Dd'), url);
  });
});

describe('Suite 16: Rivendosja e fjalëkalimit — mesazhi', () => {
  it('mban të dy trupat, HTML dhe tekst', () => {
    const link = buildRecoveryUrl(PORTAL, 'tok');
    const mail = renderResetEmail(link);

    // Pa trupin tekst, disa klientë e shfaqin mesazhin bosh dhe filtrat e
    // padëshiruarve e ngrenë pikëzimin.
    assert.ok(mail.text.includes(link), 'lidhja mungon te trupi tekst');
    assert.ok(mail.subject.length > 0);

    // Te HTML-ja lidhja del me `&amp;` — kështu e kërkon standardi brenda një
    // atributi, dhe shfletuesit e klientët e email-it e lexojnë sërish si `&`.
    const escaped = link.replace(/&/g, '&amp;');
    assert.ok(mail.html.includes(`href="${escaped}"`), 'lidhja mungon te butoni HTML');
    assert.ok(mail.html.includes(escaped), 'lidhja mungon si tekst i kopjueshëm');
  });

  it('nuk kërkon asnjë burim të jashtëm', () => {
    const mail = renderResetEmail(buildRecoveryUrl(PORTAL, 'tok'));
    assert.ok(!/<img\s/i.test(mail.html), 'klientët e email-it i bllokojnë imazhet');
    assert.ok(!/<link\s/i.test(mail.html), 'CSS i jashtëm nuk mbërrin te klientët');
    assert.ok(!/<script/i.test(mail.html), 'skriptet hiqen dhe e ngrenë pikëzimin si spam');
  });
});

describe('Suite 16: Rivendosja e fjalëkalimit — kanali i dërgimit', () => {
  it('parapëlqen binding-un e Cloudflare-it kur ekzistojnë të dy', async () => {
    const outbox = [];
    const via = await sendResetEmail(
      makeEnv({ EMAIL: recordingEmailBinding(outbox), RESEND_API_KEY: 'rk_test' }),
      { to: 'a@b.com', subject: 's', html: '<p>h</p>', text: 't' }
    );

    assert.equal(via, 'cloudflare');
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'a@b.com');
    assert.equal(outbox[0].from.email, 'noreply@portal.referendum21.org');
  });

  it('kalon te Resend kur binding-u mungon', async () => {
    const original = globalThis.fetch;
    let sent = null;
    globalThis.fetch = async (url, init) => {
      sent = { url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization };
      return new Response('{}', { status: 200 });
    };

    try {
      const via = await sendResetEmail(makeEnv({ RESEND_API_KEY: 'rk_test' }), {
        to: 'a@b.com', subject: 's', html: '<p>h</p>', text: 't',
      });
      assert.equal(via, 'resend');
      assert.equal(sent.url, 'https://api.resend.com/emails');
      assert.equal(sent.auth, 'Bearer rk_test');
      assert.deepEqual(sent.body.to, ['a@b.com']);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('e thotë hapur kur nuk është konfiguruar asnjë kanal', async () => {
    await assert.rejects(
      () => sendResetEmail(makeEnv(), { to: 'a@b.com', subject: 's', html: 'h', text: 't' }),
      /no_email_transport/
    );
  });
});

describe('Suite 16: Rivendosja e fjalëkalimit — endpointi', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('dërgon email-in kur llogaria ekziston', async () => {
    stubSupabase({ found: true, hashedToken: 'tok_real' });
    const outbox = [];

    const res = await onRequestPost({
      request: makeRequest({ email: 'vullnetar@shembull.com' }),
      env: makeEnv({ EMAIL: recordingEmailBinding(outbox) }),
    });

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(outbox.length, 1);
    assert.ok(outbox[0].html.includes('#token_hash=tok_real'));
  });

  it('nuk e zbulon dot cilat adresa janë të regjistruara', async () => {
    // Vetia që mbrohet këtu: përgjigja për një adresë të panjohur duhet të jetë
    // BYTE PËR BYTE e njëjtë me atë të një adrese të regjistruar. Ndryshe
    // endpointi bëhet listë kontrolli mbi vullnetarët e fushatës.
    stubSupabase({ found: true });
    const known = await onRequestPost({
      request: makeRequest({ email: 'ekziston@shembull.com' }),
      env: makeEnv({ EMAIL: recordingEmailBinding([]) }),
    });

    stubSupabase({ found: false });
    const outbox = [];
    const unknown = await onRequestPost({
      request: makeRequest({ email: 'sekziston@shembull.com' }),
      env: makeEnv({ EMAIL: recordingEmailBinding(outbox) }),
    });

    assert.equal(unknown.status, known.status);
    assert.equal(await unknown.text(), await known.text());
    assert.equal(outbox.length, 0, 'te një adresë e paregjistruar nuk niset asgjë');
  });

  it('nuk e kthen kurrë lidhjen te trupi i përgjigjes', async () => {
    stubSupabase({ found: true, hashedToken: 'tok_sekret' });

    const res = await onRequestPost({
      request: makeRequest({ email: 'vullnetar@shembull.com' }),
      env: makeEnv({ EMAIL: recordingEmailBinding([]) }),
    });

    const body = await res.text();
    assert.ok(!body.includes('tok_sekret'), 'lidhja e merr vetëm kutia postare, jo thirrësi');
    assert.ok(!body.includes('token_hash'));
  });

  it('e ndal përsëritjen e shpeshtë për të njëjtën adresë', async () => {
    stubSupabase({ found: true });
    const seen = [];
    const env = makeEnv({
      EMAIL: recordingEmailBinding([]),
      RESET_LIMITER: { limit: async ({ key }) => { seen.push(key); return { success: false }; } },
    });

    const res = await onRequestPost({ request: makeRequest({ email: 'Viktima@Shembull.com' }), env });

    assert.equal(res.status, 429);
    // Çelësi është adresa e normalizuar, jo IP-ja: IP-të ndërrohen lehtë, kurse
    // kutia postare që do të mbytej mbetet e njëjta.
    assert.deepEqual(seen, ['viktima@shembull.com']);
  });

  it('e raporton mungesën e çelësit të shërbimit si keqkonfigurim serveri', async () => {
    const res = await onRequestPost({
      request: makeRequest({ email: 'a@b.com' }),
      env: makeEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }),
    });

    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, 'server_misconfigured');
  });

  it('nuk gënjen me sukses kur dërgimi dështon', async () => {
    stubSupabase({ found: true });

    // Dështimi i kanalit nuk varet nga adresa, ndaj raportimi i tij nuk zbulon
    // gjë — dhe pa të, vullnetari pret pafundësisht një mesazh që s'u nis kurrë.
    const res = await onRequestPost({
      request: makeRequest({ email: 'a@b.com' }),
      env: makeEnv(),
    });

    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, 'email_not_configured');
  });

  it('refuzon adresat e shformuara pa e prekur Supabase-in', async () => {
    const calls = stubSupabase({ found: true });

    for (const email of ['', 'pa-shenje', 'a@b', 'a b@c.com']) {
      const res = await onRequestPost({ request: makeRequest({ email }), env: makeEnv() });
      assert.equal(res.status, 400, `«${email}» duhej refuzuar`);
    }
    assert.equal(calls.length, 0, 'asnjë kërkesë nuk duhet t\'i shkojë Supabase-it');
  });

  it('refuzon origjinat jashtë allowlist-it', async () => {
    const res = await onRequestPost({
      request: makeRequest({ email: 'a@b.com' }, 'https://sulmuesi.example'),
      env: makeEnv(),
    });
    assert.equal(res.status, 403);
  });
});

describe('Suite 16: Rivendosja e fjalëkalimit — rrjedha te shfletuesi', () => {
  const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');

  it('i lexon parametrat e rivendosjes në ngarkim të modulit, jo brenda boot()', () => {
    // Regresioni që mbulon ky test: supabase-js e fshin vetë fragmentin e URL-së
    // sapo e përpunon. Kur leximi bëhej brenda `boot()` — që pritet nga
    // `DOMContentLoaded` — lidhja shpesh ishte zhdukur para se ta lexonim, dhe
    // vullnetari hynte te faqja kryesore pa e parë kurrë formën e fjalëkalimit.
    const moduleScope = main.slice(0, main.indexOf('export async function boot'));
    assert.match(moduleScope, /const RECOVERY = readRecoveryParams\(\)/,
      'RECOVERY duhet kapur në nivel moduli, para se boot() të presë DOMContentLoaded');
  });

  it('abonohet te ndryshimet e sesionit para leximit të tij', () => {
    const boot = main.slice(main.indexOf('export async function boot'));
    const subscribe = boot.indexOf('onAuthStateChange');
    const readSession = boot.indexOf('await sb.auth.getSession()');

    assert.ok(subscribe > -1 && readSession > -1);
    assert.ok(subscribe < readSession,
      'abonimi pas `await`-it të parë e humb ngjarjen PASSWORD_RECOVERY');
  });

  it('e shkëmben tokenin me verifyOtp, jo me ridrejtim', () => {
    // Ridrejtimi përmes `/auth/v1/verify` e harxhon tokenin me një GET të
    // thjeshtë — pra edhe kur lidhjen e hap një skanues email-i, jo njeriu.
    assert.match(main, /verifyOtp\(\{\s*token_hash/);
  });
});
