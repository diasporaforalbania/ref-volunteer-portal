import { sb } from '../api/client';
import { store } from '../state/store';
import { esc, truncate } from '../utils/security';
import { nf, fmtDate, fmtTime, dur, toLocalInput } from '../utils/format';
import { toast, fail } from '../components/toast';
import { statCard } from './home';
import { openModal, closeModal } from '../components/modal';
import type { HistoryRowItem, HistorySummaryResult, UnitTotalItem } from '../types/database';

export async function vHistory(): Promise<void> {
  const view = document.getElementById('view');
  if (!view || (!store.isAdmin() && !store.isStaff())) return;
  view.innerHTML = '<div class="empty">Po ngarkohet historiku…</div>';

  store.HIST.page = 1;
  const [unitsRes] = await Promise.all([
    sb.rpc('unit_totals'),
  ]);

  if (unitsRes.error) return fail(unitsRes.error);
  store.HIST.units = (unitsRes.data || []) as UnitTotalItem[];

  await loadHistoryData();
  renderHistory();
}

export async function loadHistoryData(): Promise<void> {
  const pUnit = store.HIST.unit || null;
  const pFrom = store.HIST.from || null;
  const pTo = store.HIST.to || null;
  const pLimit = store.HIST.limit || 100;
  const pOffset = (store.HIST.page - 1) * pLimit;

  // Try server-side paginated RPC first, fallback to unit_history if not migrated
  const [pagRes, sumRes] = await Promise.all([
    sb.rpc('unit_history_paginated', {
      p_unit: pUnit,
      p_from: pFrom,
      p_to: pTo,
      p_limit: pLimit,
      p_offset: pOffset,
    }),
    sb.rpc('unit_history_summary', {
      p_unit: pUnit,
      p_from: pFrom,
      p_to: pTo,
    }),
  ]);

  if (pagRes.error) {
    // Fallback to legacy unpaginated RPC
    const legacy = await sb.rpc('unit_history');
    if (legacy.error) return fail(legacy.error);
    const all = (legacy.data || []) as HistoryRowItem[];
    const filtered = all.filter(r => {
      if (pUnit && r.unit_id !== pUnit) return false;
      const d = r.started_at ? r.started_at.slice(0, 10) : '';
      if (pFrom && d < pFrom) return false;
      if (pTo && d > pTo) return false;
      return true;
    });

    store.HIST.rows = filtered.slice(pOffset, pOffset + pLimit);
    store.HIST.totalRows = filtered.length;
    store.HIST.summary = {
      total_signatures: filtered.reduce((a, r) => a + (r.signatures || 0), 0),
      total_shifts: filtered.length,
      open_shifts: filtered.filter(r => !r.ended_at).length,
      active_units: new Set(filtered.map(r => r.unit_id).filter(Boolean)).size,
    };
  } else {
    store.HIST.rows = (pagRes.data || []) as HistoryRowItem[];
    const sum = sumRes.data as HistorySummaryResult | null;
    store.HIST.summary = sum || {
      total_signatures: 0,
      total_shifts: 0,
      open_shifts: 0,
      active_units: 0,
    };
    store.HIST.totalRows = store.HIST.summary?.total_shifts || store.HIST.rows.length;
  }
}

export function renderHistory(): void {
  const view = document.getElementById('view');
  if (!view) return;

  const sum = store.HIST.summary || {
    total_signatures: 0,
    total_shifts: 0,
    open_shifts: 0,
    active_units: 0,
  };
  const totalPages = Math.max(1, Math.ceil(store.HIST.totalRows / store.HIST.limit));

  view.innerHTML = `
    <h2 class="sec">Historiku i njësive</h2>
    <p class="sub">Çdo turn i regjistruar, sipas njësisë. Numrat këtu janë burimi i shifrës së përgjithshme të fushatës — korrigjoni këtu kur dikush ka gabuar.</p>

    <div class="grid g4" style="margin-bottom:18px">
      ${statCard('var(--teal)', nf(sum.total_signatures), 'Firma (në filtër)')}
      ${statCard('var(--cyan)', nf(sum.total_shifts), 'Turne')}
      ${statCard('var(--amber)', nf(sum.open_shifts), 'Turne pa mbyllur')}
      ${statCard('var(--green)', nf(sum.active_units), 'Njësi me aktivitet')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="row" style="align-items:flex-end">
        <div style="flex:2;min-width:180px">
          <label style="margin-top:0">Filtro sipas njësisë</label>
          <select id="hf_unit">
            <option value="">Të gjitha njësitë</option>
            ${store.HIST.units.map(u => `
              <option value="${u.id}" ${u.id === store.HIST.unit ? 'selected' : ''}>
                ${esc(u.code)} · ${esc(u.name)} (${nf(u.signatures)} firma)
              </option>
            `).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:130px">
          <label style="margin-top:0">Nga data</label>
          <input id="hf_from" type="date" value="${store.HIST.from}">
        </div>
        <div style="flex:1;min-width:130px">
          <label style="margin-top:0">Deri më</label>
          <input id="hf_to" type="date" value="${store.HIST.to}">
        </div>
        <div class="row" style="gap:6px">
          <button class="btn sec" id="hf_apply">Filtro</button>
          <button class="btn ghost" id="hf_reset">Pastro</button>
          <button class="btn sec" id="hf_csv" title="Shkarko CSV">📥 CSV</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h3>Turnet e regjistruara</h3>
        <span class="meta">Faqja ${store.HIST.page} nga ${totalPages} (${store.HIST.totalRows} turne gjithsej)</span>
      </div>

      <div class="scroll-x" style="margin-top:10px">
        <table class="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Njësia</th>
              <th>Vullnetari</th>
              <th>Pika</th>
              <th>Kohëzgjatja</th>
              <th style="text-align:right">Nënshkrime</th>
              <th>Shënime</th>
              <th style="text-align:right">Veprime</th>
            </tr>
          </thead>
          <tbody>
            ${store.HIST.rows.map(r => `
              <tr>
                <td>${fmtDate(r.started_at)}</td>
                <td><span class="unit-tag" style="font-size:13px;padding:3px 8px">${esc(r.unit_code || '—')}</span></td>
                <td><b>${esc(r.volunteer_name || '—')}</b></td>
                <td>${esc(truncate(r.location_name, 22) || '—')}</td>
                <td>${r.ended_at ? dur(r.started_at, r.ended_at) : '<span class="pill ok">hapur</span>'}</td>
                <td style="text-align:right">
                  <b>${nf(r.signatures)}</b>
                  ${r.shift_id && !r.is_lead ? '<div class="meta">ekip</div>' : ''}
                </td>
                <td class="meta">${esc(truncate(r.notes, 28) || '—')}</td>
                <td style="text-align:right">
                  ${store.isAdmin() ? `
                  <div class="row" style="justify-content:flex-end;gap:4px">
                    <button class="btn ghost sm" data-edit-chk="${r.id}" title="Ndrysho">✏️</button>
                    <button class="btn ghost sm" data-del-chk="${r.id}" title="Fshi">✕</button>
                  </div>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${!store.HIST.rows.length ? '<div class="empty">Nuk ka turne për filtrat e zgjedhur.</div>' : ''}
      </div>

      ${totalPages > 1 ? `
        <div class="row" style="justify-content:center;margin-top:16px;gap:8px">
          <button class="btn sec sm" id="btn_page_prev" ${store.HIST.page <= 1 ? 'disabled' : ''}>← Prapa</button>
          <span class="meta">Faqja ${store.HIST.page} / ${totalPages}</span>
          <button class="btn sec sm" id="btn_page_next" ${store.HIST.page >= totalPages ? 'disabled' : ''}>Përpara →</button>
        </div>
      ` : ''}
    </div>`;

  // Attach filter listeners
  document.getElementById('hf_apply')?.addEventListener('click', async () => {
    const uSel = document.getElementById('hf_unit') as HTMLSelectElement | null;
    const fInp = document.getElementById('hf_from') as HTMLInputElement | null;
    const tInp = document.getElementById('hf_to') as HTMLInputElement | null;
    store.HIST.unit = uSel?.value || '';
    store.HIST.from = fInp?.value || '';
    store.HIST.to = tInp?.value || '';
    store.HIST.page = 1;
    await loadHistoryData();
    renderHistory();
  });

  document.getElementById('hf_reset')?.addEventListener('click', async () => {
    store.HIST.unit = '';
    store.HIST.from = '';
    store.HIST.to = '';
    store.HIST.page = 1;
    await loadHistoryData();
    renderHistory();
  });

  document.getElementById('hf_csv')?.addEventListener('click', histCsv);

  document.getElementById('btn_page_prev')?.addEventListener('click', async () => {
    if (store.HIST.page > 1) {
      store.HIST.page--;
      await loadHistoryData();
      renderHistory();
    }
  });

  document.getElementById('btn_page_next')?.addEventListener('click', async () => {
    if (store.HIST.page < totalPages) {
      store.HIST.page++;
      await loadHistoryData();
      renderHistory();
    }
  });

  // Edit / Delete handlers
  view.querySelectorAll<HTMLElement>('[data-edit-chk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editChk;
      const row = store.HIST.rows.find(r => r.id === id);
      if (row) openEditCheckinModal(row);
    });
  });

  view.querySelectorAll<HTMLElement>('[data-del-chk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delChk;
      if (id) delCheckin(id);
    });
  });
}

export function openEditCheckinModal(r: HistoryRowItem): void {
  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Ndrysho turnin e regjistruar</h3>
    <p class="sub">Vullnetari: <b>${esc(r.volunteer_name)}</b></p>
    <label>Zona / Njësia</label>
    <select id="ed_unit">
      <option value="">(Pa njësi)</option>
      ${store.HIST.units.map(u => `
        <option value="${u.id}" ${u.id === r.unit_id ? 'selected' : ''}>
          ${esc(u.code)} · ${esc(u.name)}
        </option>
      `).join('')}
    </select>
    <label>Nënshkrime të mbledhura *</label>
    <input id="ed_sig" type="number" min="0" value="${r.signatures || 0}">
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Ora e fillimit</label>
        <input id="ed_start" type="datetime-local" value="${toLocalInput(r.started_at)}">
      </div>
      <div style="flex:1">
        <label>Ora e mbarimit</label>
        <input id="ed_end" type="datetime-local" value="${toLocalInput(r.ended_at)}">
      </div>
    </div>
    <label>Shënime</label>
    <textarea id="ed_notes">${esc(r.notes || '')}</textarea>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="ed_save_btn">Ruaj ndryshimet</button>
      <button class="btn ghost" id="ed_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('ed_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('ed_save_btn')?.addEventListener('click', () => saveCheckin(r.id));
}

export async function saveCheckin(id: string): Promise<void> {
  const uSel = document.getElementById('ed_unit') as HTMLSelectElement | null;
  const sInp = document.getElementById('ed_sig') as HTMLInputElement | null;
  const stInp = document.getElementById('ed_start') as HTMLInputElement | null;
  const enInp = document.getElementById('ed_end') as HTMLInputElement | null;
  const nInp = document.getElementById('ed_notes') as HTMLTextAreaElement | null;
  const btn = document.getElementById('ed_save_btn') as HTMLButtonElement | null;

  const unit_id = uSel?.value || null;
  const signatures = parseInt(sInp?.value || '0', 10);
  const started_at = stInp?.value ? new Date(stInp.value).toISOString() : null;
  const ended_at = enInp?.value ? new Date(enInp.value).toISOString() : null;
  const notes = (nInp?.value || '').trim() || null;

  if (btn) btn.disabled = true;

  const { error } = await sb.rpc('checkin_edit', {
    p_id: id,
    p_signatures: signatures,
    p_started: started_at,
    p_ended: ended_at,
    p_unit: unit_id,
    p_notes: notes,
  });

  if (error) {
    if (btn) btn.disabled = false;
    return fail(error);
  }

  closeModal();
  toast('Turni u përditësua.');
  await loadHistoryData();
  renderHistory();
}

export async function delCheckin(id: string): Promise<void> {
  if (!confirm('Të fshihet ky turn i regjistruar? Nënshkrimet e tij do të zbriten nga totali.')) return;
  const { error } = await sb.from('checkins').delete().eq('id', id);
  if (error) return fail(error);
  toast('Turni u fshi.');
  await loadHistoryData();
  renderHistory();
}

export function histCsv(): void {
  const rows = store.HIST.rows;
  if (!rows.length) return fail('Nuk ka të dhëna për të shkarkuar.');

  const headers = ['ID', 'Njesia_Kodi', 'Njesia_Emri', 'Vullnetari', 'Qyteti', 'Fillimi', 'Mbarimi', 'Nenshkrime', 'Shenime'];
  const csvContent = [
    headers.join(','),
    ...rows.map(r => [
      `"${r.id}"`,
      `"${r.unit_code || ''}"`,
      `"${(r.unit_name || '').replace(/"/g, '""')}"`,
      `"${(r.volunteer_name || '').replace(/"/g, '""')}"`,
      `"${r.city || ''}"`,
      `"${r.started_at || ''}"`,
      `"${r.ended_at || ''}"`,
      r.signatures || 0,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ].join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `historiku_turneve_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
