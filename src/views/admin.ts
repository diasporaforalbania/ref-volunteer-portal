import { sb } from '../api/client';
import { ROLES } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { avatarHtml } from '../api/storage';
import { toast, fail } from '../components/toast';
import { closeModal, openModal } from '../components/modal';
import type { VolunteerRow, ChangeRequestRow, VolunteerPrivateRow, VolunteerRole, UnitRow } from '../types/database';

function contactAvatarBtn(v: VolunteerRow): string {
  const name = v.full_name || 'vullnetarit';
  return `<button type="button" class="adm-av-btn" data-vol-contact="${v.id}" aria-label="Shiko kontaktin e ${esc(name)}">${avatarHtml(v.photo_path, v.full_name, 'mini-av')}</button>`;
}

function contactValueHtml(kind: 'email' | 'tel', value: string | null | undefined): string {
  const v = (value || '').trim();
  if (!v) return '—';
  const href = kind === 'email' ? `mailto:${v}` : `tel:${v}`;
  return `<a href="${esc(href)}">${esc(v)}</a>`;
}

async function showVolunteerContact(id: string, name: string, code: string): Promise<void> {
  const { data, error } = await sb
    .from('volunteer_private')
    .select('phone,email')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    fail(error);
    return;
  }

  const priv = data as Pick<VolunteerPrivateRow, 'phone' | 'email'> | null;
  openModal(`
    <div class="modal">
      <button class="modal-x" id="modal_close_btn" type="button" aria-label="Mbyll">✕</button>
      <h3>${esc(name || 'Vullnetar')}</h3>
      <p class="sub" style="margin:0 0 14px">${esc(code || '')}</p>
      <div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)">
        <div>
          <div class="meta">Email</div>
          <b>${contactValueHtml('email', priv?.email)}</b>
        </div>
      </div>
      <div class="row" style="justify-content:space-between;padding:10px 0">
        <div>
          <div class="meta">Numri i telefonit</div>
          <b>${contactValueHtml('tel', priv?.phone)}</b>
        </div>
      </div>
    </div>`);
  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
}

function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function downloadRegisteredVolunteers(registered: VolunteerRow[], units: UnitRow[]): Promise<void> {
  if (!registered.length) {
    fail('Nuk ka vullnetarë për të shkarkuar.');
    return;
  }

  const { data, error } = await sb
    .from('volunteer_private')
    .select('id,phone,email')
    .in('id', registered.map(v => v.id));

  if (error) {
    fail(error);
    return;
  }

  const privById = new Map(
    ((data || []) as Pick<VolunteerPrivateRow, 'id' | 'phone' | 'email'>[]).map(p => [p.id, p])
  );

  const headers = ['Emri', 'Kodi', 'Roli', 'Zona', 'Email', 'Telefon'];
  const lines = [
    headers.join(','),
    ...registered.map(v => {
      const roleSel = document.getElementById(`registered_role_${v.id}`) as HTMLSelectElement | null;
      const unitSel = document.getElementById(`registered_unit_${v.id}`) as HTMLSelectElement | null;
      const role = (roleSel?.value || v.role) as VolunteerRole;
      const unitId = unitSel?.value || v.unit_id || '';
      const unit = units.find(u => u.id === unitId);
      const priv = privById.get(v.id);
      return [
        csvCell(v.full_name),
        csvCell(v.volunteer_code),
        csvCell(ROLES[role] || role),
        csvCell(unit ? `${unit.code} · ${unit.name}` : '(Pa njësi)'),
        csvCell(priv?.email),
        csvCell(priv?.phone),
      ].join(',');
    }),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vullnetaret_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('Lista u shkarkua.');
}

function currentRegisteredView(registered: VolunteerRow[], units: UnitRow[]): VolunteerRow[] {
  const role = (document.getElementById('reg_filter_role') as HTMLSelectElement | null)?.value || '';
  const unit = (document.getElementById('reg_filter_unit') as HTMLSelectElement | null)?.value || '';
  const sort = (document.getElementById('reg_sort') as HTMLSelectElement | null)?.value || 'name';

  const unitLabel = (id: string | null | undefined) => {
    if (!id) return '\uffff';
    const u = units.find(x => x.id === id);
    return u ? `${u.code} ${u.name}` : '\uffff';
  };

  return registered
    .filter(v => {
      if (role && v.role !== role) return false;
      if (unit === '__none__' && v.unit_id) return false;
      if (unit && unit !== '__none__' && v.unit_id !== unit) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'role') {
        return (ROLES[a.role] || a.role).localeCompare(ROLES[b.role] || b.role, 'sq');
      }
      if (sort === 'unit') {
        return unitLabel(a.unit_id).localeCompare(unitLabel(b.unit_id), 'sq');
      }
      return (a.full_name || '').localeCompare(b.full_name || '', 'sq');
    });
}

function applyRegisteredFilters(registered: VolunteerRow[], units: UnitRow[]): void {
  const visible = currentRegisteredView(registered, units);
  const visibleIds = new Set(visible.map(v => v.id));
  const list = document.getElementById('registered_list');
  const none = document.getElementById('registered_none');
  const count = document.getElementById('registered_count');
  if (!list) return;

  const rows = [...list.querySelectorAll<HTMLElement>('.adm-row')];
  rows.forEach(row => {
    const id = row.dataset.volId || '';
    row.classList.toggle('is-hidden', !visibleIds.has(id));
  });
  visible.forEach(v => {
    const row = rows.find(r => r.dataset.volId === v.id);
    if (row) list.appendChild(row);
  });
  if (none) list.appendChild(none);

  if (count) {
    count.textContent = visible.length === registered.length
      ? String(registered.length)
      : `${visible.length}/${registered.length}`;
  }
  if (none) none.hidden = visible.length > 0 || registered.length === 0;
}

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
            ${contactAvatarBtn(v)}
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
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h3 style="margin:0">Vullnetarët e regjistruar <span class="pill blue" id="registered_count">${registered.length}</span></h3>
        <button class="btn sec sm" id="btn_export_vols" ${registered.length ? '' : 'disabled'}>📥 Shkarko</button>
      </div>
      <div class="meta" style="margin-top:4px">Lista e vullnetarëve të miratuar dhe të pezulluar, me rolet dhe njësitë e tyre.</div>
      ${registered.length ? `
      <div class="adm-filters">
        <label class="adm-filter">
          <span>Roli</span>
          <select id="reg_filter_role" aria-label="Filtro sipas rolit">
            <option value="">Të gjitha rolet</option>
            ${roleKeys.map(r => `<option value="${r}">${esc(ROLES[r])}</option>`).join('')}
          </select>
        </label>
        <label class="adm-filter">
          <span>Njësia</span>
          <select id="reg_filter_unit" aria-label="Filtro sipas njësisë">
            <option value="">Të gjitha njësitë</option>
            <option value="__none__">(Pa njësi)</option>
            ${units.map(u => `<option value="${u.id}">${esc(u.code)} · ${esc(u.name)}</option>`).join('')}
          </select>
        </label>
        <label class="adm-filter">
          <span>Rendit</span>
          <select id="reg_sort" aria-label="Rendit listën">
            <option value="name">Emri</option>
            <option value="role">Roli</option>
            <option value="unit">Njësia</option>
          </select>
        </label>
      </div>` : ''}

      <div style="margin-top:12px" id="registered_list">
        ${registered.length ? registered.map(v => `
          <div class="adm-row" data-vol-id="${v.id}">
            ${contactAvatarBtn(v)}
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
        <div class="empty" id="registered_none" hidden>Asnjë vullnetar nuk përputhet me filtrin.</div>
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
  document.getElementById('btn_export_vols')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn_export_vols') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      await downloadRegisteredVolunteers(currentRegisteredView(registered, units), units);
    } finally {
      if (btn && registered.length) btn.disabled = false;
    }
  });

  const applyFilters = () => applyRegisteredFilters(registered, units);
  document.getElementById('reg_filter_role')?.addEventListener('change', applyFilters);
  document.getElementById('reg_filter_unit')?.addEventListener('change', applyFilters);
  document.getElementById('reg_sort')?.addEventListener('change', applyFilters);

  view.querySelectorAll<HTMLButtonElement>('[data-vol-contact]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.volContact;
      if (!id) return;
      const row = [...vols, ...registered].find(v => v.id === id);
      showVolunteerContact(id, row?.full_name || 'Vullnetar', row?.volunteer_code || '');
    });
  });

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
      const { error } = await sb.rpc('review_change_request', { p_id: id, p_approve: true, p_note: null });
      if (error) return fail(error);
      toast('Kërkesa u miratua.');
      vAdmin();
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reject-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectReq;
      if (!id || !confirm('Të refuzohet kjo kërkesë ndryshimi?')) return;
      const { error } = await sb.rpc('review_change_request', { p_id: id, p_approve: false, p_note: 'Refuzuar nga administratori.' });
      if (error) return fail(error);
      toast('Kërkesa u refuzua.');
      vAdmin();
    });
  });
}
