import { ROLES } from '../state/store';
import { esc } from '../utils/security';
import { photoUrl } from '../api/storage';
import type { VolunteerRow } from '../types/database';
import QRCode from 'qrcode';

export function badgeCardHtml(v: VolunteerRow, qrCanvasId = 'badge_qr'): string {
  const u = photoUrl(v.photo_path);
  const roleName = esc(ROLES[v.role] || v.role);
  const unitText = v.units ? ' · ' + esc(v.units.name) : '';
  const cityText = v.city ? `<div class="badge-line">${esc(v.city)}</div>` : '';

  return `
  <div class="badge">
    <div class="badge-top">
      <div class="t1">Fushata për referendumin</div>
      <div class="t2">Karta e Vullnetarit</div>
    </div>
    <div class="badge-body">
      ${u
        ? `<img class="badge-photo" src="${esc(u)}" alt="${esc(v.full_name)}">`
        : `<div class="badge-photo ph">Ende pa foto.<br>Ngarkoni më poshtë.</div>`}
      <div>
        <div class="badge-name">${esc(v.full_name)}</div>
        <div class="badge-line">${roleName}${unitText}</div>
        ${cityText}
        <div class="badge-code">${esc(v.volunteer_code)}</div>
      </div>
    </div>
    <div class="badge-foot">
      <canvas class="qr" id="${qrCanvasId}"></canvas>
      <div class="vf">Skanoni me kamerë për të verifikuar vlefshmërinë e kësaj karte në portal.</div>
    </div>
  </div>`;
}

export async function renderBadgeQr(canvasId: string, verifyUrl: string): Promise<void> {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  try {
    await QRCode.toCanvas(canvas, verifyUrl, {
      width: 74,
      margin: 1,
      color: { dark: '#0f766e', light: '#ffffff' },
    });
  } catch (err) {
    console.error('Failed to render QR code:', err);
  }
}
