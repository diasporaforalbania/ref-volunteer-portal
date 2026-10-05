import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { fmtDate, fmtTime, toZonedInput, zonedDateTimeToIso, nf } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openModal, closeModal, confirmAction } from '../components/modal';
import { slotsHtml } from '../components/slots';
import type { ShiftListItem, UnitRow } from '../types/database';

export const DAYS_SQ = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
export const DEFAULT_SHIFT_TIME_ZONE = 'Europe/Tirane';
export const SHIFT_TIME_ZONES = [
  ['Europe/Athens', 'Evropa Lindore (Athinë)'],
  ['Europe/Tirane', 'Evropa Qendrore (Tiranë)'],
  ['Europe/London', 'Londër'],
  ['America/New_York', 'Nju Jork'],
  ['America/Los_Angeles', 'Kaliforni'],
  ['Australia/Melbourne', 'Melburn'],
  ['Australia/Sydney', 'Sidnej'],
] as const;

const zoneLabel = (zone: string): string => SHIFT_TIME_ZONES.find(([id]) => id === zone)?.[1] || zone;
const zoneOptions = (selected: string): string => SHIFT_TIME_ZONES.map(([id, label]) =>
  `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`
).join('');

const weekdayInZone = (ts: string, timeZone: string): string => {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date(ts));
  return DAYS_SQ[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)] || '';
};

export function shiftWhen(s: ShiftListItem): string {
  const zone = s.time_zone || DEFAULT_SHIFT_TIME_ZONE;
  return `${weekdayInZone(s.starts_at, zone)}, ${fmtDate(s.starts_at, zone)} · ${fmtTime(s.starts_at, zone)}–${fmtTime(s.ends_at, zone)} · ${zoneLabel(zone)}`;
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

    view.querySelectorAll<HTMLElement>('[data-copy-shift]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = shifts.find(x => x.id === btn.dataset.copyShift);
        if (s) openCopyShiftModal(s);
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
  const canCopy = store.isTeamLead() || admin;

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
        ${canCopy ? `<button class="btn ghost sm" data-copy-shift="${s.id}">Kopjo në ditë…</button>` : ''}
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
  const defStartInput = toZonedInput(defStart, DEFAULT_SHIFT_TIME_ZONE);
  const defEndInput = toZonedInput(defEnd, DEFAULT_SHIFT_TIME_ZONE);
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
        <label>Data e fillimit *</label>
        <input id="sh_start_date" type="date" value="${defStartInput.date}">
        <label>Ora (24-orëshe) *</label>
        <input id="sh_start_time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${defStartInput.time}">
      </div>
      <div style="flex:1">
        <label>Data e mbarimit *</label>
        <input id="sh_end_date" type="date" value="${defEndInput.date}">
        <label>Ora (24-orëshe) *</label>
        <input id="sh_end_time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${defEndInput.time}">
      </div>
    </div>
    <label>Zona kohore *</label>
    <select id="sh_zone">${zoneOptions(DEFAULT_SHIFT_TIME_ZONE)}</select>
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
  const startDate = (document.getElementById('sh_start_date') as HTMLInputElement | null)?.value || '';
  const startTime = (document.getElementById('sh_start_time') as HTMLInputElement | null)?.value || '';
  const endDate = (document.getElementById('sh_end_date') as HTMLInputElement | null)?.value || '';
  const endTime = (document.getElementById('sh_end_time') as HTMLInputElement | null)?.value || '';
  const time_zone = (document.getElementById('sh_zone') as HTMLSelectElement | null)?.value || DEFAULT_SHIFT_TIME_ZONE;
  const capInput = document.getElementById('sh_cap') as HTMLInputElement | null;
  const notesInput = document.getElementById('sh_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('sh_save_btn') as HTMLButtonElement | null;

  const unit_id = unitSelect?.value;
  const starts_at = zonedDateTimeToIso(startDate, startTime, time_zone);
  const ends_at = zonedDateTimeToIso(endDate, endTime, time_zone);
  const capacity = parseInt(capInput?.value || '0', 10) || 0;
  const notes = (notesInput?.value || '').trim() || null;

  if (!unit_id || !starts_at || !ends_at) return fail('Plotësoni datat dhe orët në formatin 24-orësh HH:MM.');
  if (new Date(ends_at) <= new Date(starts_at)) return fail('Mbarimi duhet të jetë pas fillimit.');

  if (btn) btn.disabled = true;

  const { error } = await sb.from('shifts').insert({
    unit_id,
    starts_at,
    ends_at,
    time_zone,
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

const addCalendarDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const copyShiftTimes = (s: ShiftListItem, date: string): { starts_at: string; ends_at: string } | null => {
  if (!Number.isFinite(Date.parse(`${date}T00:00:00Z`))) return null;
  const zone = s.time_zone || DEFAULT_SHIFT_TIME_ZONE;
  const start = toZonedInput(s.starts_at, zone);
  const end = toZonedInput(s.ends_at, zone);
  const dayOffset = (Date.parse(`${end.date}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / 86400000;
  const starts_at = zonedDateTimeToIso(date, start.time, zone);
  const ends_at = zonedDateTimeToIso(addCalendarDays(date, dayOffset), end.time, zone);
  return starts_at && ends_at && ends_at > starts_at && Date.parse(starts_at) > Date.now()
    ? { starts_at, ends_at } : null;
};

export function openCopyShiftModal(s: ShiftListItem): void {
  const zone = s.time_zone || DEFAULT_SHIFT_TIME_ZONE;
  const sourceDate = toZonedInput(s.starts_at, zone).date;
  const today = toZonedInput(new Date(), zone).date;
  const initialDate = addCalendarDays(sourceDate > today ? sourceDate : today, 1);
  const selected = new Set<string>();

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Kopjo turnin në ditë të zgjedhura</h3>
    <p class="meta" style="margin:0 0 12px">${esc(s.unit_code || '—')} · ${esc(shiftWhen(s))}<br>
      Kapaciteti: ${s.capacity === 0 ? 'pa kufi' : s.capacity} · Pika e takimit: ${esc(s.notes || '—')}</p>
    <label>Zgjidh një datë</label>
    <input id="copy_date" type="date" min="${today}" value="${initialDate}">
    <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
      <button class="btn sec sm" type="button" id="copy_add_date">Shto datën</button>
      <button class="btn ghost sm" type="button" id="copy_add_week">Shto të hënën–të premten e kësaj jave</button>
    </div>
    <div id="copy_preview" style="margin-top:14px"></div>
    <div class="notice warn" style="margin-top:12px">Kopjohen zona, orët, kapaciteti dhe pika e takimit. Pika e takimit shfaqet publikisht. Regjistrimet nuk kopjohen.</div>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="copy_save_btn" type="button" disabled>Krijo turnet</button>
      <button class="btn ghost" id="copy_cancel_btn" type="button">Anulo</button>
    </div>
  </div>`);

  const dateInput = document.getElementById('copy_date') as HTMLInputElement;
  const preview = document.getElementById('copy_preview') as HTMLElement;
  const saveBtn = document.getElementById('copy_save_btn') as HTMLButtonElement;

  const renderPreview = (): void => {
    const dates = [...selected].sort();
    preview.innerHTML = dates.length ? `
      <div class="meta" style="margin-bottom:8px">${dates.length} turne të reja · ${esc(zoneLabel(zone))}</div>
      <div style="max-height:230px;overflow:auto">
        ${dates.map(date => {
          const times = copyShiftTimes(s, date);
          return `<div class="row" style="justify-content:space-between;gap:8px;margin:5px 0">
            <span>${times ? esc(`${fmtDate(times.starts_at, zone)} · ${fmtTime(times.starts_at, zone)}–${fmtTime(times.ends_at, zone)}`) : esc(`${date} · orë e kaluar ose e pavlefshme`)}</span>
            <button class="btn ghost sm" type="button" data-copy-remove="${date}" aria-label="Hiq datën ${date}">✕</button>
          </div>`;
        }).join('')}
      </div>` : '<div class="meta">Shtoni datat ku doni ta kopjoni turnin.</div>';
    saveBtn.disabled = !dates.length || dates.some(date => !copyShiftTimes(s, date));
    preview.querySelectorAll<HTMLButtonElement>('[data-copy-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        selected.delete(btn.dataset.copyRemove || '');
        renderPreview();
      });
    });
  };

  const addDates = (dates: string[]): void => {
    if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) return fail('Zgjidhni një datë të vlefshme.');
    const next = new Set([...selected, ...dates]);
    if (next.size > 14) return fail('Mund të kopjoni deri në 14 ditë njëherësh.');
    if ([...next].some(date => date < today || date === sourceDate)) {
      return fail('Zgjidhni ditë të ardhshme, të ndryshme nga dita e turnit burim.');
    }
    selected.clear();
    next.forEach(date => selected.add(date));
    renderPreview();
  };

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('copy_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('copy_add_date')?.addEventListener('click', () => addDates([dateInput.value]));
  document.getElementById('copy_add_week')?.addEventListener('click', () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) || !Number.isFinite(Date.parse(`${dateInput.value}T00:00:00Z`))) {
      return fail('Zgjidhni një datë të vlefshme.');
    }
    const weekday = new Date(`${dateInput.value}T00:00:00Z`).getUTCDay();
    const monday = addCalendarDays(dateInput.value, -((weekday + 6) % 7));
    addDates(Array.from({ length: 5 }, (_, i) => addCalendarDays(monday, i)).filter(date => date >= today && date !== sourceDate));
  });
  saveBtn.addEventListener('click', async () => {
    const dates = [...selected].sort();
    const times = dates.map(date => copyShiftTimes(s, date));
    if (!dates.length || times.some(t => !t)) return fail('Kontrolloni datat dhe orët e turneve.');
    if (!store.ME?.id) return fail('Hyni përsëri për të planifikuar turne.');
    saveBtn.disabled = true;

    const rows = times.map(t => ({
      unit_id: s.unit_id,
      starts_at: t!.starts_at,
      ends_at: t!.ends_at,
      time_zone: zone,
      capacity: s.capacity,
      notes: s.notes,
      created_by: store.ME!.id,
      created_by_name: store.ME!.full_name || store.ME!.volunteer_code,
    }));
    const { data: existing, error: lookupError } = await sb.from('shifts')
      .select('starts_at').eq('unit_id', s.unit_id).in('starts_at', rows.map(row => row.starts_at));
    if (lookupError) {
      saveBtn.disabled = false;
      return fail(lookupError);
    }
    if (existing?.length) {
      saveBtn.disabled = false;
      return fail('Një ose më shumë turne ekzistojnë tashmë në këto orare. Hiqni datat e përsëritura.');
    }

    const { error } = await sb.from('shifts').insert(rows);
    if (error) {
      saveBtn.disabled = false;
      return fail(error);
    }
    closeModal();
    toast(`${rows.length} turne u planifikuan.`);
    vShifts();
  });
  renderPreview();
}

export function openEditShiftModal(s: ShiftListItem, units: UnitRow[]): void {
  const unit = units.find(u => u.id === s.unit_id);
  const unitLabel = `${unit?.code || s.unit_code || '—'} · ${unit?.name || s.unit_name || ''}`;
  const timeZone = s.time_zone || DEFAULT_SHIFT_TIME_ZONE;
  const startInput = toZonedInput(s.starts_at, timeZone);
  const endInput = toZonedInput(s.ends_at, timeZone);

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Ndrysho turnin</h3>
    <label>Zona / Njësia</label>
    <input value="${esc(unitLabel)}" disabled>
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Data e fillimit *</label>
        <input id="esh_start_date" type="date" value="${startInput.date}">
        <label>Ora (24-orëshe) *</label>
        <input id="esh_start_time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${startInput.time}">
      </div>
      <div style="flex:1">
        <label>Data e mbarimit *</label>
        <input id="esh_end_date" type="date" value="${endInput.date}">
        <label>Ora (24-orëshe) *</label>
        <input id="esh_end_time" type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${endInput.time}">
      </div>
    </div>
    <label>Zona kohore *</label>
    <select id="esh_zone">${zoneOptions(timeZone)}</select>
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
  const startDate = (document.getElementById('esh_start_date') as HTMLInputElement | null)?.value || '';
  const startTime = (document.getElementById('esh_start_time') as HTMLInputElement | null)?.value || '';
  const endDate = (document.getElementById('esh_end_date') as HTMLInputElement | null)?.value || '';
  const endTime = (document.getElementById('esh_end_time') as HTMLInputElement | null)?.value || '';
  const time_zone = (document.getElementById('esh_zone') as HTMLSelectElement | null)?.value || DEFAULT_SHIFT_TIME_ZONE;
  const capInput = document.getElementById('esh_cap') as HTMLInputElement | null;
  const notesInput = document.getElementById('esh_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('esh_save_btn') as HTMLButtonElement | null;

  const starts_at = zonedDateTimeToIso(startDate, startTime, time_zone);
  const ends_at = zonedDateTimeToIso(endDate, endTime, time_zone);
  const capacity = parseInt(capInput?.value || '0', 10) || 0;
  const notes = (notesInput?.value || '').trim() || null;

  if (!starts_at || !ends_at) return fail('Plotësoni datat dhe orët në formatin 24-orësh HH:MM.');
  if (new Date(ends_at) <= new Date(starts_at)) return fail('Mbarimi duhet të jetë pas fillimit.');

  if (btn) btn.disabled = true;

  const { error } = await sb.from('shifts').update({
    starts_at,
    ends_at,
    time_zone,
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
