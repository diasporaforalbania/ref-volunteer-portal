import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { fmtDate, fmtTime, toLocalInput, nf } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openModal, closeModal, confirmAction } from '../components/modal';
import { slotsHtml } from '../components/slots';
import type { ShiftListItem, UnitRow } from '../types/database';

export const DAYS_SQ = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];

export function shiftWhen(s: ShiftListItem): string {
  const d = new Date(s.starts_at);
  return `${DAYS_SQ[d.getDay()]}, ${fmtDate(s.starts_at)} · ${fmtTime(s.starts_at)} – ${fmtTime(s.ends_at)}`;
}

export type ShiftFilter = 'all' | 'mine' | 'upcoming' | 'open';
let currentShiftFilter: ShiftFilter = 'all';

export async function vShifts(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohen turnet…</div>';

  const [shiftsRes, unitsRes] = await Promise.all([
    sb.rpc('shift_list'),
    sb.from('units').select('id,code,name,is_open').order('code'),
  ]);

  if (shiftsRes.error) return fail(shiftsRes.error);
  const shifts = (shiftsRes.data || []) as ShiftListItem[];
  const units = (unitsRes.data || []) as UnitRow[];

  const canPlan = store.isTeamLead() || store.isAdmin();

  function renderView() {
    if (!view) return;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfTomorrow = todayStart + 2 * 86400000;

    const countAll = shifts.length;
    const countMine = shifts.filter(s => s.i_am_in).length;
    const countUpcoming = shifts.filter(s => {
      const t = new Date(s.starts_at).getTime();
      return t >= todayStart && t < endOfTomorrow;
    }).length;
    const countOpen = shifts.filter(s => {
      const isOver = Date.now() > new Date(s.ends_at).getTime();
      const isClosed = !!s.closed_at;
      const isFull = s.capacity > 0 && (s.signed?.length || 0) >= s.capacity;
      return !isOver && !isClosed && !isFull;
    }).length;

    const filtered = shifts.filter(s => {
      if (currentShiftFilter === 'mine') return s.i_am_in;
      if (currentShiftFilter === 'upcoming') {
        const t = new Date(s.starts_at).getTime();
        return t >= todayStart && t < endOfTomorrow;
      }
      if (currentShiftFilter === 'open') {
        const isOver = Date.now() > new Date(s.ends_at).getTime();
        const isClosed = !!s.closed_at;
        const isFull = s.capacity > 0 && (s.signed?.length || 0) >= s.capacity;
        return !isOver && !isClosed && !isFull;
      }
      return true;
    });

    view.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 class="sec">Turnet</h2>
          <p class="sub" style="margin:0">Turnet e planifikuara të ekipit. Regjistrohuni që koordinatori të dijë sa veta do të jenë.</p>
        </div>
        ${canPlan ? `<button class="btn" id="btn_plan_shift">➕ Planifiko turn</button>` : ''}
      </div>

      <div class="filter-bar">
        <button class="filter-chip ${currentShiftFilter === 'all' ? 'active' : ''}" data-shift-filter="all">
          Të gjitha <span class="count">${countAll}</span>
        </button>
        <button class="filter-chip ${currentShiftFilter === 'mine' ? 'active' : ''}" data-shift-filter="mine">
          Turnet e mia <span class="count">${countMine}</span>
        </button>
        <button class="filter-chip ${currentShiftFilter === 'upcoming' ? 'active' : ''}" data-shift-filter="upcoming">
          Sot & Nesër <span class="count">${countUpcoming}</span>
        </button>
        <button class="filter-chip ${currentShiftFilter === 'open' ? 'active' : ''}" data-shift-filter="open">
          Kërkojnë ndihmë <span class="count">${countOpen}</span>
        </button>
      </div>

      ${filtered.length ? `
        <div class="grid" style="gap:14px">
          ${filtered.map(s => shiftCardHtml(s)).join('')}
        </div>` : `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">🗓️</div>
          <div class="empty-state-title">Nuk ka turne për këtë përzgjedhje</div>
          <div class="empty-state-desc">
            ${currentShiftFilter === 'mine'
              ? 'Nuk jeni regjistruar ende në asnjë turn. Zgjidhni një turn nga lista dhe bashkohuni me ekipin!'
              : currentShiftFilter === 'upcoming'
              ? 'Nuk ka turne të planifikuara për sot ose nesër.'
              : currentShiftFilter === 'open'
              ? 'Të gjitha turnet aktive janë të plotësuara me mbledhës.'
              : 'Nuk ka turne të planifikuara për ditët në vijim.'}
          </div>
          ${canPlan ? `<button class="btn" id="btn_plan_shift_empty">➕ Planifiko një turn të ri</button>` : ''}
        </div>`}
    `;

    document.getElementById('btn_plan_shift')?.addEventListener('click', () => openShiftModal(units));
    document.getElementById('btn_plan_shift_empty')?.addEventListener('click', () => openShiftModal(units));

    view.querySelectorAll<HTMLElement>('[data-shift-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentShiftFilter = (btn.dataset.shiftFilter || 'all') as ShiftFilter;
        renderView();
      });
    });

    view.querySelectorAll<HTMLElement>('[data-join-shift]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.joinShift;
        if (id) {
          await joinShift(id);
          vShifts();
        }
      });
    });

    view.querySelectorAll<HTMLElement>('[data-leave-shift]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.leaveShift;
        if (id) {
          await leaveShift(id);
          vShifts();
        }
      });
    });

    view.querySelectorAll<HTMLElement>('[data-del-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delShift;
        if (id) delShift(id);
      });
    });

    view.querySelectorAll<HTMLElement>('[data-edit-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = shifts.find(x => x.id === btn.dataset.editShift);
        if (s) openEditShiftModal(s, units);
      });
    });

    view.querySelectorAll<HTMLElement>('[data-close-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = shifts.find(x => x.id === btn.dataset.closeShift);
        if (s) openAdminCloseModal(s);
      });
    });
  }

  renderView();
}

export function shiftCardHtml(s: ShiftListItem): string {
  const over = Date.now() > new Date(s.ends_at).getTime();
  const closed = !!s.closed_at;
  const admin = store.isAdmin();
  const canDel = s.created_by === store.ME?.id || admin;
  // Adminët redaktojnë çdo turn dhe mbyllin çdo turn ende të hapur — pa u kufizuar
  // nga cila njësi është apo nga kush ka bërë check-in brenda.
  const canEdit = admin && !closed;
  const canClose = admin && !closed;

  return `
  <div class="card" style="${closed ? 'border-color:var(--line);' : ''}">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:240px">
        <div class="row" style="gap:10px;align-items:center">
          <span class="unit-tag ${s.unit_is_open ? 'ok' : ''}" style="font-weight:700;font-size:12px;padding:3px 9px">${esc(s.unit_code || '—')}</span>
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--ink)">${esc(s.unit_name || '')}</h3>
            <div class="meta" style="text-transform:capitalize;display:flex;align-items:center;gap:5px;margin-top:2px">
              <span class="stat-icon" style="width:18px;height:18px;border-radius:4px;font-size:11px" aria-hidden="true">🗓️</span>
              <span>${esc(shiftWhen(s))}</span>
            </div>
          </div>
        </div>
        <div class="meta" style="margin-top:8px;font-size:12.5px;line-height:1.5">
          Hapur nga <b>${esc(s.created_by_name || '—')}</b>
          ${s.notes ? ` · <i style="color:var(--text)">${esc(s.notes)}</i>` : ''}
          ${!s.unit_is_open ? ' · <span class="pill amber">zona e mbyllur</span>' : ''}
          ${closed ? ' · <span class="pill gray">i mbyllur</span>'
            : over ? ' · <span class="pill amber">ka përfunduar</span>'
            : s.checked_in_count ? ` · <span class="pill ok">● ${s.checked_in_count} në terren</span>` : ''}
          ${closed && s.signatures != null ? ` · <b>${nf(s.signatures)} firma</b>` : ''}
        </div>
      </div>
      <div class="row" style="gap:6px;align-items:center">
        ${!over && !closed && store.isTeamRole() ? (
          s.i_am_in
            ? `<button class="btn red sm" data-leave-shift="${s.id}">✕ Hiqem</button>`
            : `<button class="btn sec sm" data-join-shift="${s.id}">✓ Bashkohu</button>`
        ) : ''}
        ${canClose ? `<button class="btn red sm" data-close-shift="${s.id}">Mbyll turnin</button>` : ''}
        ${canEdit ? `<button class="btn ghost sm" data-edit-shift="${s.id}" title="Ndrysho turnin">✎</button>` : ''}
        ${canDel ? `<button class="btn ghost sm" data-del-shift="${s.id}" title="Fshi turnin">✕</button>` : ''}
      </div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
      ${slotsHtml(s.id, s.signed, s.capacity)}
    </div>
  </div>`;
}

export function openShiftModal(units: UnitRow[]): void {
  const openUnits = units.filter(u => u.is_open);
  const now = new Date();
  const defStart = new Date(now.getTime() + 3600000);
  const defEnd = new Date(now.getTime() + 3 * 3600000);
  const myUnitId = store.ME?.unit_id;

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Planifiko një turn të ri</h3>
    <label>Zona / Njësia *</label>
    <select id="sh_unit">
      ${(openUnits.length ? openUnits : units).map(u => `
        <option value="${u.id}" ${u.id === myUnitId ? 'selected' : ''}>${esc(u.code)} · ${esc(u.name)}${!u.is_open ? ' (e mbyllur)' : ''}</option>
      `).join('')}
    </select>
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Fillon *</label>
        <input id="sh_start" type="datetime-local" value="${toLocalInput(defStart)}">
      </div>
      <div style="flex:1">
        <label>Mbaron *</label>
        <input id="sh_end" type="datetime-local" value="${toLocalInput(defEnd)}">
      </div>
    </div>
    <label>Kapaciteti (sa veta kërkohen, 0 = pa kufi)</label>
    <input id="sh_cap" type="number" min="0" value="4">
    <label>Pika e saktë e takimit</label>
    <textarea id="sh_notes" placeholder="p.sh. Te hyrja kryesore e parkut…"></textarea>
    <div class="notice warn" style="margin-top:6px">⚠️ Ky tekst shfaqet <b>publikisht</b> te faqja e referendumit, si vendi ku qytetarët vijnë të nënshkruajnë. Mos shkruani emra, numra telefoni apo shënime të brendshme.</div>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="sh_save_btn">Ruaj turnin</button>
      <button class="btn ghost" id="sh_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('sh_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('sh_save_btn')?.addEventListener('click', saveShift);
}

export async function saveShift(): Promise<void> {
  const unitSelect = document.getElementById('sh_unit') as HTMLSelectElement | null;
  const startInput = document.getElementById('sh_start') as HTMLInputElement | null;
  const endInput = document.getElementById('sh_end') as HTMLInputElement | null;
  const capInput = document.getElementById('sh_cap') as HTMLInputElement | null;
  const notesInput = document.getElementById('sh_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('sh_save_btn') as HTMLButtonElement | null;

  const unit_id = unitSelect?.value;
  const starts_at = startInput?.value;
  const ends_at = endInput?.value;
  const capacity = parseInt(capInput?.value || '0', 10) || 0;
  const notes = (notesInput?.value || '').trim() || null;

  if (!unit_id || !starts_at || !ends_at) return fail('Plotësoni të gjitha fushat e detyrueshme.');
  if (new Date(ends_at) <= new Date(starts_at)) return fail('Mbarimi duhet të jetë pas fillimit.');

  if (btn) btn.disabled = true;

  const { error } = await sb.from('shifts').insert({
    unit_id,
    starts_at: new Date(starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    capacity,
    notes,
    created_by: store.ME?.id,
    created_by_name: store.ME?.full_name || store.ME?.volunteer_code,
  });

  if (error) {
    if (btn) btn.disabled = false;
    return fail(error);
  }

  closeModal();
  toast('Turni u planifikua.');
  vShifts();
}

export function openEditShiftModal(s: ShiftListItem, units: UnitRow[]): void {
  const unit = units.find(u => u.id === s.unit_id);
  const unitLabel = `${unit?.code || s.unit_code || '—'} · ${unit?.name || s.unit_name || ''}`;

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Ndrysho turnin</h3>
    <label>Zona / Njësia</label>
    <input value="${esc(unitLabel)}" disabled>
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Fillon *</label>
        <input id="esh_start" type="datetime-local" value="${toLocalInput(new Date(s.starts_at))}">
      </div>
      <div style="flex:1">
        <label>Mbaron *</label>
        <input id="esh_end" type="datetime-local" value="${toLocalInput(new Date(s.ends_at))}">
      </div>
    </div>
    <label>Kapaciteti (sa veta kërkohen, 0 = pa kufi)</label>
    <input id="esh_cap" type="number" min="0" value="${s.capacity}">
    <label>Pika e saktë e takimit</label>
    <textarea id="esh_notes" placeholder="p.sh. Te hyrja kryesore e parkut…">${esc(s.notes || '')}</textarea>
    <div class="notice warn" style="margin-top:6px">⚠️ Ky tekst shfaqet <b>publikisht</b> te faqja e referendumit, si vendi ku qytetarët vijnë të nënshkruajnë. Mos shkruani emra, numra telefoni apo shënime të brendshme.</div>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="esh_save_btn">Ruaj ndryshimet</button>
      <button class="btn ghost" id="esh_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('esh_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('esh_save_btn')?.addEventListener('click', () => saveShiftEdit(s.id));
}

export async function saveShiftEdit(id: string): Promise<void> {
  const startInput = document.getElementById('esh_start') as HTMLInputElement | null;
  const endInput = document.getElementById('esh_end') as HTMLInputElement | null;
  const capInput = document.getElementById('esh_cap') as HTMLInputElement | null;
  const notesInput = document.getElementById('esh_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('esh_save_btn') as HTMLButtonElement | null;

  const starts_at = startInput?.value;
  const ends_at = endInput?.value;
  const capacity = parseInt(capInput?.value || '0', 10) || 0;
  const notes = (notesInput?.value || '').trim() || null;

  if (!starts_at || !ends_at) return fail('Plotësoni orarin e turnit.');
  if (new Date(ends_at) <= new Date(starts_at)) return fail('Mbarimi duhet të jetë pas fillimit.');

  if (btn) btn.disabled = true;

  const { error } = await sb.from('shifts').update({
    starts_at: new Date(starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    capacity,
    notes,
  }).eq('id', id);

  if (error) {
    if (btn) btn.disabled = false;
    return fail(error);
  }

  closeModal();
  toast('Turni u përditësua.');
  vShifts();
}

export function openAdminCloseModal(s: ShiftListItem): void {
  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Mbyll turnin</h3>
    <div class="meta" style="margin-bottom:10px;text-transform:capitalize">
      ${esc((s.unit_code || '—') + ' · ' + (s.unit_name || ''))} · ${esc(shiftWhen(s))}
      ${s.checked_in_count ? ` · <b>${s.checked_in_count} në terren tani</b>` : ''}
    </div>
    <div class="notice warn" style="margin-bottom:12px">Po e mbyllni si administrator.
      Dalin nga terreni të gjithë ata të ekipit që bënë check-in te ky turn.</div>
    <label>Sa nënshkrime mblodhi ekipi gjithsej? *</label>
    <input id="ash_sig" type="number" min="0" step="1" inputmode="numeric" placeholder="0"
           value="${s.signatures || ''}">
    <label>Shënime (opsionale)</label>
    <textarea id="ash_notes" placeholder="si shkoi, çfarë duhet ditur…"></textarea>
    <div class="row" style="margin-top:16px">
      <button class="btn red" id="ash_save_btn">Mbyll turnin</button>
      <button class="btn ghost" id="ash_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('ash_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('ash_save_btn')?.addEventListener('click', () => adminCloseShift(s.id));
}

export async function adminCloseShift(id: string): Promise<void> {
  const sigInput = document.getElementById('ash_sig') as HTMLInputElement | null;
  const notesInput = document.getElementById('ash_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('ash_save_btn') as HTMLButtonElement | null;

  const sig = parseInt(sigInput?.value || '', 10);
  if (isNaN(sig) || sig < 0) return fail('Shkruani sa nënshkrime u mblodhën (0 nëse asnjë).');

  if (btn) btn.disabled = true;
  const { error } = await sb.rpc('shift_check_out', {
    p_shift: id,
    p_signatures: sig,
    p_notes: (notesInput?.value || '').trim() || null,
  });
  if (btn) btn.disabled = false;

  if (error) return fail(error);

  closeModal();
  toast(`Turni u mbyll · ${nf(sig)} nënshkrime.`);
  vShifts();
}

export async function joinShift(shiftId: string): Promise<void> {
  const { error } = await sb.rpc('shift_join', { p_shift: shiftId });
  if (error) return fail(error);
  toast('U regjistruat në turn.');
}

export async function leaveShift(shiftId: string): Promise<void> {
  const { error } = await sb.rpc('shift_leave', { p_shift: shiftId });
  if (error) return fail(error);
  toast('U hoqët nga turni.');
}

export async function delShift(id: string): Promise<void> {
  const ok = await confirmAction({
    title: 'Fshi turnin',
    message: 'A jeni i sigurt që dëshironi të fshini këtë turn të planifikuar?',
    confirmText: 'Fshi turnin',
    confirmClass: 'btn-danger',
    icon: '🗑️'
  });
  if (!ok) return;
  const { error } = await sb.from('shifts').delete().eq('id', id);
  if (error) return fail(error);
  toast('Turni u fshi.');
  vShifts();
}
