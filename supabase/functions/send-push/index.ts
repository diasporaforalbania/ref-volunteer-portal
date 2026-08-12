/* ============================================================================
   send-push — dërgon njoftimin në telefonat e vullnetarëve.

   Thirret nga portali menjëherë pasi publikohet një njoftim ose dërgohet një
   raportim. Nuk i beson thirrësit se çfarë të shkruajë: merr vetëm ID-në e
   rreshtit, e lexon vetë nga baza, dhe vendos VETË se kush duhet ta marrë.
   Ndryshe kushdo me një llogari do të mund t'u dërgonte çfarë të donte të
   gjithë vullnetarëve të fushatës.

   Publiku:
     • njoftim me audience='all'   → çdo vullnetar i miratuar
     • njoftim me audience='staff' → koordinatorët + qendra (si te RLS-ja)
     • raportim                    → koordinatorët + qendra (ata i shqyrtojnë)

   Vendosja (një herë):
     supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
     supabase functions deploy send-push
   ============================================================================ */

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:qendra@example.org';

const STAFF_ROLES = ['koordinator', 'jurist', 'admin'];

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* Sa gjatë të presë njoftimi te shërbimi i shfletuesit nëse telefoni është i
   fikur. Një ditë: më gjatë s'ka kuptim, sepse lajmi vjetrohet. */
const TTL = 60 * 60 * 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys not configured' }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // 1. Kush po thërret? Pa një sesion të vlefshëm nuk shkon asgjë tutje.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const admin  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const { data: me } = await admin.from('volunteers')
    .select('id, role, status, full_name').eq('id', userData.user.id).maybeSingle();
  if (!me || me.status !== 'approved') return json({ error: 'Forbidden' }, 403);

  let body: { kind?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const { kind, id } = body;
  if (!id || (kind !== 'announcement' && kind !== 'report')) {
    return json({ error: 'Bad request' }, 400);
  }

  // 2. Teksti dhe publiku dalin nga baza, jo nga trupi i kërkesës.
  let title = '', text = '', url = './', tag = 'referendumi';
  let audienceRoles: string[] | null = null;   // null = të gjithë të miratuarit

  if (kind === 'announcement') {
    const { data: a } = await admin.from('announcements')
      .select('id, title, body, level, audience, author_name, author_id').eq('id', id).maybeSingle();
    if (!a) return json({ error: 'Not found' }, 404);
    // Vetëm autori ose stafi mund të nisë njoftimin e një shpalljeje.
    if (a.author_id !== me.id && !STAFF_ROLES.includes(me.role)) return json({ error: 'Forbidden' }, 403);

    const prefix = a.level === 'urgent' ? '🚨 URGJENTE · ' : a.level === 'important' ? '❗ ' : '📣 ';
    title = prefix + a.title;
    text  = (a.body || '').slice(0, 240) || `Njoftim nga ${a.author_name || 'qendra'}`;
    url   = './#news';
    tag   = 'ann-' + a.id;
    audienceRoles = a.audience === 'staff' ? STAFF_ROLES : null;

  } else {
    const { data: r } = await admin.from('reports')
      .select('id, kind, severity, title, body, reporter_id, reporter_name, location_text')
      .eq('id', id).maybeSingle();
    if (!r) return json({ error: 'Not found' }, 404);
    // Raportimin e njofton vetë raportuesi (sapo e dërgoi) ose stafi.
    if (r.reporter_id !== me.id && !STAFF_ROLES.includes(me.role)) return json({ error: 'Forbidden' }, 403);

    const ic = r.kind === 'legal' ? '⚖️' : r.kind === 'material' ? '📦' : '🚨';
    const sev = r.severity === 'high' ? ' · E LARTË' : '';
    title = `${ic} Raportim i ri${sev}`;
    text  = `${r.title}\n${r.reporter_name || 'Vullnetar'}`
          + (r.location_text ? ` · ${r.location_text}` : '');
    url   = './#reports';
    tag   = 'rep-' + r.id;
    audienceRoles = STAFF_ROLES;   // raportimet i sheh vetëm stafi
  }

  // 3. Pajisjet e publikut. Të pezulluarit nuk marrin njoftime.
  let q = admin.from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key, volunteers!inner(id, role, status)')
    .eq('volunteers.status', 'approved');
  if (audienceRoles) q = q.in('volunteers.role', audienceRoles);

  const { data: subs, error: subErr } = await q;
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs?.length) return json({ sent: 0, failed: 0, removed: 0 });

  const payload = JSON.stringify({ title, body: text, url, tag });
  const stale: string[] = [];
  let sent = 0, failed = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
        payload, { TTL });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      // 404/410 = pajisja s'ekziston më (aplikacioni u çinstalua, leja u hoq).
      // Rreshti hiqet, që lista të mos mbushet me adresa të vdekura.
      if (code === 404 || code === 410) stale.push(s.id);
      else failed++;
    }
  }));

  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);

  return json({ sent, failed, removed: stale.length });
});
