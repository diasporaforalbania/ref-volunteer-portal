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

/** Is this device already receiving notifications? */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
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
