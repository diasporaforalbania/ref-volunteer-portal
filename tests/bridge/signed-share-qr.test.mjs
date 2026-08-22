import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * QR-i «Sapo nënshkrova» duhet të çojë VETËM te faqja publike, pa PII.
 * Një parametër i shtuar këtu (kod vullnetari, check-in, emër) do të dilte
 * në kamerën e qytetarit dhe do të thyente izolimin e landing-ut nga baza.
 */
describe('Suite 9: signed-share QR is a fixed public landing URL', () => {
  const signedQr = readFileSync(new URL('../../src/components/signedQr.ts', import.meta.url), 'utf8');
  const field = readFileSync(new URL('../../src/views/field.ts', import.meta.url), 'utf8');

  it('exports a hardcoded https landing URL at /signed', () => {
    assert.match(
      signedQr,
      /export const LANDING_SIGNED_URL = 'https:\/\/referendum21\.org\/signed'/
    );
    assert.doesNotMatch(signedQr, /LANDING_SIGNED_URL = `/, 'URL-ja nuk duhet të jetë template i interpoluar');
    assert.doesNotMatch(signedQr, /location\.origin/, 'QR-i nuk duhet të tregojë te portali');
    assert.doesNotMatch(signedQr, /[?&]v=/);
    assert.doesNotMatch(signedQr, /volunteer_id|checkin_id|photo_path/);
  });

  it('renders the QR only from the fixed URL', () => {
    assert.match(signedQr, /QRCode\.toCanvas\(canvas, LANDING_SIGNED_URL/);
  });

  it('surfaces the QR on an open field check-in', () => {
    assert.match(field, /signedQrStripHtml/);
    assert.match(field, /attachSignedQr/);
    assert.match(field, /from '\.\.\/components\/signedQr'/);
  });
});
