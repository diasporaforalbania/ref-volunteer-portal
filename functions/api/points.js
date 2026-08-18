/**
 * GET /api/points
 *
 * Cloudflare Pages Function (portal.referendum21.org)
 * Ura e sigurt e pikave aktive të nënshkrimit për faqen publike.
 *
 * Ndërtuar sipas të njëjtit model si `count.js`: allowlist i Origin-it, cache në
 * skaj, timeout upstream, dhe sanitizim i plotë i daljes. Shtesat ndaj `count.js`
 * janë tri, të gjitha sepse këtu dalin objekte e jo një numër i vetëm:
 *
 *   1. ALLOWLIST I FUSHAVE, NUK ËSHTË BLOCKLIST. Përgjigjja ndërtohet fushë pas
 *      fushe nga zero. Çdo kolonë që shfaqet upstream dhe nuk e njohim, zhduket
 *      në heshtje. Kjo është e vetmja mbrojtje që qëndron edhe kur dikush shton
 *      nesër një kolonë të ndjeshme te pamja pa e lexuar këtë skedar.
 *   2. SANITIZIM I TEKSTIT. `point_name` dhe `city` vijnë nga fusha ku shkruan
 *      vullnetari (`p_location` te check-in-i) ose ai që hap turnin (`shifts.notes`).
 *      Pra: tekst i pabesuar, i shkruar nga njeriu, që do të renderohet në një
 *      domain tjetër. Hiqen karakteret e kontrollit dhe `<` `>`, dhe pritet gjatësia.
 *   3. KAPAK NË NUMËR. Maksimumi `MAX_POINTS` pika. Një dështim ose një gabim te
 *      pamja nuk shndërrohet në një përgjigje disa-megabajtëshe.
 *
 * ZERO PII: pamja `public_signing_points` nuk përmban asnjë të dhënë personale,
 * dhe ky skedar nuk e kërkon dot as aksidentalisht — `SELECT`-i është i fiksuar
 * më poshtë dhe nuk merr parametra nga kërkesa.
 */

import { isOriginAllowed, getCorsHeaders, forbiddenOrigin } from './_origins.js';

/** Sa gjatë e mban skaji përgjigjen. 60s = kartat freskohen brenda një minute
 *  pas një check-in-i të re, dhe upstream-i merr një kërkesë të vetme për colo. */
const CACHE_TTL_SECONDS = 60;

/** Sa kohë vazhdon të shërbehet përgjigjja e vjetër ndërsa freskohet në sfond. */
const STALE_WHILE_REVALIDATE_SECONDS = 300;

/** Kapaku i pikave në një përgjigje. Fushata reale ka dhjetëra, jo qindra. */
const MAX_POINTS = 200;

/** Nëse Supabase nuk përgjigjet brenda kësaj kohe, kthejmë 504 e nuk pritet. */
const UPSTREAM_TIMEOUT_MS = 4000;

/** Gjatësitë maksimale të fushave tekst, pas prerjes. */
const MAX_LEN = { unit_code: 12, unit_name: 120, point_name: 160, city: 80 };

/**
 * Kolonat që kërkohen upstream — të fiksuara, nuk vijnë nga kërkesa. Pa `select`
 * eksplicit PostgREST kthen `*`, dhe `*` do të thotë "çfarëdo që ka pamja nesër".
 */
const UPSTREAM_SELECT =
  'id,unit_code,unit_name,point_name,city,lat,lng,opens_at,closes_at';

/**
 * Tekst i pabesuar → tekst i sigurt për t'u renderuar.
 * Heq karakteret e kontrollit dhe kllapat kënddrejta, bashkon hapësirat, pret
 * gjatësinë. `<` dhe `>` hiqen si mbrojtje në thellësi: emrat e vendeve nuk i
 * përmbajnë legjitimisht, dhe konsumatori mund t'i fusë me `innerHTML`.
 * Konsumatori DUHET gjithsesi t'i shpëtojë (escape) — kjo nuk e zëvendëson.
 */
function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    // Karakteret e kontrollit (NUL, newline, tab, DEL...) -> hapesire.
    // Shkruar me escape unicode me qellim: karakteret literale e bejne
    // skedarin binar, dhe klasa naive do te hante shenja pikesimi te ligjshme.
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    // Kllapat kenddrejta bien: emrat e vendeve nuk i permbajne, dhe
    // konsumatori mund t'i fuse me innerHTML. Mbrojtje ne thellesi -- NUK
    // e zevendeson escape-in te ana e konsumatorit.
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

/** Koordinatë e vlefshme, e kufizuar dhe e rrumbullakosur në 3 dhjetore (~110 m). */
function cleanCoord(value, limit) {
  // Tipi kontrollohet PARA `Number()`. Pa këtë, `Number(null)`, `Number('')` dhe
  // `Number(false)` kthejnë të gjitha `0` — një pikë pa GPS do të publikohej në
  // koordinatat 0,0 (Gjiri i Guinesë) si kartë krejtësisht e vlefshme.
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const n = Number(value);
  if (!Number.isFinite(n) || n < -limit || n > limit) return null;
  return Math.round(n * 1000) / 1000;
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
 * Ndërton një pikë të pastër nga një rresht upstream, ose kthen `null` nëse
 * rreshti nuk është i përdorshëm. Asnjë fushë nuk kopjohet me spread.
 */
export function sanitizePoint(row) {
  if (!row || typeof row !== 'object') return null;

  const lat = cleanCoord(row.lat, 90);
  const lng = cleanCoord(row.lng, 180);
  const point_name = cleanText(row.point_name, MAX_LEN.point_name);
  const id = cleanId(row.id);

  // Pa koordinata ose pa emër karta nuk vizatohet dot — hedhim rreshtin
  // në heshtje, e nuk nxjerrim një kartë të gjysmuar.
  if (lat === null || lng === null || !point_name || !id) return null;

  return {
    id,
    unit_code: cleanText(row.unit_code, MAX_LEN.unit_code),
    unit_name: cleanText(row.unit_name, MAX_LEN.unit_name),
    point_name,
    city: cleanText(row.city, MAX_LEN.city),
    lat,
    lng,
    opens_at: cleanTimestamp(row.opens_at),
    closes_at: cleanTimestamp(row.closes_at),
  };
}

/** Lista e plotë e pikave, e sanitizuar dhe e kufizuar. */
export function sanitizePoints(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (out.length >= MAX_POINTS) break;
    const point = sanitizePoint(row);
    if (point) out.push(point);
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
  const cacheKey = new Request(new URL('/api/points', request.url).toString(), {
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
      `${supabaseUrl}/rest/v1/public_signing_points` +
        `?select=${encodeURIComponent(UPSTREAM_SELECT)}` +
        `&limit=${MAX_POINTS}`,
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
    const points = sanitizePoints(rows);

    const payload = JSON.stringify({
      points,
      count: points.length,
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
        // Pikat janë të përkohshme; të mos mbeten në rezultatet e kërkimit
        // pasi turni ka mbaruar.
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
