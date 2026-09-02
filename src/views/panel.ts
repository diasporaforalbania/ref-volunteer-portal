import { sb } from '../api/client';
import { store } from '../state/store';
import { esc, truncate } from '../utils/security';
import { nf } from '../utils/format';
import { toast, fail } from '../components/toast';
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
                  <td><b>${esc(u.code)}</b></td>
                  <td>${esc(u.name)}</td>
                  <td>
                    ${coords.length
                      ? coords.map(c => `<span class="chip">${esc(truncate(c.name || c.code || '—', 22))}</span>`).join(' ')
                      : '<span class="meta">—</span>'}
                  </td>
                  <td>
                    ${isAdm ? `
                      <button class="btn sm ${u.is_open ? 'sec' : 'green'}" data-toggle-open="${u.id}" data-is-open="${u.is_open}">
                        ${u.is_open ? 'Mbyll' : 'Hap'}
                      </button>
                    ` : (u.is_open ? '<span class="pill ok">hapur</span>' : '<span class="pill gray">mbyllur</span>')}
                  </td>
                  <td style="text-align:right"><b>${nf(u.signatures)}</b></td>
                  <td style="text-align:right">${nf(u.target)}</td>
                  <td style="text-align:right">
                    <div style="display:inline-flex;align-items:center;gap:6px">
                      <div class="bar" style="width:50px;height:8px;margin:0"><span style="width:${pc}%"></span></div>
                      <span class="meta">${pc}%</span>
                    </div>
                  </td>
                  ${isAdm ? `
                    <td style="text-align:right">
                      <button class="btn ghost sm" data-edit-unit-target="${u.id}" data-target-val="${u.target}">🎯</button>
                      <button class="btn red sm" data-delete-unit="${u.id}" data-unit-name="${esc(u.name)}">Fshi</button>
                    </td>
                  ` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  renderUnitBoard('board_box', units, team);

  document.getElementById('btn_add_unit')?.addEventListener('click', async () => {
    const codeInput = prompt('Kodi i njësisë (p.sh. A1):');
    if (codeInput == null) return;
    const code = codeInput.trim().toUpperCase();
    if (!code) return fail('Kodi i njësisë është i detyrueshëm.');

    const nameInput = prompt('Emri i njësisë:');
    if (nameInput == null) return;
    const name = nameInput.trim();
    if (!name) return fail('Emri i njësisë është i detyrueshëm.');

    const region = prompt('Rajoni (opsionale):')?.trim() || null;
    const territory = prompt('Territori (opsionale):')?.trim() || null;
    const targetInput = prompt('Objektivi i nënshkrimeve:', '0');
    if (targetInput == null) return;
    const target = Number.parseInt(targetInput, 10);
    if (!Number.isInteger(target) || target < 0) return fail('Objektivi duhet të jetë numër zero ose pozitiv.');

    const { error } = await sb.rpc('unit_create', {
      p_code: code,
      p_name: name,
      p_region: region,
      p_territory: territory,
      p_target: target,
    });
    if (error) return fail(error);
    toast('Njësia u shtua.');
    vPanel();
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

  // Attach edit target handler
  view.querySelectorAll<HTMLElement>('[data-edit-unit-target]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unitId = btn.dataset.editUnitTarget;
      const oldVal = btn.dataset.targetVal || '0';
      const input = prompt('Vendosni objektivin e ri të nënshkrimeve për këtë njësi:', oldVal);
      if (input == null) return;
      const target = parseInt(input, 10);
      if (isNaN(target) || target < 0) return fail('Objektivi duhet të jetë numër pozitiv.');

      const { error } = await sb.from('units').update({ target }).eq('id', unitId);
      if (error) return fail(error);
      toast('Objektivi u përditësua.');
      vPanel();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-delete-unit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unitId = btn.dataset.deleteUnit;
      const unitName = btn.dataset.unitName || 'kjo njësi';
      if (!unitId || !confirm(`Të fshihet “${unitName}”? Vullnetarët e saj do të mbeten pa njësi dhe turnet e lidhura do të fshihen.`)) return;

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

