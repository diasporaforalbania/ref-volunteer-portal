import { sb } from '../api/client';
import { ROLES } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { avatarHtml } from '../api/storage';
import { toast, fail } from '../components/toast';
import type { VolunteerRow, ChangeRequestRow, VolunteerRole, UnitRow } from '../types/database';

export async function vAdmin(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet paneli i administratorit…</div>';

  const [pendingVols, registeredVols, pendingReqs, allUnits] = await Promise.all([
    sb.from('volunteers').select('*, units:units!volunteers_unit_id_fkey(name)').eq('status', 'pending').order('created_at'),
    sb.from('volunteers').select('*, units:units!volunteers_unit_id_fkey(name)').in('status', ['approved', 'suspended']).order('full_name'),
    sb.from('change_requests').select('*, volunteers(full_name, volunteer_code)').eq('status', 'pending').order('created_at'),
    sb.from('units').select('id,code,name').order('code'),
  ]);

  if (pendingVols.error) return fail(pendingVols.error);
  if (registeredVols.error) return fail(registeredVols.error);
  if (pendingReqs.error) return fail(pendingReqs.error);
  if (allUnits.error) return fail(allUnits.error);
  const vols = (pendingVols.data || []) as VolunteerRow[];
  const registered = (registeredVols.data || []) as VolunteerRow[];
  const reqs = (pendingReqs.data || []) as Array<ChangeRequestRow & { volunteers?: { full_name: string; volunteer_code: string } }>;
  const units = (allUnits.data || []) as UnitRow[];
  const roleKeys = Object.keys(ROLES) as VolunteerRole[];

  view.innerHTML = `
    <h2 class="sec">Administrimi</h2>
    <p class="sub">Miratimi i vullnetarëve të rinj, shqyrtimi i kërkesave për ndryshime dhe caktimi i roleve.</p>

    <div class="card" style="margin-bottom:18px">
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h3 style="margin:0">Vullnetarë në pritje të miratimit <span class="pill amber">${vols.length}</span></h3>
        <button class="btn sec sm" id="btn_refresh_admin">↻ Rifresko</button>
      </div>
      <div class="meta" style="margin-top:4px">Zgjidhni rolin dhe njësinë e vullnetarit para se ta miratoni.</div>

      <div style="margin-top:12px">
        ${vols.length ? vols.map(v => `
          <div class="adm-row">
            ${avatarHtml(v.photo_path, v.full_name, 'mini-av')}
            <div class="adm-info">
              <div class="adm-nm">${esc(v.full_name || 'I paemërtuar')}</div>
              <div class="meta">${esc(v.city || '—')} · kërkoi <b>${esc(ROLES[v.requested_role || 'ndihmes'])}</b> · regjistruar ${fmtDateTime(v.created_at)}</div>
            </div>
            <div class="adm-sel">
              <select id="adm_role_${v.id}">
                ${roleKeys.map(r => `
                  <option value="${r}" ${r === (v.requested_role || 'ndihmes') ? 'selected' : ''}>
                    ${esc(ROLES[r])}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="adm-sel">
              <select id="adm_unit_${v.id}">
                <option value="">(Pa njësi)</option>
                ${units.map(u => `
                  <option value="${u.id}" ${u.id === v.unit_id ? 'selected' : ''}>
                    ${esc(u.code)} · ${esc(u.name)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="adm-acts">
              <button class="btn green sm" data-approve-vol="${v.id}">✓ Mirato</button>
              <button class="btn red sm" data-reject-vol="${v.id}">✕ Refuzo</button>
            </div>
          </div>
        `).join('') : '<div class="empty">Nuk ka vullnetarë në pritje të miratimit.</div>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3 style="margin:0">Vullnetarët e regjistruar <span class="pill blue">${registered.length}</span></h3>
      <div class="meta" style="margin-top:4px">Lista e vullnetarëve të miratuar dhe të pezulluar, me rolet dhe njësitë e tyre.</div>

      <div style="margin-top:12px">
        ${registered.length ? registered.map(v => `
          <div class="adm-row">
            ${avatarHtml(v.photo_path, v.full_name, 'mini-av')}
            <div class="adm-info">
              <div class="adm-nm">${esc(v.full_name || 'I paemërtuar')} <span class="pill ${v.status === 'approved' ? 'ok' : 'gray'}">${v.status === 'approved' ? 'aktiv' : 'pezulluar'}</span></div>
              <div class="meta">${esc(v.volunteer_code)}</div>
            </div>
            <div class="adm-sel">
              <select id="registered_role_${v.id}" aria-label="Roli i ${esc(v.full_name)}">
                ${roleKeys.map(r => `
                  <option value="${r}" ${r === v.role ? 'selected' : ''}>${esc(ROLES[r])}</option>
                `).join('')}
              </select>
            </div>
            <div class="adm-sel">
              <select id="registered_unit_${v.id}" aria-label="Njësia e ${esc(v.full_name)}">
                <option value="">(Pa njësi)</option>
                ${units.map(u => `
                  <option value="${u.id}" ${u.id === v.unit_id ? 'selected' : ''}>
                    ${esc(u.code)} · ${esc(u.name)}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="adm-acts">
              <button class="btn sec sm" data-update-vol="${v.id}">Ruaj</button>
              ${v.status === 'approved'
                ? `<button class="btn red sm" data-suspend-vol="${v.id}">✕ Anulo</button>`
                : `<button class="btn green sm" data-reactivate-vol="${v.id}">↻ Riaktivizo</button>`}
            </div>
          </div>
        `).join('') : '<div class="empty">Nuk ka ende vullnetarë të regjistruar.</div>'}
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0">Kërkesa për ndryshime <span class="pill blue">${reqs.length}</span></h3>
      <div class="meta" style="margin-top:4px">Ndryshime profili, fotografie ose zone të kërkuara nga vullnetarët.</div>

      <div style="margin-top:12px">
        ${reqs.length ? reqs.map(r => `
          <div class="adm-row">
            <div class="adm-info">
              <div class="adm-nm">${esc(r.volunteers?.full_name || 'Vullnetar')} (${esc(r.volunteers?.volunteer_code || '')})</div>
              <div class="meta">Lloji: <b>${esc(r.kind)}</b> · ${fmtDateTime(r.created_at)}</div>
              ${r.note ? `<div class="meta" style="margin-top:3px">Arsyeja: <i>${esc(r.note)}</i></div>` : ''}
              <div class="notice" style="margin:6px 0 0;padding:6px 10px;font-size:12px">
                <code>${esc(JSON.stringify(r.payload))}</code>
              </div>
            </div>
            <div class="adm-acts">
              <button class="btn green sm" data-approve-req="${r.id}">✓ Prano</button>
              <button class="btn red sm" data-reject-req="${r.id}">✕ Refuzo</button>
            </div>
          </div>
        `).join('') : '<div class="empty">Nuk ka kërkesa për ndryshime në pritje.</div>'}
      </div>
    </div>`;

  document.getElementById('btn_refresh_admin')?.addEventListener('click', vAdmin);

  // Attach volunteer approve/reject listeners
  view.querySelectorAll<HTMLElement>('[data-approve-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.approveVol;
      if (!id) return;
      const roleSel = document.getElementById(`adm_role_${id}`) as HTMLSelectElement | null;
      const unitSel = document.getElementById(`adm_unit_${id}`) as HTMLSelectElement | null;
      const role = (roleSel?.value || 'ndihmes') as VolunteerRole;
      const unit = unitSel?.value || null;

      if (unit) {
        await sb.rpc('vol_set_unit', { p_id: id, p_unit: unit });
      }
      const { error } = await sb.rpc('vol_decide_pending', { p_id: id, p_approve: true, p_role: role });

      if (error) return fail(error);
      toast('Vullnetari u miratua me sukses.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reject-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectVol;
      if (!id || !confirm('Të refuzohet kjo kërkesë regjistrimi?')) return;
      const { error } = await sb.rpc('vol_decide_pending', { p_id: id, p_approve: false });
      if (error) return fail(error);
      toast('Kërkesa u refuzua.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-suspend-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.suspendVol;
      if (!id || !confirm('Të anulohet ky vullnetar? Llogaria do të pezullohet dhe mund të riaktivizohet më vonë.')) return;
      const { error } = await sb.rpc('vol_set_status', { p_id: id, p_status: 'suspended' });
      if (error) return fail(error);
      toast('Vullnetari u anulua.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLButtonElement>('[data-update-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.updateVol;
      if (!id) return;

      const roleSel = document.getElementById(`registered_role_${id}`) as HTMLSelectElement | null;
      const unitSel = document.getElementById(`registered_unit_${id}`) as HTMLSelectElement | null;
      const role = roleSel?.value as VolunteerRole | undefined;
      if (!role) return fail('Zgjidhni një rol të vlefshëm.');

      btn.disabled = true;
      const [roleRes, unitRes] = await Promise.all([
        sb.rpc('vol_set_role', { p_id: id, p_role: role }),
        sb.rpc('vol_set_unit', { p_id: id, p_unit: unitSel?.value || null }),
      ]);
      btn.disabled = false;

      if (roleRes.error) return fail(roleRes.error);
      if (unitRes.error) return fail(unitRes.error);
      toast('Roli dhe njësia u përditësuan.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reactivate-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.reactivateVol;
      if (!id) return;
      const { error } = await sb.rpc('vol_set_status', { p_id: id, p_status: 'approved' });
      if (error) return fail(error);
      toast('Vullnetari u riaktivizua.');
      vAdmin();
    });
  });

  // Attach change request approve/reject listeners
  view.querySelectorAll<HTMLElement>('[data-approve-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.approveReq;
      if (!id) return;
      const { error } = await sb.rpc('decide_change_request', { p_id: id, p_approve: true });
      if (error) return fail(error);
      toast('Kërkesa u miratua.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reject-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectReq;
      if (!id || !confirm('Të refuzohet kjo kërkesë ndryshimi?')) return;
      const { error } = await sb.rpc('decide_change_request', { p_id: id, p_approve: false });
      if (error) return fail(error);
      toast('Kërkesa u refuzua.');
      vAdmin();
    });
  });
}
