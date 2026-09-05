import { sb } from '../api/client';
import { store } from '../state/store';
import { esc, truncate } from '../utils/security';
import { nf } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openModal, closeModal, confirmAction } from '../components/modal';
import { renderUnitBoard } from '../components/unitBoard';
import type { UnitTotalItem, VolunteerRow } from '../types/database';

export async function vPanel(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet paneli…</div>';

  const [totalsRes, teamRes] = await Promise.all([
    sb.rpc('unit_totals'),
    sb.rpc('struktura_tree'),
  ]);

  if (totalsRes.error) return fail(totalsRes.error);
  const units = (totalsRes.data || []) as UnitTotalItem[];
  const team = (teamRes.data || []) as VolunteerRow[];

  const isAdm = store.isAdmin();

  view.innerHTML = `
    <h2 class="sec">Paneli i Menaxhimit</h2>
    <p class="sub">Njësitë organizative, objektivat e mbledhjes dhe struktura e ekipit.</p>

    <div class="card" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3 style="margin:0">Struktura e njësive</h3>
        ${isAdm ? '<button class="btn green sm" id="btn_add_unit">+ Shto njësi</button>' : ''}
      </div>
      <div class="meta">
        Koordinatorët rrinë mbi njësinë, mbledhësit e autorizuar nën të, ndihmësit nën një mbledhës.
      </div>
      <div style="margin-top:14px" id="board_box"></div>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div>
          <h3 style="margin:0">Njësitë organizative</h3>
          <div class="meta">Zonat e mbledhjes së nënshkrimeve, objektivat dhe progresi.</div>
        </div>
        <button class="btn sec sm" id="btn_export_units_csv">📥 Eksporto Zonat (CSV)</button>
      </div>
      <div class="scroll-x" style="margin-top:10px">
        <table class="tbl">
          <thead>
            <tr>
              <th>Kodi</th>
              <th>Emri</th>
              <th>Koordinatorët</th>
              <th>Statusi</th>
              <th style="text-align:right">Firma</th>
              <th style="text-align:right">Objektivi</th>
              <th style="text-align:right">Progresi</th>
              ${isAdm ? '<th style="text-align:right">Veprime</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${units.map(u => {
              const pc = u.target > 0 ? Math.min(100, Math.round((u.signatures / u.target) * 100)) : 0;
              const coords = u.coordinators || [];
              return `
                <tr>
                  <td><span class="unit-tag" style="font-size:12px;padding:2px 8px;font-weight:700">${esc(u.code)}</span></td>
                  <td style="font-weight:600;color:var(--ink)">${esc(u.name)}</td>
                  <td>
                    ${coords.length
                      ? coords.map(c => `<span class="chip" style="font-size:11px">${esc(truncate(c.name || c.code || '—', 22))}</span>`).join(' ')
                      : '<span class="meta">—</span>'}
                  </td>
                  <td>
                    ${isAdm ? `
                      <button class="btn sm ${u.is_open ? 'sec' : 'green'}" data-toggle-open="${u.id}" data-is-open="${u.is_open}" style="font-size:11.5px;padding:3px 8px">
                        ${u.is_open ? 'Mbyll' : 'Hap'}
                      </button>
                    ` : (u.is_open ? '<span class="pill ok">hapur</span>' : '<span class="pill gray">mbyllur</span>')}
                  </td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono)"><b>${nf(u.signatures)}</b></td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono)">${nf(u.target)}</td>
                  <td style="text-align:right">
                    <div style="display:inline-flex;align-items:center;gap:6px">
                      <div class="bar" style="width:54px;height:9px;margin:0;border-radius:5px"><span style="width:${pc}%"></span></div>
                      <span class="meta" style="font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12px">${pc}%</span>
                    </div>
                  </td>
                  ${isAdm ? `
                    <td style="text-align:right">
                      <div class="row" style="justify-content:flex-end;gap:4px">
                        <button class="btn ghost sm" data-edit-unit="${u.id}" title="Ndrysho njësinë">✎ Ndrysho</button>
                        <button class="btn red sm" data-delete-unit="${u.id}" data-unit-name="${esc(u.name)}" style="font-size:11.5px;padding:3px 7px">Fshi</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  renderUnitBoard('board_box', units, team);

  document.getElementById('btn_add_unit')?.addEventListener('click', () => {
    openModal(`
    <div class="modal">
      <button class="modal-x" id="modal_close_btn">✕</button>
      <h3>Shto njësi të re</h3>
      <label>Kodi i njësisë *</label>
      <input id="nu_code" placeholder="p.sh. A1" style="text-transform:uppercase">
      <label>Emri i njësisë *</label>
      <input id="nu_name" placeholder="p.sh. Qendër - Tiranë">
      <div class="row" style="margin-top:8px">
        <div style="flex:1">
          <label>Rajoni (opsionale)</label>
          <input id="nu_region" placeholder="p.sh. Qarku Tiranë">
        </div>
        <div style="flex:1">
          <label>Territori (opsionale)</label>
          <input id="nu_territory" placeholder="p.sh. Bashkia Tiranë">
        </div>
      </div>
      <label>Objektivi i nënshkrimeve</label>
      <input id="nu_target" type="number" min="0" value="1000">
      <div class="row" style="margin-top:16px">
        <button class="btn green" id="nu_save_btn">Krijo njësinë</button>
        <button class="btn ghost" id="nu_cancel_btn">Anulo</button>
      </div>
    </div>`);

    document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
    document.getElementById('nu_cancel_btn')?.addEventListener('click', closeModal);
    document.getElementById('nu_save_btn')?.addEventListener('click', async () => {
      const codeInput = document.getElementById('nu_code') as HTMLInputElement | null;
      const nameInput = document.getElementById('nu_name') as HTMLInputElement | null;
      const regInput = document.getElementById('nu_region') as HTMLInputElement | null;
      const terInput = document.getElementById('nu_territory') as HTMLInputElement | null;
      const tarInput = document.getElementById('nu_target') as HTMLInputElement | null;
      const saveBtn = document.getElementById('nu_save_btn') as HTMLButtonElement | null;

      const code = (codeInput?.value || '').trim().toUpperCase();
      const name = (nameInput?.value || '').trim();
      const region = (regInput?.value || '').trim() || null;
      const territory = (terInput?.value || '').trim() || null;
      const target = parseInt(tarInput?.value || '0', 10);

      if (!code) return fail('Kodi i njësisë është i detyrueshëm.');
      if (!name) return fail('Emri i njësisë është i detyrueshëm.');
      if (isNaN(target) || target < 0) return fail('Objektivi duhet të jetë numër zero ose pozitiv.');

      if (saveBtn) saveBtn.disabled = true;
      const { error } = await sb.rpc('unit_create', {
        p_code: code,
        p_name: name,
        p_region: region,
        p_territory: territory,
        p_target: target,
      });
      if (saveBtn) saveBtn.disabled = false;

      if (error) return fail(error);
      closeModal();
      toast('Njësia u shtua.');
      vPanel();
    });
  });

  // Attach toggle open/close handlers
  view.querySelectorAll<HTMLElement>('[data-toggle-open]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unitId = btn.dataset.toggleOpen;
      const isOpen = btn.dataset.isOpen === 'true';
      if (unitId) {
        const { error } = await sb.rpc('unit_set_open', {
          p_unit: unitId,
          p_open: !isOpen,
        });
        if (error) return fail(error);
        toast(`Njësia u ${!isOpen ? 'hap' : 'mbyll'}.`);
        vPanel();
      }
    });
  });

  // Admini ndryshon të gjitha fushat përshkruese të njësisë në një vend.
  view.querySelectorAll<HTMLElement>('[data-edit-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = units.find(u => u.id === btn.dataset.editUnit);
      if (!unit) return;

      openModal(`
      <div class="modal">
        <button class="modal-x" id="modal_close_btn">✕</button>
        <h3>Ndrysho njësinë organizative</h3>
        <label>Kodi i njësisë *</label>
        <input id="eu_code" maxlength="12" value="${esc(unit.code)}" style="text-transform:uppercase">
        <label>Emri i njësisë *</label>
        <input id="eu_name" maxlength="120" value="${esc(unit.name)}">
        <div class="row" style="margin-top:8px">
          <div style="flex:1">
            <label>Rajoni</label>
            <input id="eu_region" maxlength="80" value="${esc(unit.region || '')}">
          </div>
          <div style="flex:1">
            <label>Territori</label>
            <input id="eu_territory" maxlength="160" value="${esc(unit.territory || '')}">
          </div>
        </div>
        <label>Objektivi i nënshkrimeve *</label>
        <input id="eu_target" type="number" min="0" value="${unit.target}">
        <div class="meta" style="margin-top:7px">Statusi hapur/mbyllur dhe koordinatorët menaxhohen me kontrollet e tyre të veçanta.</div>
        <div class="row" style="margin-top:16px">
          <button class="btn" id="eu_save_btn">Ruaj ndryshimet</button>
          <button class="btn ghost" id="eu_cancel_btn">Anulo</button>
        </div>
      </div>`);

      document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
      document.getElementById('eu_cancel_btn')?.addEventListener('click', closeModal);
      document.getElementById('eu_save_btn')?.addEventListener('click', async () => {
        const code = ((document.getElementById('eu_code') as HTMLInputElement | null)?.value || '').trim().toUpperCase();
        const name = ((document.getElementById('eu_name') as HTMLInputElement | null)?.value || '').trim();
        const region = ((document.getElementById('eu_region') as HTMLInputElement | null)?.value || '').trim() || null;
        const territory = ((document.getElementById('eu_territory') as HTMLInputElement | null)?.value || '').trim() || null;
        const target = parseInt((document.getElementById('eu_target') as HTMLInputElement | null)?.value || '0', 10);
        const saveBtn = document.getElementById('eu_save_btn') as HTMLButtonElement | null;

        if (!code) return fail('Kodi i njësisë është i detyrueshëm.');
        if (!name) return fail('Emri i njësisë është i detyrueshëm.');
        if (isNaN(target) || target < 0) return fail('Objektivi duhet të jetë numër zero ose pozitiv.');

        if (saveBtn) saveBtn.disabled = true;
        const { error } = await sb.rpc('unit_update', {
          p_unit: unit.id,
          p_code: code,
          p_name: name,
          p_region: region,
          p_territory: territory,
          p_target: target,
        });
        if (saveBtn) saveBtn.disabled = false;

        if (error) return fail(error);
        closeModal();
        toast('Njësia u përditësua.');
        vPanel();
      });
    });
  });

  view.querySelectorAll<HTMLElement>('[data-delete-unit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unitId = btn.dataset.deleteUnit;
      const unitName = btn.dataset.unitName || 'kjo njësi';
      if (!unitId) return;

      const ok = await confirmAction({
        title: 'Fshi njësinë',
        message: `Të fshihet “${unitName}”? Vullnetarët e saj do të mbeten pa njësi dhe turnet e lidhura do të fshihen.`,
        confirmText: 'Fshi njësinë',
        confirmClass: 'btn-danger',
        icon: '🗑️'
      });
      if (!ok) return;

      const { error } = await sb.rpc('unit_delete', { p_unit: unitId });
      if (error) return fail(error);
      toast('Njësia u fshi.');
      vPanel();
    });
  });

  document.getElementById('btn_export_units_csv')?.addEventListener('click', () => exportUnitsCsv(units));
}

export function exportUnitsCsv(units: UnitTotalItem[]): void {
  if (!units.length) return fail('Nuk ka njësi për të eksportuar.');

  const headers = ['Kodi', 'Emri', 'Rajoni', 'Territori', 'Statusi', 'Firma_Mbledhur', 'Objektivi', 'Progresi_Perqindje', 'Koordinatoret'];
  const csvContent = [
    headers.join(','),
    ...units.map(u => {
      const pc = u.target > 0 ? Math.min(100, Math.round((u.signatures / u.target) * 100)) : 0;
      const coords = (u.coordinators || []).map(c => c.name).join('; ');
      return [
        `"${u.code}"`,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.region || '').replace(/"/g, '""')}"`,
        `"${(u.territory || '').replace(/"/g, '""')}"`,
        `"${u.is_open ? 'Hapur' : 'Mbyllur'}"`,
        u.signatures || 0,
        u.target || 0,
        `"${pc}%"`,
        `"${coords.replace(/"/g, '""')}"`,
      ].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `zonat_referendumi_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
