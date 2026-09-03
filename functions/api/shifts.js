/**
 * GET /api/shifts
 *
 * Cloudflare Pages Function (portal.referendum21.org)
 * Ura e sigurt e turneve TË PLANIFIKUARA për faqen publike.
 *
 * Motër e `points.js`, me të njëjtin model: allowlist i Origin-it, cache në
 * skaj, timeout upstream, dhe allowlist fushash në dalje. Dallimet janë tri,
 * të gjitha sepse një turn i planifikuar nuk është ende një vend:
 *
 *   1. BURIM TJETËR. Lexon `public_upcoming_shifts`, jo `public_signing_points`.
 *      Pamja e pikave nis nga `checkins` — një turn pa asnjë check-in nuk
 *      prodhon rresht atje, ndaj nuk mjaftonte të zgjerohej filtri kohor.
 *   2. PA KOORDINATA. `points.js` hedh çdo rresht pa `lat`/`lng`, sepse pa to
 *      nuk vizatohet kartë harte. Këtu koordinata nuk ka fare: askush nuk ka
 *      mbërritur ende. Rreshti kërkon emër njësie dhe një orë nisjeje.
 *   3. KAPAK MË I VOGËL. `MAX_SHIFTS` është 50, jo 200: faqja publike tregon 3,
 *      dhe asnjë konsumator nuk ka arsye të marrë një kalendar të tërë.
 *
 * PII: pamja nuk përmban `created_by`, `created_by_name` as `capacity`, dhe
 * `SELECT`-i më poshtë është i fiksuar — nuk merr parametra nga kërkesa.
 * PËRJASHTIM I QËLLIMSHËM: `spot` (= shifts.notes) është pika e saktë e
 * takimit dhe shfaqet PUBLIKISHT në faqe. Vullnetari paralajmërohet për këtë
 * te forma e turnit. Shih `sql/upcoming-shifts-view.sql`.
 */

import { isOriginAllowed, getCorsHeaders, forbiddenOrigin } from './_origins.js';

/** Sa gjatë e mban skaji përgjigjen. Turnet e ardhshme ndryshojnë shumë më rrallë
 *  se pikat aktive, ndaj 5 minuta në vend të 60 sekondave. */
const CACHE_TTL_SECONDS = 300;

/** Sa kohë vazhdon të shërbehet përgjigjja e vjetër ndërsa freskohet në sfond. */
const STALE_WHILE_REVALIDATE_SECONDS = 600;

/** Kapaku i turneve në një përgjigje. Faqja publike tregon 3. */
const MAX_SHIFTS = 50;

/** Nëse Supabase nuk përgjigjet brenda kësaj kohe, kthejmë 504 e nuk pritet. */
const UPSTREAM_TIMEOUT_MS = 4000;

/** Gjatësitë maksimale të fushave tekst, pas prerjes. */
const MAX_LEN = { unit_code: 12, unit_name: 120, area: 160, region: 80, spot: 200 };

/**
 * Kolonat që kërkohen upstream — të fiksuara, nuk vijnë nga kërkesa. Pa `select`
 * eksplicit PostgREST kthen `*`, dhe `*` do të thotë "çfarëdo që ka pamja nesër".
 */
const UPSTREAM_SELECT = 'id,unit_code,unit_name,area,region,opens_at,closes_at,spot';

/**
 * Tekst i pabesuar → tekst i sigurt për t'u renderuar. Identik me `points.js`:
 * `unit_name` dhe `area` shkruhen nga qendra te portali, pra tekst i shkruar nga
 * njeriu që do të renderohet në një domain tjetër.
 * Konsumatori DUHET gjithsesi t'i shpëtojë (escape) — kjo nuk e zëvendëson.
 */
function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // Karakteret e kontrollit (NUL, newline, tab, DEL...) -> hapesire.
    // Shkruar me escape unicode me qellim: karakteret literale e bejne
    // skedarin binar, dhe klasa naive do te hante shenja pikesimi te ligjshme.
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

/** Datë e vlefshme → ISO. Çdo gjë tjetër → null. */
function cleanTimestamp(value) {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ID vetëm-hex 16 karaktere, siç e prodhon pamja. Bllokon çdo gjë tjetër. */
function cleanId(value) {
  return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value) ? value : null;
}

/**
 * Ndërton një turn të pastër nga një rresht upstream, ose kthen `null` nëse
 * rreshti nuk është i përdorshëm. Asnjë fushë nuk kopjohet me spread.
 */
export function sanitizeShift(row) {
  if (!row || typeof row !== 'object') return null;

  const id = cleanId(row.id);
  const unit_name = cleanText(row.unit_name, MAX_LEN.unit_name);
  const opens_at = cleanTimestamp(row.opens_at);

  // Pa emër njësie ose pa orë nisjeje turni nuk i thotë gjë askujt — hidhet
  // në heshtje, e nuk nxjerrim një rresht të gjysmuar.
  if (!id || !unit_name || !opens_at) return null;

  return {
    id,
    unit_code: cleanText(row.unit_code, MAX_LEN.unit_code),
    unit_name,
    area: cleanText(row.area, MAX_LEN.area),
    region: cleanText(row.region, MAX_LEN.region),
    opens_at,
    closes_at: cleanTimestamp(row.closes_at),
    // Pika e saktë e takimit (shifts.notes). Tekst i shkruar nga njeriu ->
    // sanitizohet si `area`; konsumatori DUHET gjithsesi ta escape-ojë.
    spot: cleanText(row.spot, MAX_LEN.spot),
  };
}

/** Lista e plotë e turneve, e sanitizuar dhe e kufizuar. */
export function sanitizeShifts(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (out.length >= MAX_SHIFTS) break;
    const shift = sanitizeShift(row);
    if (shift) out.push(shift);
  }
  return out;
}

function jsonError(code, status, corsHeaders) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin)) return forbiddenOrigin();

  return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
}

export async function onRequestGet({ request, env, waitUntil }) {
  const origin = request.headers.get('Origin');

  // 1. Kontrolli i Origin-it — para çdo pune tjetër.
  if (origin && !isOriginAllowed(origin)) return forbiddenOrigin();

  const corsHeaders = getCorsHeaders(origin);

  // 2. Cache-i i skajit. Çelësi është i normalizuar dhe pa Origin: përgjigjja
  //    është e njëjta për të gjithë, dhe header-i CORS rishkruhet mbi HIT.
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(new URL('/api/shifts', request.url).toString(), {
    method: 'GET',
  });

  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const res = new Response(cached.body, cached);
        res.headers.set('X-Cache-Status', 'HIT');
        if (origin && isOriginAllowed(origin)) {
          res.headers.set('Access-Control-Allow-Origin', origin);
        } else {
          res.headers.delete('Access-Control-Allow-Origin');
        }
        res.headers.set('Vary', 'Origin, Accept-Encoding');
        return res;
      }
    } catch {
      // Cache i padisponueshëm — vazhdojmë te upstream.
    }
  }

  const supabaseUrl = env?.SUPABASE_URL;
  const supabaseAnonKey = env?.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError('service_misconfigured', 503, corsHeaders);
  }

  // 3. Kërkesa upstream me timeout. `limit` vendoset edhe te PostgREST, që
  //    kapaku të zbatohet para transferimit e nuk vetëm pas.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(
      `${supabaseUrl}/rest/v1/public_upcoming_shifts` +
        `?select=${encodeURIComponent(UPSTREAM_SELECT)}` +
        `&limit=${MAX_SHIFTS}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!upstream.ok) return jsonError('upstream_unavailable', 502, corsHeaders);

    const rows = await upstream.json();

    // 4. Sanitizim strikt: përgjigjja ndërtohet nga zero, fushë pas fushe.
    const shifts = sanitizeShifts(rows);

    const payload = JSON.stringify({
      shifts,
      count: shifts.length,
      generated_at: new Date().toISOString(),
    });

    const response = new Response(payload, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control':
          `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}, ` +
          `stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
        'X-Cache-Status': 'MISS',
        'X-Content-Type-Options': 'nosniff',
        // Turnet janë të përkohshme; të mos mbeten në rezultatet e kërkimit
        // pasi ora të ketë kaluar.
        'X-Robots-Tag': 'noindex',
      },
    });

    if (waitUntil && cache) {
      waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch {
    clearTimeout(timeoutId);
    return jsonError('gateway_timeout_or_error', 504, corsHeaders);
  }
}
