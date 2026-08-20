/**
 * POST /api/reset-password
 *
 * Rivendosja e fjalëkalimit, e dërguar nga skaji ynë — jo nga Supabase.
 *
 * PSE EKZISTON KY SKEDAR
 * ----------------------
 * `sb.auth.resetPasswordForEmail()` ia lë dërgimin e email-it Supabase-it. Pa
 * një server SMTP të konfiguruar, Supabase-i dërgon me shërbimin e vet të
 * parazgjedhur, dhe ai shërbim REFUZON çdo adresë që nuk i përket ekipit të
 * projektit. Domethënë: administratorit i vinte email-i, vullnetarit jo — dhe
 * asnjë anë nuk shihte gabim, sepse `resetPasswordForEmail()` kthen sukses
 * edhe kur mesazhi nuk niset kurrë.
 *
 * Këtu Supabase-i nuk dërgon asgjë. Ne e përdorim vetëm si burim të tokenit:
 * `/auth/v1/admin/generate_link` e krijon lidhjen e rivendosjes pa e dërguar,
 * dhe mesazhin e nis Worker-i me kanalin e vet.
 *
 * DY TË MIRA TË TJERA QË VIJNË FALAS
 * ----------------------------------
 *   1. Nuk varemi nga «Redirect URLs» te paneli i Supabase-it. Lidhjen e
 *      ndërtojmë vetë me `hashed_token` dhe shfletuesi e shkëmben me
 *      `verifyOtp()`; asnjë ridrejtim i Supabase-it nuk ndërhyn, ndaj një
 *      allowlist e paplotësuar nuk e prish më heshtazi rrjedhën.
 *   2. Tokeni shkon te FRAGMENTI i URL-së (`#token_hash=…`), jo te query-ja.
 *      Fragmenti nuk dërgohet kurrë te serveri — as te yni, as te ndonjë
 *      tjetër — ndaj nuk përfundon në regjistrat e Cloudflare-it.
 *
 * SIGURIA
 * -------
 *   • Përgjigja është GJITHMONË e njëjtë, qoftë email i regjistruar apo jo.
 *     Ndryshe endpointi bëhet listë kontrolli: kushdo mund të provonte adresa
 *     dhe të mësonte cilat i përkasin vullnetarëve.
 *   • Lidhja nuk kthehet kurrë te trupi i përgjigjes. E merr vetëm kutia
 *     postare e pronarit të adresës.
 *   • `SUPABASE_SERVICE_ROLE_KEY` e anashkalon RLS-në krejt. Rri vetëm si
 *     Secret te Cloudflare dhe nuk del kurrë nga ky skedar.
 */

import { isOriginAllowed, getCorsHeaders, forbiddenOrigin } from './_origins.js';

const DEFAULT_SUPABASE_URL = 'https://yymmdyjjjvjbyleaoygf.supabase.co';
const DEFAULT_PORTAL_URL = 'https://portal.referendum21.org';
const DEFAULT_FROM_EMAIL = 'noreply@portal.referendum21.org';
const DEFAULT_FROM_NAME = 'Referendumi — Portali i vullnetarëve';

/**
 * Kontroll forme, jo vërtetim ekzistence. Qëllimi i vetëm është të mos e
 * shqetësojmë Supabase-in me çka s'ka si të jetë adresë; nëse adresa ekziston
 * apo jo, thirrësi nuk e mëson dot nga këtu.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...getCorsHeaders(origin, 'POST, OPTIONS'),
    },
  });
}

/**
 * Ndërton lidhjen që i shkon vullnetarit.
 *
 * `#` dhe jo `?` me qëllim — shih shënimin te kreu i skedarit. E ndarë si
 * funksion i pastër që testet ta mbrojnë pikërisht këtë zgjedhje.
 */
export function buildRecoveryUrl(portalUrl, hashedToken) {
  const base = String(portalUrl || DEFAULT_PORTAL_URL).replace(/\/+$/, '');
  return `${base}/#token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
}

/** Shmang mbylljen e parakohshme të atributeve te trupi HTML i mesazhit. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Trupi i mesazhit. Pa imazhe dhe pa CSS të jashtëm: klientët e email-it i
 * bllokojnë të dyja, dhe një mesazh që mbërrin gjysmak duket si mashtrim
 * pikërisht atëherë kur vullnetari duhet të besojë një lidhje.
 */
export function renderResetEmail(link) {
  const safeLink = escapeHtml(link);

  const text = [
    'Referendumi — Portali i vullnetarëve',
    '',
    'Kërkuat rivendosjen e fjalëkalimit. Hapni lidhjen më poshtë dhe vendosni fjalëkalimin e ri:',
    '',
    link,
    '',
    'Lidhja skadon për një orë dhe përdoret vetëm një herë.',
    'Nëse nuk e kërkuat ju, thjesht shpërfilleni këtë mesazh — fjalëkalimi juaj mbetet i pandryshuar.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="sq"><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#0d9488">Referendumi</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280">Portali i vullnetarëve</p>

    <h2 style="margin:0 0 12px;font-size:17px">Rivendosja e fjalëkalimit</h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6">
      Kërkuat rivendosjen e fjalëkalimit. Klikoni butonin më poshtë dhe vendosni fjalëkalimin e ri.
    </p>

    <p style="margin:0 0 24px">
      <a href="${safeLink}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;font-size:15px">Vendos fjalëkalimin e ri</a>
    </p>

    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Nëse butoni nuk hapet, kopjoni këtë adresë te shfletuesi:</p>
    <p style="margin:0 0 24px;font-size:12px;word-break:break-all;color:#0d9488">${safeLink}</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Lidhja skadon për një orë dhe përdoret vetëm një herë.</p>
    <p style="margin:0;font-size:13px;color:#6b7280">
      Nëse nuk e kërkuat ju, shpërfilleni këtë mesazh — fjalëkalimi juaj mbetet i pandryshuar.
    </p>
  </div>
</body></html>`;

  return { subject: 'Rivendosja e fjalëkalimit — Portali i vullnetarëve', html, text };
}

/**
 * Zgjedh kanalin e dërgimit sipas asaj që është konfiguruar te Cloudflare.
 *
 * Të dy kanalet janë HTTP — asnjëri nuk kërkon SMTP te Supabase:
 *
 *   • `EMAIL`  → Cloudflare Email Sending, binding-u vendas. Pa çelësa fare,
 *                por kërkon planin Workers Paid dhe domainin e regjistruar.
 *   • `RESEND_API_KEY` → API-ja HTTP e Resend-it. Punon edhe në planin falas
 *                të Workers-it.
 *
 * Binding-u vjen i pari kur ekzistojnë të dy: është brenda platformës, pa
 * varësi nga një palë e tretë.
 */
export async function sendResetEmail(env, { to, subject, html, text }) {
  const fromEmail = (env.RESET_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim();
  const fromName = (env.RESET_FROM_NAME || DEFAULT_FROM_NAME).trim();

  if (env.EMAIL && typeof env.EMAIL.send === 'function') {
    await env.EMAIL.send({ to, from: { email: fromEmail, name: fromName }, subject, html, text });
    return 'cloudflare';
  }

  if (env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`resend_failed_${res.status}: ${detail.slice(0, 200)}`);
    }
    return 'resend';
  }

  throw new Error('no_email_transport');
}

export async function onRequestOptions({ request }) {
  const origin = request?.headers?.get('Origin');
  if (origin && !isOriginAllowed(origin)) return forbiddenOrigin();
  return new Response(null, { headers: getCorsHeaders(origin, 'POST, OPTIONS') });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin)) return forbiddenOrigin();

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    // Keqkonfigurim i serverit, jo gabim i përdoruesit — dhe nuk varet nga
    // adresa e dërguar, ndaj raportimi i tij nuk zbulon asgjë për askënd.
    return jsonResponse({ error: 'server_misconfigured', detail: 'SUPABASE_SERVICE_ROLE_KEY mungon' }, 500, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }

  const email = String(body?.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_SHAPE.test(email)) {
    return jsonResponse({ error: 'invalid_email' }, 400, origin);
  }

  // Fren kundër përdorimit si bombë email-esh. Binding-u mungon te `wrangler
  // dev` dhe te çdo konfigurim pa `[[ratelimits]]`, ndaj thirret me `?.` —
  // mungesa e tij nuk e rrëzon endpointin, thjesht e lë pa fren.
  const limiter = env.RESET_LIMITER;
  if (limiter && typeof limiter.limit === 'function') {
    const { success } = await limiter.limit({ key: email });
    if (!success) {
      return jsonResponse({ error: 'rate_limited' }, 429, origin);
    }
  }

  const supabaseUrl = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
  const portalUrl = env.PORTAL_URL || DEFAULT_PORTAL_URL;

  // Supabase-i këtu VETËM e krijon tokenin. `generate_link` nuk dërgon email —
  // pikërisht prandaj e përdorim, në vend të `recover`.
  let linkRes;
  try {
    linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'recovery', email }),
    });
  } catch (err) {
    console.error('[reset-password] generate_link nuk u arrit:', err);
    return jsonResponse({ error: 'upstream_unreachable' }, 502, origin);
  }

  if (!linkRes.ok) {
    // Rasti tipik: adresa nuk i përket asnjë llogarie (404/422). Nga jashtë
    // kjo DUHET të duket saktësisht si suksesi — ndryshe endpointi thotë se
    // cilat adresa janë të regjistruara.
    const detail = await linkRes.text().catch(() => '');
    console.warn('[reset-password] generate_link ktheu', linkRes.status, detail.slice(0, 200));
    return jsonResponse({ ok: true }, 200, origin);
  }

  const payload = await linkRes.json().catch(() => null);
  const hashedToken = payload?.hashed_token;
  if (!hashedToken) {
    console.error('[reset-password] generate_link pa `hashed_token`:', JSON.stringify(payload).slice(0, 200));
    return jsonResponse({ error: 'upstream_unexpected' }, 502, origin);
  }

  const link = buildRecoveryUrl(portalUrl, hashedToken);
  const { subject, html, text } = renderResetEmail(link);

  try {
    const via = await sendResetEmail(env, { to: email, subject, html, text });
    console.log('[reset-password] u dërgua me', via);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[reset-password] dërgimi dështoi:', reason);
    // Këtu NUK gënjejmë me `ok: true`. Dështimi i kanalit nuk varet nga adresa,
    // ndaj raportimi i tij nuk zbulon asgjë — dhe pa të, vullnetari do të
    // priste pafundësisht një mesazh që nuk u nis kurrë.
    return jsonResponse(
      { error: reason === 'no_email_transport' ? 'email_not_configured' : 'email_send_failed' },
      500,
      origin
    );
  }

  return jsonResponse({ ok: true }, 200, origin);
}
