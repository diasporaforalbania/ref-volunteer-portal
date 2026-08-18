/**
 * GET /api/count
 * 
 * Cloudflare Pages Function / Worker API (portal.referendum21.org)
 * Secure Edge API Bridge for verified signature tallies.
 * Enforces strict Origin allowlisting, Zero-PII sanitization, and upstream timeouts.
 */

const DEFAULT_SUPABASE_URL = 'https://yymmdyjjjvjbyleaoygf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bW1keWpqanZqYnlsZWFveWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODUzODEsImV4cCI6MjA5ODM2MTM4MX0.mxR0_mF37Ste8eFgKKEBNwFXAILVY8JdZMQo-1zbkE0';

const ALLOWED_ORIGINS = new Set([
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

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.referendum21\.org$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*(?:ref-landing-page|ref-volunteer-portal|referendum21)\.pages\.dev$/,
];

export function isOriginAllowed(origin) {
  if (!origin) return true; // Direct curl, server fetch, or same-origin requests
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

export function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, authorization, accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Accept-Encoding',
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin');

  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden_origin' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Vary': 'Origin',
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function onRequestGet({ request, env, waitUntil }) {
  const origin = request.headers.get('Origin');

  // 1. Cross-Origin Validation
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden_origin' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Vary': 'Origin',
      },
    });
  }

  const corsHeaders = getCorsHeaders(origin);

  // 2. Cloudflare Edge Cache Match
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(new URL('/api/count', request.url).toString(), { method: 'GET' });

  if (cache) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const res = new Response(cachedResponse.body, cachedResponse);
        res.headers.set('X-Cache-Status', 'HIT');
        if (origin && isOriginAllowed(origin)) {
          res.headers.set('Access-Control-Allow-Origin', origin);
        } else {
          res.headers.set('Access-Control-Allow-Origin', '*');
        }
        res.headers.set('Vary', 'Origin, Accept-Encoding');
        return res;
      }
    } catch {
      // Continue on cache miss or unsupported environment
    }
  }

  const supabaseUrl = env?.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = env?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  // 3. Upstream Fetch with 4000ms AbortController Timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const upstream = await fetch(
      `${supabaseUrl}/rest/v1/signature_totals?select=signatures,goal,updated`,
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

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: 'upstream_unavailable' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    const rows = await upstream.json();
    const row = Array.isArray(rows) ? rows[0] : rows;

    // 4. Strict Zero-PII Schema Sanitization & Clamping
    const rawSignatures = Number(row?.signatures);
    const signatures = Number.isFinite(rawSignatures) && rawSignatures >= 0 ? Math.floor(rawSignatures) : 0;

    const rawGoal = Number(row?.goal);
    const goal = Number.isFinite(rawGoal) && rawGoal > 0 ? Math.floor(rawGoal) : 50000;

    let updated = null;
    if (row?.updated && typeof row.updated === 'string') {
      const parsedDate = new Date(row.updated);
      if (!isNaN(parsedDate.getTime())) {
        updated = parsedDate.toISOString();
      }
    }

    const payload = JSON.stringify({
      signatures,
      goal,
      updated,
      generated_at: new Date().toISOString(),
    });

    const response = new Response(payload, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        'X-Cache-Status': 'MISS',
        'X-Content-Type-Options': 'nosniff',
      },
    });

    // 5. Store in Cloudflare Edge Cache
    if (waitUntil && cache) {
      waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    return new Response(
      JSON.stringify({ error: 'gateway_timeout_or_error' }),
      {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}
