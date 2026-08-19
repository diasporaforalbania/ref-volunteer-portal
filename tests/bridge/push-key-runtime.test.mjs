import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Suita 10: çelësi publik VAPID shkon te shfletuesi në kohë ekzekutimi
 *
 * Historiku që e krijoi këtë test: çelësi vinte VETËM nga
 * `import.meta.env.VITE_VAPID_PUBLIC_KEY`, pra piqej brenda paketës gjatë
 * ndërtimit. Te Cloudflare ajo variabël nuk ishte vendosur, ndaj paketa e
 * publikuar doli me çelës bosh dhe ÇDO vullnetar lexonte «Njoftimet nuk janë
 * aktivizuar ende nga qendra» — edhe pse serveri i kishte çelësat në rregull.
 */
describe('Suite 10: VAPID public key reaches the browser at runtime', () => {
  const url = (p) => new URL(p, import.meta.url);
  const worker = readFileSync(url('../../src/worker.ts'), 'utf8');
  const client = readFileSync(url('../../src/api/client.ts'), 'utf8');
  const wrangler = readFileSync(url('../../wrangler.toml'), 'utf8');
  const headers = readFileSync(url('../../_headers'), 'utf8');

  it('serves the key from the Worker env, not from a build-time variable', () => {
    assert.match(worker, /env\.VAPID_PUBLIC_KEY/,
      'Worker-i duhet ta lexojë çelësin nga env, që të mos varet nga ndërtimi');
    assert.match(worker, /meta name="vapid-public-key"/,
      'Çelësi duhet të mbërrijë te faqja si <meta>');
  });

  it('reads the same env var the sender signs with', () => {
    const sender = readFileSync(url('../../functions/api/send-push.js'), 'utf8');
    assert.match(sender, /env\.VAPID_PUBLIC_KEY/,
      'Nëse dërguesi lexon një emër tjetër, shfletuesi dhe serveri dalin me çelësa të ndryshëm');
  });

  it('uses a <meta> tag, because the CSP forbids inline scripts', () => {
    assert.match(headers, /script-src 'self'/);
    assert.ok(!/script-src[^;]*'unsafe-inline'/.test(headers),
      'CSP-ja s\'lejon skripte të brendshëm — injektimi duhet të mbetet <meta>');
    assert.ok(!/el\.append\(`<script/.test(worker),
      'Një <script> i injektuar do të bllokohej nga CSP-ja');
  });

  it('routes every request through the Worker so the shell gets rewritten', () => {
    // `run_worker_first = true` dhe jo listë rrugësh: në formën listë çdo rrugë
    // e papërmendur trajtohet tërësisht nga assets-et, dhe me
    // `not_found_handling = "single-page-application"` endpoint-et /api/*
    // marrin index.html në vend të JSON-it.
    assert.match(wrangler, /^\s*run_worker_first\s*=\s*true\s*$/m,
      'Pa këtë, `/` shërbehet drejt nga assets-et dhe <meta> nuk injektohet kurrë');
  });

  it('strips conditional headers so a 304 cannot serve a shell without the key', () => {
    // Kërkohet thirrja, jo përmendja: `If-None-Match` del edhe te komentet.
    assert.match(worker, /headers\.delete\('If-None-Match'\)/,
      'Pa këtë, shfletuesi merr 304 dhe rikthen kopjen e vjetër pa <meta>');
    assert.match(worker, /headers\.delete\('If-Modified-Since'\)/,
      'Edhe validimi me datë duhet hequr, ndryshe kthehet po ai 304');
    assert.match(worker, /headers\.delete\('ETag'\)/,
      'Trupi i rishkruar s\'është më ai i skedarit — ETag-u i tij nuk vlen');
  });

  it('prefers the runtime key but keeps the build-time one for `npm run dev`', () => {
    // Vetëm trupi i funksionit — komentet përmendin të dy emrat, ndaj radha e
    // tyre në tekstin e plotë nuk do të thoshte asgjë.
    const start = client.indexOf('function readVapidPublicKey');
    assert.ok(start > -1, 'readVapidPublicKey() mungon te src/api/client.ts');
    const body = client.slice(start, client.indexOf('\n}', start));

    const metaAt = body.indexOf('vapid-public-key');
    const buildAt = body.indexOf('VITE_VAPID_PUBLIC_KEY');
    assert.ok(metaAt > -1, 'meta-etiketa nuk lexohet fare');
    assert.ok(buildAt > -1, 'rruga e ndërtimit duhet të mbetet për `npm run dev`');
    assert.ok(metaAt < buildAt,
      'Meta-etiketa duhet lexuar e para: ajo përputhet gjithmonë me çelësin e dërguesit');
  });

  it('ships the public key in wrangler.toml, where a deploy cannot wipe it', () => {
    // Nje `Variable` e thjeshte te paneli i Cloudflare-it fshihet ne publikimin e
    // radhes, sepse me nje bllok `[vars]` prezent wrangler-i i heq te gjitha
    // variablat perpara se te vendose ato te konfigurimit. Ndaj celesi publik
    // duhet te jetoje ketu, jo te paneli.
    const m = wrangler.match(/^\s*VAPID_PUBLIC_KEY\s*=\s*"([^"]+)"/m);
    assert.ok(m, 'VAPID_PUBLIC_KEY mungon te [vars] — njoftimet dalin "te padisponueshme"');
    const key = m[1];
    assert.match(key, /^[A-Za-z0-9_-]+$/, 'celesi duhet te jete base64url');
    assert.equal(key.length, 87, 'nje celes publik P-256 i pakompresuar eshte 87 karaktere');

    const raw = Buffer.from(key.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    assert.equal(raw.length, 65, 'pritej nje pike P-256 e pakompresuar');
    assert.equal(raw[0], 0x04, 'bajti i pare i nje pike te pakompresuar eshte 0x04');
  });

  it('never commits the private half or the service-role key', () => {
    // Ky test ekziston si roje: te dyja keto i bejne dem te vertete po te dalin
    // ne git. Vendi i tyre eshte Cloudflare -> Settings -> Variables, type Secret.
    for (const name of ['VAPID_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      assert.ok(
        !new RegExp(`^\\s*${name}\\s*=`, 'm').test(wrangler),
        `${name} nuk guxon te jete te wrangler.toml — eshte sekret, vendoseni si Secret te Cloudflare`
      );
    }
  });

  it('refuses to write a malformed key into the page', () => {
    assert.match(worker, /\[A-Za-z0-9_-\]/,
      'Çelësi duhet validuar si base64url para se të hyjë në HTML');
  });
});
