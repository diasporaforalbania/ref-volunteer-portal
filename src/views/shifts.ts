import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { fmtDate, fmtTime, toLocalInput } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openModal, closeModal } from '../components/modal';
import { slotsHtml } from '../components/slots';
import type { ShiftListItem, UnitRow } from '../types/database';

export const DAYS_SQ = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];

export function shiftWhen(s: ShiftListItem): string {
  const d = new Date(s.starts_at);
  return `${DAYS_SQ[d.getDay()]}, ${fmtDate(s.starts_at)} · ${fmtTime(s.starts_at)} – ${fmtTime(s.ends_at)}`;
}

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

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div>
        <h2 class="sec">Turnet</h2>
        <p class="sub" style="margin:0">Turnet e planifikuara të ekipit. Regjistrohuni që koordinatori të dijë sa veta do të jenë.</p>
      </div>
      ${canPlan ? `<button class="btn" id="btn_plan_shift">➕ Planifiko turn</button>` : ''}
    </div>

    ${shifts.length ? `
      <div class="grid" style="gap:14px">
        ${shifts.map(s => shiftCardHtml(s)).join('')}
      </div>` : '<div class="empty">Nuk ka turne të planifikuara për ditët në vijim.</div>'}`;

  document.getElementById('btn_plan_shift')?.addEventListener('click', () => openShiftModal(units));

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
}

export function shiftCardHtml(s: ShiftListItem): string {
  const over = Date.now() > new Date(s.ends_at).getTime();
  const canDel = s.created_by === store.ME?.id || store.isAdmin();

  return `
  <div class="card" style="${over ? 'opacity:.75' : ''}">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="row" style="gap:8px;align-items:center">
          <span class="unit-tag ${s.unit_is_open ? 'ok' : ''}">${esc(s.unit_code || '—')}</span>
          <div>
            <h3 style="margin:0">${esc(s.unit_name || '')}</h3>
            <div class="meta" style="text-transform:capitalize">${esc(shiftWhen(s))}</div>
          </div>
        </div>
        <div class="meta" style="margin-top:5px">
          Hapur nga <b>${esc(s.created_by_name || '—')}</b>
          ${s.notes ? ` · <i>${esc(s.notes)}</i>` : ''}
          ${!s.unit_is_open ? ' · <span class="pill amber">zona e mbyllur</span>' : ''}
        </div>
      </div>
      <div class="row" style="gap:6px">
        ${!over && store.isTeamRole() ? (
          s.i_am_in
            ? `<button class="btn red sm" data-leave-shift="${s.id}">Hiqem</button>`
            : `<button class="btn sec sm" data-join-shift="${s.id}">Regjistrohu</button>`
        ) : ''}
        ${canDel ? `<button class="btn ghost sm" data-del-shift="${s.id}" title="Fshi turnin">✕</button>` : ''}
      </div>
    </div>
    <div style="margin-top:10px">
      ${slotsHtml(s.id, s.signed, s.capacity)}
    </div>
  </div>`;
}

export function openShiftModal(units: UnitRow[]): void {
  const openUnits = units.filter(u => u.is_open);
  const now = new Date();
  const defStart = new Date(now.getTime() + 3600000);
  const defEnd = new Date(now.getTime() + 3 * 3600000);

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Planifiko një turn të ri</h3>
    <label>Zona / Njësia *</label>
    <select id="sh_unit">
      ${(openUnits.length ? openUnits : units).map(u => `
        <option value="${u.id}">${esc(u.code)} · ${esc(u.name)}${!u.is_open ? ' (e mbyllur)' : ''}</option>
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
    <label>Shënime (vendi i saktë, pika e takimit)</label>
    <textarea id="sh_notes" placeholder="p.sh. Te hyrja kryesore e parkut…"></textarea>
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
  if (!confirm('Të fshihet ky turn i planifikuar?')) return;
  const { error } = await sb.from('shifts').delete().eq('id', id);
  if (error) return fail(error);
  toast('Turni u fshi.');
  vShifts();
}
