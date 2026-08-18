import { store, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { avatarHtml } from '../api/storage';
import type { SlotParticipant } from '../types/app';
import type { VolunteerRole } from '../types/database';

export const SLOTS_MAX = 14;

export function slotsHtml(
  sid: string,
  signed: SlotParticipant[] | unknown,
  capacity: number | unknown,
  label?: string | null,
  cls?: string
): string {
  store.SLOTS[sid] = {
    signed: Array.isArray(signed) ? (signed as SlotParticipant[]) : [],
    capacity: Math.max(0, Number(capacity) || 0),
    label: label == null ? null : label,
  };
  return `<div class="slots ${cls || ''}" id="slots_${sid}">${slotsInner(sid)}</div>`;
}

export function slotsInner(sid: string): string {
  const s = store.SLOTS[sid] || { signed: [], capacity: 0, label: null };
  const shown = s.signed.slice(0, SLOTS_MAX);
  const holes = Math.max(0, Math.min(s.capacity - s.signed.length, SLOTS_MAX - shown.length));
  const hidden = s.signed.length - shown.length;

  const faces = shown.map((p, i) => {
    const key = sid + ':' + i;
    const open = store.SLOT_POP === key;
    const roleLabel = esc(ROLES[p.role as VolunteerRole] || p.role || '—');
    return `<span class="slot-p${open ? ' on' : ''}" data-slot-id="${sid}" data-slot-idx="${i}"
                  title="${esc(p.name || 'Vullnetar')}">
      ${avatarHtml(p.photo, p.name, 'slot-av')}
      ${open ? `<span class="slot-pop"><b>${esc(p.name || 'Vullnetar')}</b>
          <span class="meta">${roleLabel}</span></span>` : ''}
    </span>`;
  }).join('');

  const auto = s.capacity > 0
    ? `${s.signed.length} nga ${s.capacity} vende të zëna` +
      (s.signed.length >= s.capacity
        ? ' · plot'
        : ` · edhe ${s.capacity - s.signed.length} ${s.capacity - s.signed.length === 1 ? 'vend' : 'vende'}`)
    : `${s.signed.length} të regjistruar · pa kufi vendesh`;

  const text = [hidden ? `+${hidden}` : '', s.label == null ? auto : s.label].filter(Boolean).join(' · ');

  return (
    faces +
    Array.from({ length: holes }, () => `<span class="slot-e" title="vend i lirë"></span>`).join('') +
    (text ? `<span class="meta" style="margin-left:3px">${text}</span>` : '')
  );
}

export function slotPop(sid: string, i: number): void {
  const key = sid + ':' + i;
  store.SLOT_POP = store.SLOT_POP === key ? null : key;
  redrawSlots();
}

export function redrawSlots(): void {
  Object.keys(store.SLOTS).forEach(id => {
    const el = document.getElementById('slots_' + id);
    if (el) el.innerHTML = slotsInner(id);
  });
}

// Global click handler to close open slot popup
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (store.SLOT_POP && !target?.closest('.slot-p')) {
    store.SLOT_POP = null;
    redrawSlots();
  }
});
