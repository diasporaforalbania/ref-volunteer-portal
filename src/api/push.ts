/* ============================================================================
   Njoftimet në telefon — abonimi i pajisjes dhe nisja e njoftimeve.

   Portali nuk e vendos vetë se kush e merr njoftimin: i dërgon endpoint-it
   vetëm llojin dhe ID-në e rreshtit, dhe serveri e lexon rreshtin nga baza e të
   dhënave e vendos audiencën. Ndryshe kushdo me një llogari do të mund t'u
   dërgonte çfarë të donte të gjithë vullnetarëve.
   ============================================================================ */

import { sb, VAPID_PUBLIC_KEY } from './client';

export type PushKind = 'announcement' | 'report' | 'test';

export interface NotifyResult {
  sent: number;
  failed: number;
  matched: number;
  audience: string;
  warning?: string;
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes. Backed by an
 * explicit ArrayBuffer so it satisfies BufferSource under TS's strict
 * typed-array generics.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

/**
 * Gjendja e njoftimeve për këtë pajisje. Butoni shfaqet GJITHMONË — nëse diçka
 * mungon, arsyeja duhet të lexohet në ekran. Më parë karta fshihej pa fjalë kur
 * çelësi VAPID mungonte, dhe përdoruesi nuk merrte vesh asgjë.
 */
export type PushState =
  | 'on'              // e abonuar në këtë pajisje
  | 'off'             // gjithçka gati, thjesht e fikur
  | 'blocked'         // përdoruesi i ka bllokuar njoftimet te shfletuesi
  | 'needs-install'   // iPhone: portali s'është shtuar ende në ekran
  | 'unsupported'     // shfletuesi s'i mbështet njoftimet
  | 'not-configured'; // qendra s'ka vendosur ende çelësin VAPID

export interface PushEnv {
  hasVapidKey: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission;
  isIos: boolean;
  isStandalone: boolean;
  subscribed: boolean;
}

/**
 * Vendos gjendjen nga fakte të thjeshta — pa DOM, që rregulli të jetë i
 * testueshëm. Radha ka rëndësi: mungesa e çelësit kontrollohet e para, sepse
 * pa të asnjë buton nuk bën punë sado i mbështetur të jetë shfletuesi.
 */
export function resolvePushState(env: PushEnv): PushState {
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  if (!env.hasVapidKey) return 'not-configured';
  if (env.isIos && !env.isStandalone) return 'needs-install';
  if (env.permission === 'denied') return 'blocked';
  return env.subscribed && env.permission === 'granted' ? 'on' : 'off';
}

/** iOS dërgon njoftime vetëm te një aplikacion i instaluar, jo te një skedë Safari. */
function isIosDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Gjendja aktuale, duke lexuar pajisjen. */
export async function pushState(): Promise<PushState> {
  const hasApis =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  let subscribed = false;
  if (hasApis && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = !!(await reg?.pushManager.getSubscription());
  }

  return resolvePushState({
    hasVapidKey: !!VAPID_PUBLIC_KEY,
    hasServiceWorker: hasApis,
    hasPushManager: hasApis,
    hasNotification: hasApis,
    permission: hasApis ? Notification.permission : 'default',
    isIos: isIosDevice(),
    isStandalone: isStandaloneDisplay(),
    subscribed,
  });
}

/** Is this device already receiving notifications? */
export async function pushEnabled(): Promise<boolean> {
  return (await pushState()) === 'on';
}

/**
 * Një rresht shpjegues për çdo gjendje — i përbashkët mes çelësit te koka e
 * faqes dhe kartës te faqja kryesore, që të dy të thonë të njëjtën gjë.
 */
export function pushStateMessage(state: PushState): string {
  switch (state) {
    case 'on':
      return 'Njoftimet janë aktive në këtë pajisje.';
    case 'off':
      return 'Njoftimet janë të fikura në këtë pajisje.';
    case 'blocked':
      return 'Njoftimet janë të bllokuara nga shfletuesi. Lejojini te cilësimet e faqes dhe rifreskoni.';
    case 'needs-install':
      return 'Në iPhone shtoni fillimisht portalin në ekranin kryesor (Safari → ndaje → Add to Home Screen), pastaj hapeni nga ikona.';
    case 'unsupported':
      return 'Ky shfletues nuk i mbështet njoftimet.';
    case 'not-configured':
      return 'Njoftimet nuk janë aktivizuar ende nga qendra.';
  }
}

/**
 * Ask for permission, subscribe this device, and record it against the
 * volunteer. Returns a short Albanian reason when it cannot proceed, so the
 * caller can show it as-is.
 */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) {
    return { ok: false, reason: 'Kjo pajisje nuk i mbështet njoftimet, ose çelësi VAPID mungon.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      reason: permission === 'denied'
        ? 'Njoftimet janë bllokuar për këtë faqe. Lejojini nga cilësimet e shfletuesit.'
        : 'Njoftimet nuk u lejuan.',
    };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const keys = (sub.toJSON().keys || {}) as { p256dh?: string; auth?: string };
  if (!keys.p256dh || !keys.auth) {
    return { ok: false, reason: 'Abonimi u krijua pa çelësa — provoni sërish.' };
  }

  const { error } = await sb.rpc('push_subscribe', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_agent: navigator.userAgent,
  });
  if (error) return { ok: false, reason: error.message };

  return { ok: true };
}

/** Stop notifications on this device only; other devices keep theirs. */
export async function disablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const { error } = await sb.rpc('push_unsubscribe', { p_endpoint: endpoint });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/**
 * Nis njoftimin për një rresht që sapo u krijua. Dështimi nuk e prish veprimin
 * kryesor — raportimi ose njoftimi tashmë është ruajtur — ndaj kthen `null` në
 * vend që të hedhë përjashtim.
 */
export async function notifyPush(kind: PushKind, id?: string): Promise<NotifyResult | null> {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) return null;

    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(id ? { kind, id } : { kind }),
    });
    if (!res.ok) {
      console.warn('[push] endpoint-i u përgjigj me', res.status);
      return null;
    }
    return (await res.json()) as NotifyResult;
  } catch (err) {
    console.warn('[push] njoftimi nuk u nis:', err);
    return null;
  }
}
