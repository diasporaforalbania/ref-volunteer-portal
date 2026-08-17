import { sb } from '../api/client';
import { store, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { nf } from '../utils/format';
import { toast, fail } from '../components/toast';
import { structuraHtml, pickOrg } from '../components/orgTree';
import type { UnitTotalItem, VolunteerRow } from '../types/database';

export async function vPanel(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet paneli…</div>';

  const [totalsRes, teamRes, coRes] = await Promise.all([
    sb.rpc('unit_totals'),
    sb.rpc('struktura_tree'),
    sb.from('volunteers').select('id,full_name,volunteer_code').eq('role', 'koordinator').eq('status', 'approved'),
  ]);

  if (totalsRes.error) return fail(totalsRes.error);
  const units = (totalsRes.data || []) as UnitTotalItem[];
  const team = (teamRes.data || []) as VolunteerRow[];
  const coords = (coRes.data || []) as VolunteerRow[];

  const isAdm = store.isAdmin();

  view.innerHTML = `
    <h2 class="sec">Paneli i Menaxhimit</h2>
    <p class="sub">Njësitë organizative, objektivat e mbledhjes dhe struktura e ekipit.</p>

    <div class="card" style="margin-bottom:16px">
      <h3>Njësitë organizative</h3>
      <div class="meta">Zonat e mbledhjes së nënshkrimeve, koordinatorët dhe progresi.</div>
      <div class="scroll-x" style="margin-top:10px">
        <table class="tbl">
          <thead>
            <tr>
              <th>Kodi</th>
              <th>Emri</th>
              <th>Koordinatori</th>
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
              return `
                <tr>
                  <td><b>${esc(u.code)}</b></td>
                  <td>${esc(u.name)}</td>
                  <td>
                    ${isAdm ? `
                      <select class="coord-select" data-unit-id="${u.id}" style="font-size:13px;height:34px;padding:4px 8px">
                        <option value="">(Pa koordinator)</option>
                        ${coords.map(c => `
                          <option value="${c.id}" ${c.id === u.coordinator_id ? 'selected' : ''}>
                            ${esc(c.full_name || c.volunteer_code)}
                          </option>
                        `).join('')}
                      </select>
                    ` : esc(u.coordinator_name || '—')}
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
                    </td>
                  ` : ''}
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Struktura e ekipit</h3>
      <div class="meta">Hierarkia organizative: Koordinatorët → Mbledhësit → Ndihmësit.</div>
      <div style="margin-top:14px" id="org_box">
        ${structuraHtml(team)}
      </div>
    </div>`;

  // Attach coordinator select change handlers
  view.querySelectorAll<HTMLSelectElement>('.coord-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const unitId = sel.dataset.unitId;
      const coordId = sel.value || null;
      if (unitId) {
        const { error } = await sb.rpc('unit_set_coordinator', {
          p_unit: unitId,
          p_coord: coordId,
        });
        if (error) return fail(error);
        toast('Koordinatori u caktua.');
      }
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

  // Attach org tree button handlers
  view.querySelectorAll<HTMLElement>('[data-org-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const orgId = btn.dataset.orgId;
      if (orgId) pickOrg(orgId);
    });
  });
}
