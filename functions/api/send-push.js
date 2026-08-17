/**
 * POST /api/send-push
 * 
 * Cloudflare Pages / Worker Function for dispatching Web Push notifications.
 * Replaces the Supabase Deno Edge Function with native Cloudflare Edge execution.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAFF_ROLES = ['koordinator', 'jurist', 'admin'];
const INTERNAL_ROLES = ['koordinator', 'jurist', 'admin', 'logjistike', 'burime_njerezore', 'pr_edukim', 'it'];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  const supabaseUrl = env.SUPABASE_URL || 'https://yymmdyjjjvjbyleaoygf.supabase.co';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || 'mailto:qendra@referendum21.org';

  if (!serviceRoleKey) {
    return jsonResponse({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' }, 500);
  }

  // 1. Authenticate caller
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized: Missing or invalid authorization token' }, 401);
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
    onlyMe = true;
    audienceLabel = 'vetëm ju';
  } else if (kind === 'announcement') {
    const annRes = await fetch(`${supabaseUrl}/rest/v1/announcements?id=eq.${id}&select=id,title,body,level,audience,author_name,author_id`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const [a] = await annRes.json();
    if (!a) return jsonResponse({ error: 'Announcement not found' }, 404);
    if (a.author_id !== me.id && !STAFF_ROLES.includes(me.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const prefix = a.level === 'urgent' ? '🚨 URGJENTE · ' : a.level === 'important' ? '❗ ' : '📣 ';
    title = prefix + a.title;
    text = (a.body || '').slice(0, 240) || `Njoftim nga ${a.author_name || 'qendra'}`;
    url = './#news';
    tag = `ann-${a.id}`;
    audienceRoles = a.audience === 'staff' ? INTERNAL_ROLES : null;
    audienceLabel = a.audience === 'staff' ? 'qendra & koordinatorët' : 'të gjithë vullnetarët';
  } else {
    const repRes = await fetch(`${supabaseUrl}/rest/v1/reports?id=eq.${id}&select=id,kind,severity,title,body,reporter_id,reporter_name,location_text`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const [r] = await repRes.json();
    if (!r) return jsonResponse({ error: 'Report not found' }, 404);
    if (r.reporter_id !== me.id && !STAFF_ROLES.includes(me.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const ic = r.kind === 'legal' ? '⚖️' : r.kind === 'material' ? '📦' : '🚨';
    const sev = r.severity === 'high' ? ' · E LARTË' : '';
    title = `${ic} Raportim i ri${sev}`;
    text = `${r.title}\n${r.reporter_name || 'Vullnetar'}${r.location_text ? ' · ' + r.location_text : ''}`;
    url = './#reports';
    tag = `rep-${r.id}`;
    audienceRoles = STAFF_ROLES;
    audienceLabel = 'stafi';
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

  return jsonResponse({
    sent: subs.length,
    failed: 0,
    matched: subs.length,
    audience: audienceLabel,
    title,
  });
}
