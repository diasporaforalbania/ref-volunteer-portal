import type { SlippyMapPin, SlippyMapState } from '../types/app';
import { esc } from '../utils/security';
import { photoUrl } from '../api/storage';
import { dur, fmtTime } from '../utils/format';

export const TILE = 256;
let MAP: SlippyMapState | null = null;

export const lon2wx = (lon: number, z: number): number =>
  ((lon + 180) / 360) * Math.pow(2, z) * TILE;

export const lat2wy = (lat: number, z: number): number => {
  const r = Math.max(-85.05, Math.min(85.05, lat)) * (Math.PI / 180);
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z) * TILE;
};

export function destroyMap(): void {
  if (MAP?.off) MAP.off();
  MAP = null;
}

export function initMap(pins: SlippyMapPin[]): void {
  destroyMap();
  const el = document.getElementById('map');
  if (!el) return;
  const hint = document.getElementById('map_hint');

  if (!pins.length) {
    const tiles = document.getElementById('map_tiles');
    const pinsEl = document.getElementById('map_pins');
    if (tiles) tiles.innerHTML = '';
    if (pinsEl) pinsEl.innerHTML = '';
    el.insertAdjacentHTML(
      'beforeend',
      `<div class="map-msg" id="map_msg">Askush në terren me vendndodhje të ndarë.<br>
       Harta mbushet vetëm kur dikush bën check-in dhe lejon GPS-in.</div>`
    );
    if (hint) hint.textContent = '';
    return;
  }
  document.getElementById('map_msg')?.remove();

  const lats = pins.map(p => p.lat);
  const lngs = pins.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const w = el.clientWidth || 600;
  const h = el.clientHeight || 420;

  let z = 13;
  for (let t = 18; t >= 2; t--) {
    const dx = lon2wx(maxLng, t) - lon2wx(minLng, t);
    const dy = lat2wy(minLat, t) - lat2wy(maxLat, t);
    if (dx <= w - 90 && dy <= h - 90) {
      z = t;
      break;
    }
  }
  if (pins.length === 1) z = Math.min(z, 15);

  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  MAP = { el, pins, z, cx: lon2wx(cLng, z), cy: lat2wy(cLat, z), open: null };

  let dragging = false;
  let sx = 0;
  let sy = 0;
  let scx = 0;
  let scy = 0;

  const down = (e: MouseEvent | TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : e;
    dragging = true;
    sx = p.clientX;
    sy = p.clientY;
    if (MAP) {
      scx = MAP.cx;
      scy = MAP.cy;
    }
    el.classList.add('drag');
  };

  const move = (e: MouseEvent | TouchEvent) => {
    if (!dragging || !MAP) return;
    const p = 'touches' in e ? e.touches[0] : e;
    const dx = p.clientX - sx;
    const dy = p.clientY - sy;
    MAP.cx = scx - dx;
    MAP.cy = scy - dy;
    if (e.cancelable) e.preventDefault();
    drawMap();
  };

  const up = () => {
    dragging = false;
    el.classList.remove('drag');
  };

  const wheel = (e: WheelEvent) => {
    if (!MAP) return;
    e.preventDefault();
    mapZoom(e.deltaY < 0 ? 1 : -1);
  };

  el.addEventListener('mousedown', down);
  el.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('mousemove', move);
  el.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('mouseup', up);
  window.addEventListener('touchend', up);
  el.addEventListener('wheel', wheel, { passive: false });

  MAP.off = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    window.removeEventListener('touchend', up);
  };

  if (hint) {
    hint.textContent = `${pins.length} mbledhës në hartë · tërhiqni për ta lëvizur, + / − për zmadhim. Klikoni një pikë për detajet.`;
  }
  drawMap();
}

export function mapZoom(d: number): void {
  if (!MAP) return;
  const nz = Math.max(2, Math.min(18, MAP.z + d));
  if (nz === MAP.z) return;
  const f = Math.pow(2, nz - MAP.z);
  MAP.cx *= f;
  MAP.cy *= f;
  MAP.z = nz;
  drawMap();
}

export function drawMap(): void {
  if (!MAP) return;
  const { el, z } = MAP;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w || !h) return;

  const n = Math.pow(2, z);
  const left = MAP.cx - w / 2;
  const top = MAP.cy - h / 2;
  const tiles = document.getElementById('map_tiles');
  const pinsEl = document.getElementById('map_pins');
  if (!tiles || !pinsEl) return;

  const want = new Set<string>();
  const t0x = Math.floor(left / TILE);
  const t1x = Math.floor((left + w) / TILE);
  const t0y = Math.max(0, Math.floor(top / TILE));
  const t1y = Math.min(n - 1, Math.floor((top + h) / TILE));

  for (let ty = t0y; ty <= t1y; ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      const wx = ((tx % n) + n) % n;
      const key = `${z}/${wx}/${ty}`;
      want.add(key);
      let img = tiles.querySelector<HTMLImageElement>(`img[data-k="${key}"]`);
      if (!img) {
        img = document.createElement('img');
        img.dataset.k = key;
        img.src = `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`;
        img.alt = '';
        tiles.appendChild(img);
      }
      img.style.left = `${tx * TILE - left}px`;
      img.style.top = `${ty * TILE - top}px`;
    }
  }

  tiles.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    if (img.dataset.k && !want.has(img.dataset.k)) img.remove();
  });

  pinsEl.innerHTML = MAP.pins
    .map((p, i) => {
      const px = lon2wx(p.lng, z) - left;
      const py = lat2wy(p.lat, z) - top;
      if (px < -60 || px > w + 60 || py < -60 || py > h + 60) return '';
      const on = MAP?.open === String(i);
      const u = photoUrl(p.photo_path);
      const name = p.volunteer_name || 'Vullnetar';
      const initial = esc(name.trim().charAt(0).toUpperCase() || '?');
      const av = u
        ? `<img class="pv" src="${esc(u)}" alt="">`
        : `<div class="pv">${initial}</div>`;
      const popBelow = py < 130;

      const pop = on
        ? `<div class="map-pop${popBelow ? ' below' : ''}" style="left:${Math.max(10, Math.min(w - 220, px - 105))}px;top:${py}px">
            <span class="x" data-close-pin="true">✕</span>
            <b>${esc(name)}</b>
            <div class="meta">${p.unit_code ? 'Njësia ' + esc(p.unit_code) : ''} · ${esc(p.role || '')}</div>
            ${p.location_name ? `<div class="meta" style="margin-top:4px">📍 ${esc(p.location_name)}</div>` : ''}
            ${p.started_at ? `<div class="meta" style="margin-top:2px">Në terren prej ${dur(p.started_at)} (nga ${fmtTime(p.started_at)})</div>` : ''}
            <div style="margin-top:6px">
              <a class="link" target="_blank" rel="noopener"
                 href="https://www.google.com/maps?q=${p.lat},${p.lng}">Hap në Google Maps ↗</a>
            </div>
          </div>`
        : '';

      return `
        <div class="map-pin${on ? ' on' : ''}" data-pin-idx="${i}" style="left:${px}px;top:${py}px">
          ${av}<div class="pt"></div>
        </div>${pop}`;
    })
    .join('');
}
