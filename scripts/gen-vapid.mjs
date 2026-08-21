#!/usr/bin/env node
/**
 * Gjeneron çiftin e çelësave VAPID për njoftimet në telefon.
 *
 *   node scripts/gen-vapid.mjs
 *
 * Çelësat krijohen VETËM në këtë kompjuter dhe nuk dërgohen askund. Gjysma
 * publike futet në ndërtimin e portalit; gjysma private rri vetëm te Cloudflare.
 * Gjenerohen një herë — po i ndërruat më vonë, çdo pajisje e abonuar duhet ta
 * ndezë njoftimin nga e para.
 */

const b64url = bytes =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;

console.log(`
Çelësat VAPID u gjeneruan. Ruajini tani — nuk shfaqen sërish.

1) NDËRTIMI I PORTALIT (publik — mund të jetë i dukshëm)
   Në Cloudflare Pages/Workers → Settings → Variables, dhe në .env lokal:

   VITE_VAPID_PUBLIC_KEY=${publicKey}

2) SERVERI (sekret — mos e vendosni kurrë në git)
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

   VAPID_PUBLIC_KEY  = ${publicKey}
   VAPID_PRIVATE_KEY = ${privateKey}
   VAPID_SUBJECT     = mailto:qendra@referendum21.org   (opsionale)

3) Rindërtoni dhe ripublikoni portalin, që çelësi publik të hyjë në paketë.
   Pa hapin 3 butoni te faqja kryesore mbetet i çaktivizuar.
`);
