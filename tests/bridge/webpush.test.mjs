import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  encryptPayload,
  vapidAuthHeader,
  b64urlToBytes,
  bytesToB64url,
  concatBytes,
  hkdf,
} from '../../functions/api/_webpush.js';

const te = new TextEncoder();
const td = new TextDecoder();

/** Stand in for a browser subscribing: an ECDH keypair plus a 16-byte secret. */
async function fakeSubscription() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    privateKey: kp.privateKey,
    p256dh: bytesToB64url(raw),
    auth_key: bytesToB64url(authSecret),
    uaPublicRaw: raw,
    authSecret,
  };
}

/**
 * The receiving half of RFC 8291, written out independently here. If the sender
 * and this both agree on a wrong spec they would still round-trip, so the
 * fixed header fields are asserted separately below.
 */
async function decrypt(sub, body) {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ciphertext = body.slice(21 + idlen);

  const senderKey = await crypto.subtle.importKey(
    'raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, sub.privateKey, 256)
  );

  const keyInfo = concatBytes(te.encode('WebPush: info'), new Uint8Array([0]), sub.uaPublicRaw, asPublic);
  const ikm = await hkdf(shared, sub.authSecret, keyInfo, 32);
  const cek = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ciphertext)
  );
  return { plain, recordSize, idlen, asPublic, salt };
}

describe('Suite 8: Web Push payload encryption (RFC 8291)', () => {
  it('round-trips a notification payload back to the exact bytes sent', async () => {
    const sub = await fakeSubscription();
    const payload = { title: '🚨 Raportim i ri', body: 'Sheshi Skënderbej', url: './#reports', tag: 'rep-1' };

    const body = await encryptPayload(sub.p256dh, sub.auth_key, te.encode(JSON.stringify(payload)));
    const { plain } = await decrypt(sub, body);

    // Last record carries the 0x02 delimiter; everything before it is the payload.
    assert.equal(plain[plain.length - 1], 2, 'final record must end with the 0x02 delimiter');
    assert.deepEqual(JSON.parse(td.decode(plain.slice(0, -1))), payload);
  });

  it('survives non-ASCII Albanian text without corruption', async () => {
    const sub = await fakeSubscription();
    const text = 'Përshëndetje — çështje urgjente në Krujë, mbledhësit e autorizuar njoftohen menjëherë.';
    const body = await encryptPayload(sub.p256dh, sub.auth_key, te.encode(text));
    const { plain } = await decrypt(sub, body);
    assert.equal(td.decode(plain.slice(0, -1)), text);
  });

  it('lays out the aes128gcm header exactly as RFC 8188 §2.1 specifies', async () => {
    const sub = await fakeSubscription();
    const body = await encryptPayload(sub.p256dh, sub.auth_key, te.encode('x'));
    const { recordSize, idlen, asPublic, salt } = await decrypt(sub, body);

    assert.equal(salt.length, 16, 'salt is 16 bytes');
    assert.equal(recordSize, 4096, 'record size field');
    assert.equal(idlen, 65, 'keyid length is the uncompressed P-256 point length');
    assert.equal(asPublic[0], 4, 'sender key is an uncompressed point');
    assert.equal(body.length, 21 + 65 + (1 + 1) + 16, 'header + key + padded plaintext + GCM tag');
  });

  it('uses a fresh ephemeral key and salt for every message', async () => {
    const sub = await fakeSubscription();
    const a = await encryptPayload(sub.p256dh, sub.auth_key, te.encode('same'));
    const b = await encryptPayload(sub.p256dh, sub.auth_key, te.encode('same'));

    assert.notDeepEqual(a.slice(0, 16), b.slice(0, 16), 'salt must not repeat');
    assert.notDeepEqual(a.slice(21, 86), b.slice(21, 86), 'ephemeral key must not repeat');
    assert.notDeepEqual(a.slice(86), b.slice(86), 'identical plaintext must not produce identical ciphertext');
  });
});

describe('Suite 9: VAPID authorization (RFC 8292)', () => {
  /** Mirrors the key-generation snippet documented in PUSH_SETUP.md. */
  async function fakeVapidKeys() {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    return { publicKey: bytesToB64url(raw), privateKey: jwk.d, verifyKey: kp.publicKey };
  }

  it('produces a signature that verifies against the advertised public key', async () => {
    const keys = await fakeVapidKeys();
    const header = await vapidAuthHeader(
      'https://fcm.googleapis.com/fcm/send/abc123', keys.publicKey, keys.privateKey, 'mailto:qendra@referendum21.org'
    );

    const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/) || [];
    assert.ok(t, 'header carries the JWT');
    assert.equal(k, keys.publicKey, 'header advertises the same public key');

    const [h, p, sig] = t.split('.');
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keys.verifyKey,
      b64urlToBytes(sig),
      te.encode(`${h}.${p}`)
    );
    assert.equal(ok, true, 'signature must verify — a bad one is rejected by the push service');
  });

  it('scopes the token to the push service origin and expires within 24h', async () => {
    const keys = await fakeVapidKeys();
    const header = await vapidAuthHeader(
      'https://updates.push.services.mozilla.com/wpush/v2/xyz', keys.publicKey, keys.privateKey, 'mailto:qendra@referendum21.org'
    );
    const claims = JSON.parse(td.decode(b64urlToBytes(header.split('.')[1])));

    assert.equal(claims.aud, 'https://updates.push.services.mozilla.com', 'aud is the origin, not the full endpoint');
    assert.equal(claims.sub, 'mailto:qendra@referendum21.org');
    const hoursOut = (claims.exp - Math.floor(Date.now() / 1000)) / 3600;
    assert.ok(hoursOut > 0 && hoursOut <= 24, `exp must be inside 24h, got ${hoursOut}h`);
  });

  it('rejects a malformed public key instead of signing something unusable', async () => {
    const keys = await fakeVapidKeys();
    await assert.rejects(
      () => vapidAuthHeader('https://example.com/p', bytesToB64url(new Uint8Array(10)), keys.privateKey, 'mailto:a@b.c'),
      /65-byte uncompressed P-256 point/
    );
  });
});
