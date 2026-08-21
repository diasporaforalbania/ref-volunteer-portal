/**
 * Web Push dërgimi real — RFC 8291 (aes128gcm) + RFC 8292 (VAPID).
 *
 * Shkruar mbi WebCrypto e jo mbi paketën `web-push`: ajo mbështetet te modulet
 * `crypto`/`https` të Node-it, dhe te Workers-at vetëm WebCrypto është i
 * garantuar. Transporti bëhet me `fetch`, si çdo kërkesë tjetër.
 *
 * Çelësi privat VAPID nuk del kurrë nga mjedisi i serverit; portali mban vetëm
 * gjysmën publike.
 */

const te = new TextEncoder();

export function b64urlToBytes(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** HKDF-SHA256 (extract + expand in one step, which is what RFC 8291 uses). */
export async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

/**
 * Encrypt a payload for one subscription.
 * Returns the full aes128gcm body: salt(16) | rs(4) | idlen(1) | as_public(65) | ciphertext
 */
export async function encryptPayload(p256dhB64, authB64, payloadBytes) {
  const uaPublic = b64urlToBytes(p256dhB64);   // 65 bytes, 0x04 || x || y
  const authSecret = b64urlToBytes(authB64);   // 16 bytes

  // Ephemeral sender key -- fresh for every message, per the spec.
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256)
  );

  // RFC 8291 §3.3 — the auth secret is the salt here, and the info binds both
  // public keys so a message cannot be replayed against another subscription.
  const keyInfo = concatBytes(te.encode('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(sharedSecret, authSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Single record, so the padding delimiter is 0x02 (RFC 8188 §2).
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext)
  );

  const recordSize = 4096;
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize);
  header[20] = asPublic.length;   // keyid length: 65

  return concatBytes(header, asPublic, ciphertext);
}

/**
 * VAPID Authorization header. `privateKeyD` is the JWK `d` value produced by the
 * key-generation snippet in PUSH_SETUP.md; x and y are recovered from the
 * public key so only those two secrets need storing.
 */
export async function vapidAuthHeader(endpoint, publicKeyB64, privateKeyD, subject) {
  const pub = b64urlToBytes(publicKeyB64);
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: privateKeyD,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const b64urlJson = obj => bytesToB64url(te.encode(JSON.stringify(obj)));
  const signingInput =
    b64urlJson({ typ: 'JWT', alg: 'ES256' }) + '.' +
    b64urlJson({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    });

  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(signingInput))
  );
  // WebCrypto already returns the raw r||s that JOSE ES256 expects.
  const jwt = `${signingInput}.${bytesToB64url(signature)}`;
  return `vapid t=${jwt}, k=${publicKeyB64}`;
}

/**
 * Deliver one notification. Never throws: a single dead phone must not stop the
 * rest of the batch.
 *
 * `gone` marks a subscription the push service has retired (404/410) so the
 * caller can delete the row.
 */
export async function sendWebPush(subscription, payload, vapid, ttl = 86400) {
  try {
    const body = await encryptPayload(
      subscription.p256dh,
      subscription.auth_key,
      te.encode(JSON.stringify(payload))
    );
    const authorization = await vapidAuthHeader(
      subscription.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject
    );

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: 'normal',
      },
      body,
    });

    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: String(err && err.message || err) };
  }
}
