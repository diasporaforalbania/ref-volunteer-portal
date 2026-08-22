import QRCode from 'qrcode';
import { openModal, closeModal } from './modal';

/**
 * Destinacioni i vetëm i QR-it «Sapo nënshkrova».
 * HTTPS fiks te faqja publike — kurrë portali, kurrë query params, kurrë ID.
 */
export const LANDING_SIGNED_URL = 'https://referendum21.org/signed';

const QR_DARK = '#0E3D2D';
const QR_LIGHT = '#ffffff';

export async function renderSignedQr(canvasId: string, size: number): Promise<void> {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  try {
    await QRCode.toCanvas(canvas, LANDING_SIGNED_URL, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: QR_DARK, light: QR_LIGHT },
    });
  } catch (err) {
    console.error('Failed to render signed-share QR:', err);
  }
}

export function signedQrStripHtml(): string {
  return `
    <div class="signed-qr-strip">
      <canvas class="signed-qr-strip__canvas" id="field_signed_qr" width="132" height="132" aria-hidden="true"></canvas>
      <div class="signed-qr-strip__copy">
        <div class="signed-qr-strip__title">Sapo nënshkrove?</div>
        <div class="meta">Qytetari skanon kodin — hapet karta për Instagram Story dhe WhatsApp Status. Nuk mblidhet asnjë e dhënë personale.</div>
        <button type="button" class="btn sec sm" id="btn_signed_qr">Zmadho QR</button>
      </div>
    </div>`;
}

export function openSignedQrModal(): void {
  openModal(`
    <div class="modal signed-qr-modal">
      <button class="modal-x" id="modal_close_btn" type="button" aria-label="Mbyll">✕</button>
      <h3>Tregoja qytetarit</h3>
      <p class="meta">Pas nënshkrimit në letër, qytetari skanon këtë kod me kamerën e telefonit.</p>
      <div class="signed-qr-modal__frame">
        <canvas id="signed_qr_modal_canvas" width="320" height="320"></canvas>
      </div>
      <div class="signed-qr-modal__url">referendum21.org/signed</div>
      <p class="hint">Kodi është i njëjtë për të gjithë. Nuk përmban emër, telefon, as identifikues vullnetari.</p>
      <div class="row" style="margin-top:14px">
        <button type="button" class="btn ghost" id="signed_qr_done">Mbyll</button>
      </div>
    </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('signed_qr_done')?.addEventListener('click', closeModal);
  void renderSignedQr('signed_qr_modal_canvas', 320);
}

export function attachSignedQr(): void {
  void renderSignedQr('field_signed_qr', 132);
  document.getElementById('btn_signed_qr')?.addEventListener('click', openSignedQrModal);
}
