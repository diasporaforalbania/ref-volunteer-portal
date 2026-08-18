import { sb } from './client';
import { esc } from '../utils/security';

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return sb.storage.from('vol-photos').getPublicUrl(path).data.publicUrl;
}

export function matUrl(path: string): string {
  return sb.storage.from('vol-materials').getPublicUrl(path).data.publicUrl;
}

export function avatarHtml(path: string | null | undefined, name: string | null | undefined, cls = 'mini-av'): string {
  const u = photoUrl(path);
  const initial = esc(((name || '?').trim().charAt(0).toUpperCase() || '?'));
  return u
    ? `<img class="${cls}" src="${esc(u)}" alt="${esc(name || '')}">`
    : `<div class="${cls}" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:#5b7377;font-size:13px">${initial}</div>`;
}
