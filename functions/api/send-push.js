/**
 * POST /api/send-push
 * 
 * Cloudflare Pages / Worker Function for dispatching Web Push notifications.
 * Replaces the Supabase Deno Edge Function with native Cloudflare Edge execution.
 */

import { sendWebPush } from './_webpush.js';

const ALLOWED_ORIGINS = new Set([
  'https://portal.referendum21.org',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8788',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8788',
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.ref-volunteer-portal\.pages\.dev$/,
  /^https:\/\/ref-volunteer-portal\.pages\.dev$/,
  /^https:\/\/portalreferendum21\.[a-z0-9-]+\.workers\.dev$/,
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin));
}

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export const INTERNAL_ROLES = ['koordinator', 'jurist', 'admin', 'logjistike', 'burime_njerezore', 'pr_edukim', 'it'];

/**
 * Kush e merr njoftimin. E ndarë si funksion i pastër që rregulli të jetë i
 * lexueshëm dhe i testueshëm në një vend të vetëm:
 *
 *   • raportim            → qendra + koordinatorët (raporton kushdo, njoftohen ata)
 *   • njoftim 'all'       → çdo vullnetar i miratuar
 *   • njoftim 'staff'     → qendra + koordinatorët
 *   • provë               → vetëm pajisjet e thirrësit
 *
 * `roles: null` do të thotë pa filtër roli — të gjithë të miratuarit.
 */
export function audienceFor(kind, row) {
  if (kind === 'test') {
    return { roles: null, onlyMe: true, label: 'vetëm ju' };
  }
  if (kind === 'announcement') {
    return row && row.audience === 'staff'
      ? { roles: INTERNAL_ROLES, onlyMe: false, label: 'qendra & koordinatorët' }
      : { roles: null, onlyMe: false, label: 'të gjithë vullnetarët' };
  }
  return { roles: INTERNAL_ROLES, onlyMe: false, label: 'qendra & koordinatorët' };
}

/**
 * Grumbullon kodet e shërbimit të push-it për dërgimet e dështuara.
 *
 * Pa to çdo dështim duket njësoj nga jashtë, ndërsa shkaqet janë krejt të
 * ndryshme: `403`/`401` do të thotë që VAPID_PRIVATE_KEY nuk i përket të njëjtit
 * çift me çelësin publik me të cilin u krijua abonimi; `410` do të thotë pajisje
 * e vdekur; `network` do të thotë që kërkesa nuk doli fare. Nga `sent: 0` i
 * vjetër portali s'kishte si ta merrte me mend.
 */
export function summarizeFailures(results) {
  const statuses = {};
  for (const r of results || []) {
    if (r && r.ok) continue;
    const code = String((r && r.status) || 'network');
    statuses[code] = (statuses[code] || 0) + 1;
  }
  return statuses;
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestOptions({ request }) {
  const origin = request?.headers?.get('Origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { headers: getCorsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'forbidden_origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = env.SUPABASE_URL || 'https://yymmdyjjjvjbyleaoygf.supabase.co';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:qendra@referendum21.org';

  if (!serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, 500, origin);
  }

  // 1. Authenticate caller
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized: Missing or invalid authorization token' }, 401, origin);
  }
  const token = authHeader.replace('Bearer ', '');

  // Verify caller user with Supabase Auth
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401);
  const user = await userRes.json();

  // Fetch volunteer profile
  const meRes = await fetch(`${supabaseUrl}/rest/v1/volunteers?id=eq.${user.id}&select=id,role,status,full_name`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!meRes.ok) return jsonResponse({ error: 'Failed to query volunteer profile' }, 500);
  const meRows = await meRes.json();
  const me = meRows[0];
  if (!me || me.status !== 'approved') {
    return jsonResponse({ error: 'Forbidden: Account not approved' }, 403);
  }

  // 2. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request payload' }, 400);
  }

  const { kind, id } = body;
  if (!['announcement', 'report', 'test'].includes(kind)) {
    return jsonResponse({ error: 'Bad request: invalid notification kind' }, 400);
  }
  if (kind !== 'test' && !id) {
    return jsonResponse({ error: 'Bad request: missing entity id' }, 400);
  }

  let title = '';
  let text = '';
  let url = './';
  let tag = 'referendumi';
  let audienceRoles = null;
  let onlyMe = false;
  let audienceLabel = 'të gjithë';

  if (kind === 'test') {
    title = '🔔 Provë njoftimi';
    text = 'Njoftimet punojnë në këtë pajisje.';
    url = './#panel';
    tag = `test-${Date.now()}`;
    ({ roles: audienceRoles, onlyMe, label: audienceLabel } = audienceFor('test'));
  } else if (kind === 'announcement') {
    const annRes = await fetch(`${supabaseUrl}/rest/v1/announcements?id=eq.${id}&select=id,title,body,level,audience,author_name,author_id`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const [a] = await annRes.json();
    if (!a) return jsonResponse({ error: 'Announcement not found' }, 404);
    if (a.author_id !== me.id && !INTERNAL_ROLES.includes(me.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const prefix = a.level === 'urgent' ? '🚨 URGJENTE · ' : a.level === 'important' ? '❗ ' : '📣 ';
    title = prefix + a.title;
    text = (a.body || '').slice(0, 240) || `Njoftim nga ${a.author_name || 'qendra'}`;
    url = './#news';
    tag = `ann-${a.id}`;
    ({ roles: audienceRoles, onlyMe, label: audienceLabel } = audienceFor('announcement', a));
  } else {
    const repRes = await fetch(`${supabaseUrl}/rest/v1/reports?id=eq.${id}&select=id,kind,severity,title,body,reporter_id,reporter_name,location_text`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const [r] = await repRes.json();
    if (!r) return jsonResponse({ error: 'Report not found' }, 404);
    if (r.reporter_id !== me.id && !INTERNAL_ROLES.includes(me.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const ic = r.kind === 'legal' ? '⚖️' : r.kind === 'material' ? '📦' : '🚨';
    const sev = r.severity === 'high' ? ' · E LARTË' : '';
    title = `${ic} Raportim i ri${sev}`;
    text = `${r.title}\n${r.reporter_name || 'Vullnetar'}${r.location_text ? ' · ' + r.location_text : ''}`;
    url = './#reports';
    tag = `rep-${r.id}`;
    ({ roles: audienceRoles, onlyMe, label: audienceLabel } = audienceFor('report', r));
  }

  // 3. Query push subscription targets
  let targetQuery = `${supabaseUrl}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth_key,volunteers!inner(id,role,status)&volunteers.status=eq.approved`;
  if (onlyMe) {
    targetQuery += `&volunteer_id=eq.${me.id}`;
  } else if (audienceRoles) {
    targetQuery += `&volunteers.role=in.(${audienceRoles.join(',')})`;
  }

  const subsRes = await fetch(targetQuery, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!subsRes.ok) {
    return jsonResponse({ error: 'Failed to retrieve push subscriptions' }, 500);
  }
  const subs = await subsRes.json();

  if (!subs?.length) {
    return jsonResponse({ sent: 0, failed: 0, removed: 0, matched: 0, audience: audienceLabel });
  }

  // If VAPID keys are not configured yet, return dry run info
  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({
      sent: 0,
      failed: 0,
      matched: subs.length,
      audience: audienceLabel,
      warning: 'VAPID keys not configured in Cloudflare environment secrets',
    });
  }

  // 4. Encrypt per subscription and deliver. One dead phone must not hold up
  //    the rest, so every send resolves rather than throws.
  const payload = { title, body: text, url, tag };
  const vapid = { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject };
  const results = await Promise.all(subs.map(sub => sendWebPush(sub, payload, vapid)));

  const sent = results.filter(r => r.ok).length;
  const failed = results.length - sent;

  const statuses = summarizeFailures(results);

  // 5. Drop subscriptions the push service has retired (404/410) -- otherwise
  //    every future send retries phones that will never answer again.
  const goneIds = subs.filter((_, i) => results[i].gone).map(sub => sub.id);
  let removed = 0;
  if (goneIds.length) {
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?id=in.(${goneIds.join(',')})`,
      {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }
    );
    if (delRes.ok) removed = goneIds.length;
  }

  return jsonResponse({
    sent,
    failed,
    removed,
    matched: subs.length,
    audience: audienceLabel,
    title,
    ...(failed ? { statuses } : {}),
  }, 200, origin);
}
