/**
 * Allowlist-i i Origin-eve, i përbashkët për të gjitha endpointet e urës.
 *
 * Nxjerrë nga `count.js` që të mos jetojnë dy lista paralele: një allowlist i
 * dublikuar është një allowlist që me kalimin e kohës do të shkojë jashtë sinkroni,
 * dhe pikërisht ai gjysmë-sinkron do të bëjë që një domain i ri të punojë te një
 * endpoint dhe të japë 403 te tjetri.
 *
 * `count.js` mbetet i paprekur me qëllim — testet e tij ekzistuese importojnë
 * `isOriginAllowed` / `getCorsHeaders` direkt nga ai skedar. Kur t'i migrojmë,
 * mjafton ta zëvendësojmë brendinë e tij me një re-export nga këtu.
 */

export const ALLOWED_ORIGINS = new Set([
  'https://referendum21.org',
  'https://www.referendum21.org',
  'https://portal.referendum21.org',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8788',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8788',
]);

export const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.referendum21\.org$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:ref-landing-page|ref-volunteer-portal|referendum21)\.pages\.dev$/,
];

/**
 * Një `Origin` bosh nuk refuzohet: kërkesat server-to-server dhe `curl` nuk e
 * dërgojnë fare këtë header, dhe endpointi nuk nxjerr gjë sekrete. Refuzimi
 * vlen për shfletuesin, që është i vetmi që e vendos header-in vetë dhe i vetmi
 * ku CORS-i ka kuptim si mbrojtje.
 */
export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * `Access-Control-Allow-Origin` vendoset gjithmonë me origin-in e kërkesës, jo
 * me `*`: kështu `Vary: Origin` e mban cache-in e ndarë sipas origin-it dhe një
 * përgjigje e ruajtur për një domain nuk i shërbehet një tjetri.
 */
export function getCorsHeaders(origin, methods = 'GET, OPTIONS') {
  const headers = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Accept-Encoding',
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/** Përgjigje 403 pa asnjë header CORS — shfletuesi nuk e lexon trupin. */
export function forbiddenOrigin() {
  return new Response(JSON.stringify({ error: 'forbidden_origin' }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Vary: 'Origin',
    },
  });
}
