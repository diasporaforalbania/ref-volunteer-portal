import { sb } from '../api/client';
import { ROLES } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { avatarHtml, photoUrl } from '../api/storage';
import { toast, fail } from '../components/toast';
import { closeModal, openModal } from '../components/modal';
import type { VolunteerRow, ChangeRequestRow, VolunteerPrivateRow, VolunteerRole, UnitRow, FeedbackRow, FeedbackStatus } from '../types/database';

function contactAvatarBtn(v: VolunteerRow): string {
  const name = v.full_name || 'vullnetarit';
  return `<button type="button" class="adm-av-btn" data-vol-contact="${v.id}" aria-label="Shiko kontaktin e ${esc(name)}">${avatarHtml(v.photo_path, v.full_name, 'mini-av')}</button>`;
}

function renderChangeRequestPayload(r: ChangeRequestRow, units: UnitRow[]): string {
  const p = (r.payload || {}) as Record<string, unknown>;
  if (r.kind === 'photo') {
    const pPath = typeof p.photo_path === 'string' ? p.photo_path : '';
    const url = photoUrl(pPath);
    return `
      <div class="row" style="gap:12px;align-items:center;margin-top:8px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--line);border-radius:8px">
        ${url ? `<img src="${esc(url)}" alt="Foto e re e propozuar" style="width:56px;height:56px;border-radius:8px;object-fit:cover;border:1px solid var(--line);background:#fff;flex:none">` : ''}
        <div>
          <div style="font-weight:600;font-size:13.5px">📷 Foto e re e profilit</div>
          <div class="meta" style="font-size:12px;margin-top:2px">Verifikoni foton para se ta miratoni për kartën zyrtare.</div>
        </div>
      </div>`;
  }
  if (r.kind === 'zone') {
    const unit = units.find(u => u.id === p.unit_id);
    return `
      <div style="margin-top:8px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--line);border-radius:8px;font-size:13px">
        📍 <b>Kërkon kalim në zonën:</b> ${esc(unit ? `${unit.code} · ${unit.name}` : String(p.unit_id || '(Pa njësi)'))}
      </div>`;
  }
  if (r.kind === 'profile') {
    return `
      <div style="margin-top:8px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--line);border-radius:8px;font-size:13px;display:flex;flex-direction:column;gap:4px">
        ${p.full_name ? `<div>👤 Emri i ri: <b>${esc(String(p.full_name))}</b></div>` : ''}
        ${p.city ? `<div>🏙️ Qyteti i ri: <b>${esc(String(p.city))}</b></div>` : ''}
        ${p.phone ? `<div>📞 Telefoni i ri: <b>${esc(String(p.phone))}</b></div>` : ''}
      </div>`;
  }
  return `
    <div class="notice" style="margin:6px 0 0;padding:6px 10px;font-size:12px">
      <code>${esc(JSON.stringify(p))}</code>
    </div>`;
}

function renderRegisteredRowHtml(v: VolunteerRow, units: UnitRow[], roleKeys: VolunteerRole[]): string {
  return `
    <div class="adm-row" data-vol-id="${v.id}">
      ${contactAvatarBtn(v)}
      <div class="adm-info">
        <div class="adm-nm">${esc(v.full_name || 'I paemërtuar')} <span class="pill ${v.status === 'approved' ? 'ok' : 'gray'}">${v.status === 'approved' ? 'aktiv' : 'pezulluar'}</span></div>
        <div class="meta">${esc(v.volunteer_code)}${v.city ? ` · ${esc(v.city)}` : ''}</div>
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
    </div>`;
}

async function showVolunteerContact(vol: VolunteerRow, units: UnitRow[]): Promise<void> {
  const { data, error } = await sb
    .from('volunteer_private')
    .select('phone,email,emergency_contact,note')
    .eq('id', vol.id)
    .maybeSingle();

  if (error) {
    fail(error);
    return;
  }

  const priv = data as VolunteerPrivateRow | null;
  const unit = units.find(u => u.id === vol.unit_id);
  const roleTitle = ROLES[vol.role] || ROLES[vol.requested_role || 'ndihmes'] || vol.role;
  const isPending = vol.status === 'pending';
  const statusPill = isPending
    ? '<span class="pill amber">në pritje</span>'
    : vol.status === 'approved'
      ? '<span class="pill ok">aktiv</span>'
      : '<span class="pill gray">pezulluar</span>';

  const phone = (priv?.phone || '').trim();
  const email = (priv?.email || '').trim();
  const emergency = (priv?.emergency_contact || '').trim();
  const note = (priv?.note || '').trim();

  openModal(`
    <div class="modal" style="max-width:520px">
      <button class="modal-x" id="modal_close_btn" type="button" aria-label="Mbyll">✕</button>

      <div class="row" style="gap:16px;align-items:center;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--line)">
        <div style="width:62px;height:62px;border-radius:50%;overflow:hidden;border:2px solid var(--line);flex:none;background:#eef7f6;display:flex;align-items:center;justify-content:center">
          ${avatarHtml(vol.photo_path, vol.full_name, 'modal-av-img')}
        </div>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
            <h3 style="margin:0;font-size:19px;line-height:1.2">${esc(vol.full_name || 'Vullnetar')}</h3>
            ${statusPill}
          </div>
          <div class="row" style="gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
            <span class="badge-code" style="font-size:13px;margin:0">${esc(vol.volunteer_code)}</span>
            <span class="meta">·</span>
            <span class="meta" style="font-weight:600">${esc(roleTitle)}</span>
            ${vol.city ? `<span class="meta">· ${esc(vol.city)}</span>` : ''}
          </div>
          <div class="meta" style="margin-top:3px;font-size:12px">
            Zona: <b>${esc(unit ? `${unit.code} · ${unit.name}` : '(Pa njësi të caktuar)')}</b>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="card" style="padding:12px 14px;border:1px solid var(--line);border-radius:10px;box-shadow:none;margin:0">
          <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
            <div style="min-width:0;flex:1">
              <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Adresa Email</div>
              <div style="font-weight:600;font-size:14.5px;margin-top:2px;word-break:break-all">
                ${email ? `<a href="mailto:${esc(email)}" style="color:var(--teal-d);text-decoration:none">${esc(email)}</a>` : '<span class="meta">—</span>'}
              </div>
            </div>
            ${email ? `
            <div class="row" style="gap:6px;flex:none">
              <button class="btn sec sm" type="button" data-copy-val="${esc(email)}" title="Kopjo email">📋 Kopjo</button>
              <a class="btn sm" href="mailto:${esc(email)}">✉️ Shkruaj</a>
            </div>` : ''}
          </div>
        </div>

        <div class="card" style="padding:12px 14px;border:1px solid var(--line);border-radius:10px;box-shadow:none;margin:0">
          <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
            <div style="min-width:0;flex:1">
              <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Numri i Telefonit</div>
              <div style="font-weight:600;font-size:15px;margin-top:2px">
                ${phone ? `<a href="tel:${esc(phone)}" style="color:var(--teal-d);text-decoration:none">${esc(phone)}</a>` : '<span class="meta">—</span>'}
              </div>
            </div>
            ${phone ? `
            <div class="row" style="gap:6px;flex:none">
              <button class="btn sec sm" type="button" data-copy-val="${esc(phone)}" title="Kopjo numrin">📋 Kopjo</button>
              <a class="btn sm" href="tel:${esc(phone)}">📞 Telefono</a>
            </div>` : ''}
          </div>
        </div>

        ${emergency ? `
        <div class="card" style="padding:12px 14px;border:1px solid var(--line);border-radius:10px;box-shadow:none;margin:0">
          <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
            <div style="min-width:0;flex:1">
              <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Kontakt Emergjence</div>
              <div style="font-weight:600;font-size:14px;margin-top:2px">${esc(emergency)}</div>
            </div>
            <button class="btn sec sm" type="button" data-copy-val="${esc(emergency)}" title="Kopjo kontaktin e emergjencës">📋 Kopjo</button>
          </div>
        </div>` : ''}

        ${note ? `
        <div class="card" style="padding:12px 14px;border:1px solid var(--line);border-radius:10px;box-shadow:none;margin:0">
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em">Shënim i brendshëm</div>
          <div style="font-size:13.5px;margin-top:4px;color:var(--text);line-height:1.4">${esc(note)}</div>
        </div>` : ''}

        <div class="row" style="justify-content:space-between;align-items:center;padding:6px 2px 0">
          <div class="meta" style="font-size:12px">Regjistruar më: <b>${fmtDateTime(vol.created_at)}</b></div>
          <button class="btn ghost sm" id="modal_done_btn" type="button">Mbyll</button>
        </div>
      </div>
    </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('modal_done_btn')?.addEventListener('click', closeModal);

  document.querySelectorAll<HTMLButtonElement>('[data-copy-val]').forEach(copyBtn => {
    copyBtn.addEventListener('click', async () => {
      const val = copyBtn.dataset.copyVal || '';
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        toast('U kopjua në clipboard.');
      } catch {
        toast('Nuk u kopjua dot.');
      }
    });
  });
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

  const headers = ['Emri', 'Kodi', 'Qyteti', 'Roli', 'Zona', 'Email', 'Telefon'];
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
        csvCell(v.city),
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

async function downloadPendingVolunteers(pending: VolunteerRow[], units: UnitRow[]): Promise<void> {
  if (!pending.length) {
    fail('Nuk ka vullnetarë në pritje për të shkarkuar.');
    return;
  }

  const { data, error } = await sb
    .from('volunteer_private')
    .select('id,phone,email')
    .in('id', pending.map(v => v.id));

  if (error) {
    fail(error);
    return;
  }

  const privById = new Map(
    ((data || []) as Pick<VolunteerPrivateRow, 'id' | 'phone' | 'email'>[]).map(p => [p.id, p])
  );

  const headers = ['Emri', 'Kodi', 'Qyteti', 'Roli_i_Kerkuar', 'Zona_e_Zgjedhur', 'Email', 'Telefon', 'Data_Regjistrimit'];
  const lines = [
    headers.join(','),
    ...pending.map(v => {
      const roleSel = document.getElementById(`adm_role_${v.id}`) as HTMLSelectElement | null;
      const unitSel = document.getElementById(`adm_unit_${v.id}`) as HTMLSelectElement | null;
      const role = (roleSel?.value || v.requested_role || 'ndihmes') as VolunteerRole;
      const unitId = unitSel?.value || v.unit_id || '';
      const unit = units.find(u => u.id === unitId);
      const priv = privById.get(v.id);
      return [
        csvCell(v.full_name),
        csvCell(v.volunteer_code),
        csvCell(v.city),
        csvCell(ROLES[role] || role),
        csvCell(unit ? `${unit.code} · ${unit.name}` : '(Pa njësi)'),
        csvCell(priv?.email),
        csvCell(priv?.phone),
        csvCell(v.created_at),
      ].join(',');
    }),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vullnetaret_ne_pritje_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('Lista e vullnetarëve në pritje u shkarkua.');
}

function currentPendingView(pending: VolunteerRow[], units: UnitRow[]): VolunteerRow[] {
  const q = ((document.getElementById('pending_search') as HTMLInputElement | null)?.value || '').trim().toLowerCase();
  const role = (document.getElementById('pending_filter_role') as HTMLSelectElement | null)?.value || '';
  const unit = (document.getElementById('pending_filter_unit') as HTMLSelectElement | null)?.value || '';
  const sort = (document.getElementById('pending_sort') as HTMLSelectElement | null)?.value || 'date';

  const unitLabel = (id: string | null | undefined) => {
    if (!id) return '\uffff';
    const u = units.find(x => x.id === id);
    return u ? `${u.code} ${u.name}` : '\uffff';
  };

  return pending
    .filter(v => {
      if (q) {
        const matchName = (v.full_name || '').toLowerCase().includes(q);
        const matchCode = (v.volunteer_code || '').toLowerCase().includes(q);
        const matchCity = (v.city || '').toLowerCase().includes(q);
        const unitName = v.unit_id ? (units.find(u => u.id === v.unit_id)?.name || '') : '';
        const matchUnit = unitName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCity && !matchUnit) return false;
      }
      const reqRole = v.requested_role || 'ndihmes';
      if (role && reqRole !== role) return false;
      if (unit === '__none__' && v.unit_id) return false;
      if (unit && unit !== '__none__' && v.unit_id !== unit) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'date') {
        return (a.created_at || '').localeCompare(b.created_at || '');
      }
      if (sort === 'date_desc') {
        return (b.created_at || '').localeCompare(a.created_at || '');
      }
      if (sort === 'role') {
        const rA = ROLES[a.requested_role || 'ndihmes'] || '';
        const rB = ROLES[b.requested_role || 'ndihmes'] || '';
        return rA.localeCompare(rB, 'sq');
      }
      if (sort === 'unit') {
        return unitLabel(a.unit_id).localeCompare(unitLabel(b.unit_id), 'sq');
      }
      return (a.full_name || '').localeCompare(b.full_name || '', 'sq');
    });
}

function applyPendingFilters(pending: VolunteerRow[], units: UnitRow[]): void {
  const visible = currentPendingView(pending, units);
  const visibleIds = new Set(visible.map(v => v.id));
  const list = document.getElementById('pending_list');
  const none = document.getElementById('pending_none');
  const count = document.getElementById('pending_count');
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
    count.textContent = visible.length === pending.length
      ? String(pending.length)
      : `${visible.length}/${pending.length}`;
  }
  if (none) none.hidden = visible.length > 0 || pending.length === 0;
}

let regPage = 1;
const REG_PAGE_SIZE = 25;

function currentRegisteredView(registered: VolunteerRow[], units: UnitRow[]): VolunteerRow[] {
  const q = ((document.getElementById('reg_search') as HTMLInputElement | null)?.value || '').trim().toLowerCase();
  const role = (document.getElementById('reg_filter_role') as HTMLSelectElement | null)?.value || '';
  const unit = (document.getElementById('reg_filter_unit') as HTMLSelectElement | null)?.value || '';
  const status = (document.getElementById('reg_filter_status') as HTMLSelectElement | null)?.value || '';
  const sort = (document.getElementById('reg_sort') as HTMLSelectElement | null)?.value || 'name';

  const unitLabel = (id: string | null | undefined) => {
    if (!id) return '\uffff';
    const u = units.find(x => x.id === id);
    return u ? `${u.code} ${u.name}` : '\uffff';
  };

  return registered
    .filter(v => {
      if (q) {
        const matchName = (v.full_name || '').toLowerCase().includes(q);
        const matchCode = (v.volunteer_code || '').toLowerCase().includes(q);
        const matchCity = (v.city || '').toLowerCase().includes(q);
        const unitName = v.unit_id ? (units.find(u => u.id === v.unit_id)?.name || '') : '';
        const matchUnit = unitName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCity && !matchUnit) return false;
      }
      if (role && v.role !== role) return false;
      if (unit === '__none__' && v.unit_id) return false;
      if (unit && unit !== '__none__' && v.unit_id !== unit) return false;
      if (status && v.status !== status) return false;
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
  const totalPages = Math.max(1, Math.ceil(visible.length / REG_PAGE_SIZE));
  if (regPage > totalPages) regPage = totalPages;
  if (regPage < 1) regPage = 1;

  const startIdx = (regPage - 1) * REG_PAGE_SIZE;
  const endIdx = startIdx + REG_PAGE_SIZE;
  const pageVisible = visible.slice(startIdx, endIdx);
  const pageVisibleIds = new Set(pageVisible.map(v => v.id));

  const list = document.getElementById('registered_list');
  const none = document.getElementById('registered_none');
  const count = document.getElementById('registered_count');
  const paginationBar = document.getElementById('reg_pagination');
  const pageInfo = document.getElementById('reg_page_info');
  const prevBtn = document.getElementById('reg_prev_page') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('reg_next_page') as HTMLButtonElement | null;
  if (!list) return;

  const rows = [...list.querySelectorAll<HTMLElement>('.adm-row')];
  rows.forEach(row => {
    const id = row.dataset.volId || '';
    row.classList.toggle('is-hidden', !pageVisibleIds.has(id));
  });
  pageVisible.forEach(v => {
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

  if (paginationBar) {
    paginationBar.style.display = visible.length > REG_PAGE_SIZE ? 'flex' : 'none';
  }
  if (pageInfo) {
    pageInfo.textContent = `Faqja ${regPage} nga ${totalPages} (${visible.length} vullnetarë)`;
  }
  if (prevBtn) prevBtn.disabled = regPage <= 1;
  if (nextBtn) nextBtn.disabled = regPage >= totalPages;
}

function confirmAction(options: {
  title: string;
  message: string;
  confirmText?: string;
  confirmClass?: string;
  icon?: string;
}): Promise<boolean> {
  return new Promise(resolve => {
    const icon = options.icon || '⚠️';
    const confirmText = options.confirmText || 'Po, vazhdo';
    const confirmClass = options.confirmClass || 'btn red sm';

    openModal(`
      <div class="modal" style="max-width:440px">
        <div class="row" style="gap:14px;align-items:flex-start;margin-bottom:12px">
          <span style="font-size:26px;line-height:1;margin-top:2px">${icon}</span>
          <div style="flex:1;min-width:0">
            <h3 style="margin:0;font-size:18px">${esc(options.title)}</h3>
            <p style="margin:6px 0 0;font-size:13.5px;color:var(--muted);line-height:1.4">${esc(options.message)}</p>
          </div>
        </div>
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px">
          <button class="btn ghost sm" id="confirm_cancel_btn" type="button">Anulo</button>
          <button class="${confirmClass}" id="confirm_ok_btn" type="button">${esc(confirmText)}</button>
        </div>
      </div>`);

    document.getElementById('confirm_cancel_btn')?.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
    document.getElementById('confirm_ok_btn')?.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}

export async function vAdmin(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet paneli i administratorit…</div>';

  const [pendingVols, registeredVols, pendingReqs, allUnits, feedbackRes] = await Promise.all([
    sb.from('volunteers').select('*, units:units!volunteers_unit_id_fkey(name)').eq('status', 'pending').order('created_at'),
    sb.from('volunteers').select('*, units:units!volunteers_unit_id_fkey(name)').in('status', ['approved', 'suspended']).order('full_name'),
    sb.from('change_requests').select('*, volunteers(full_name, volunteer_code)').eq('status', 'pending').order('created_at'),
    sb.from('units').select('id,code,name').order('code'),
    sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  if (pendingVols.error) return fail(pendingVols.error);
  if (registeredVols.error) return fail(registeredVols.error);
  if (pendingReqs.error) return fail(pendingReqs.error);
  if (allUnits.error) return fail(allUnits.error);
  const vols = (pendingVols.data || []) as VolunteerRow[];
  const registered = (registeredVols.data || []) as VolunteerRow[];
  const reqs = (pendingReqs.data || []) as Array<ChangeRequestRow & { volunteers?: { full_name: string; volunteer_code: string } }>;
  const units = (allUnits.data || []) as UnitRow[];
  const feedbacks = (feedbackRes?.data || []) as FeedbackRow[];
  const roleKeys = Object.keys(ROLES) as VolunteerRole[];

  view.innerHTML = `
    <h2 class="sec">Administrimi</h2>
    <p class="sub">Miratimi i vullnetarëve të rinj, shqyrtimi i kërkesave për ndryshime dhe caktimi i roleve.</p>

    <div class="grid g4" style="margin-bottom:20px;gap:12px">
      <div class="card" style="padding:14px;display:flex;align-items:center;gap:14px;margin:0">
        <div style="font-size:26px;background:#eef7f6;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none">👥</div>
        <div>
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Të Regjistruar</div>
          <div style="font-size:22px;font-weight:700;line-height:1.1;margin-top:2px" id="kpi_registered_count">${registered.length}</div>
        </div>
      </div>
      <div class="card" style="padding:14px;display:flex;align-items:center;gap:14px;margin:0">
        <div style="font-size:26px;background:#fff8e6;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none">⏳</div>
        <div>
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Në Pritje</div>
          <div style="font-size:22px;font-weight:700;line-height:1.1;margin-top:2px;color:#d97706" id="kpi_pending_count">${vols.length}</div>
        </div>
      </div>
      <div class="card" style="padding:14px;display:flex;align-items:center;gap:14px;margin:0">
        <div style="font-size:26px;background:#eff6ff;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none">🔄</div>
        <div>
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Kërkesa Ndryshimi</div>
          <div style="font-size:22px;font-weight:700;line-height:1.1;margin-top:2px;color:#2563eb" id="kpi_reqs_count">${reqs.length}</div>
        </div>
      </div>
      <div class="card" style="padding:14px;display:flex;align-items:center;gap:14px;margin:0">
        <div style="font-size:26px;background:#f5f3ff;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none">💡</div>
        <div>
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Ide & Raportime</div>
          <div style="font-size:22px;font-weight:700;line-height:1.1;margin-top:2px;color:#7c3aed" id="kpi_feedbacks_count">${feedbacks.length}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Vullnetarë në pritje të miratimit <span class="pill amber" id="pending_count">${vols.length}</span></h3>
        <div class="row" style="gap:8px">
          <button class="btn sec sm" id="btn_export_pending_vols" ${vols.length ? '' : 'disabled'}>📥 Shkarko</button>
          <button class="btn sec sm" id="btn_refresh_admin">↻ Rifresko</button>
        </div>
      </div>
      <div class="meta" style="margin-top:4px">Zgjidhni rolin dhe njësinë e vullnetarit para se ta miratoni.</div>
      ${vols.length ? `
      <div class="adm-filters">
        <label class="adm-filter search-filter">
          <span>Kërko vullnetar</span>
          <input id="pending_search" type="search" placeholder="Kërko me emër, kod ose qytet…" aria-label="Kërko vullnetarë në pritje">
        </label>
        <label class="adm-filter">
          <span>Roli i kërkuar</span>
          <select id="pending_filter_role" aria-label="Filtro sipas rolit të kërkuar">
            <option value="">Të gjitha rolet</option>
            ${roleKeys.map(r => `<option value="${r}">${esc(ROLES[r])}</option>`).join('')}
          </select>
        </label>
        <label class="adm-filter">
          <span>Zona</span>
          <select id="pending_filter_unit" aria-label="Filtro sipas zonës">
            <option value="">Të gjitha njësitë</option>
            <option value="__none__">(Pa njësi)</option>
            ${units.map(u => `<option value="${u.id}">${esc(u.code)} · ${esc(u.name)}</option>`).join('')}
          </select>
        </label>
        <label class="adm-filter">
          <span>Rendit</span>
          <select id="pending_sort" aria-label="Rendit listën në pritje">
            <option value="date">Data (më të vjetrit)</option>
            <option value="date_desc">Data (më të rinjtë)</option>
            <option value="name">Emri</option>
            <option value="role">Roli</option>
          </select>
        </label>
      </div>` : ''}

      <div style="margin-top:12px" id="pending_list">
        ${vols.length ? vols.map(v => `
          <div class="adm-row" data-vol-id="${v.id}">
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
        <div class="empty" id="pending_none" hidden>Asnjë vullnetar në pritje nuk përputhet me filtrat e zgjedhur.</div>
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
        <label class="adm-filter search-filter">
          <span>Kërko vullnetar</span>
          <input id="reg_search" type="search" placeholder="Kërko me emër, kod ose qytet…" aria-label="Kërko vullnetarë të regjistruar">
        </label>
        <label class="adm-filter">
          <span>Statusi</span>
          <select id="reg_filter_status" aria-label="Filtro sipas statusit">
            <option value="">Të gjithë</option>
            <option value="approved">Aktivë</option>
            <option value="suspended">Të pezulluar</option>
          </select>
        </label>
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
        ${registered.length ? registered.map(v => renderRegisteredRowHtml(v, units, roleKeys)).join('') : '<div class="empty">Nuk ka ende vullnetarë të regjistruar.</div>'}
        <div class="empty" id="registered_none" hidden>Asnjë vullnetar nuk përputhet me filtrin.</div>
      </div>

      <div id="reg_pagination" class="row" style="display:none;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);flex-wrap:wrap;gap:8px">
        <div class="meta" id="reg_page_info" style="font-size:13px"></div>
        <div class="row" style="gap:6px">
          <button class="btn sec sm" id="reg_prev_page">← Prapa</button>
          <button class="btn sec sm" id="reg_next_page">Përpara →</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:0">Kërkesa për ndryshime <span class="pill blue" id="reqs_count">${reqs.length}</span></h3>
      <div class="meta" style="margin-top:4px">Ndryshime profili, fotografie ose zone të kërkuara nga vullnetarët.</div>

      <div style="margin-top:12px" id="reqs_list">
        ${reqs.length ? reqs.map(r => `
          <div class="adm-row" data-req-id="${r.id}">
            <div class="adm-info">
              <div class="adm-nm">${esc(r.volunteers?.full_name || 'Vullnetar')} (${esc(r.volunteers?.volunteer_code || '')})</div>
              <div class="meta">Lloji: <b>${esc(r.kind)}</b> · ${fmtDateTime(r.created_at)}</div>
              ${r.note ? `<div class="meta" style="margin-top:3px">Arsyeja: <i>${esc(r.note)}</i></div>` : ''}
              ${renderChangeRequestPayload(r, units)}
            </div>
            <div class="adm-acts">
              <button class="btn green sm" data-approve-req="${r.id}">✓ Prano</button>
              <button class="btn red sm" data-reject-req="${r.id}">✕ Refuzo</button>
            </div>
          </div>
        `).join('') : '<div class="empty">Nuk ka kërkesa për ndryshime në pritje.</div>'}
        <div class="empty" id="reqs_empty" hidden>Nuk ka kërkesa për ndryshime në pritje.</div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0">💡 Sugjerimet & Idetë e Vullnetarëve <span class="pill blue">${feedbacks.length}</span></h3>
          <div class="meta" style="margin-top:4px">Mendimet dhe raportimet e dërguara nga vullnetarët nëpërmjet butonit “Ide”.</div>
        </div>
        <button class="btn sec sm" id="btn_go_feedback_tab">Hap skedën e dedikuar të Ideve ↗</button>
      </div>

      <div style="margin-top:12px">
        ${feedbacks.length ? feedbacks.map(f => `
          <div class="adm-row" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px;border:1px solid var(--line);border-radius:8px;margin-bottom:10px">
            <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
              <div>
                <div class="row" style="gap:6px;align-items:center">
                  <span class="pill ${f.category === 'bug' ? 'red' : f.category === 'improvement' ? 'amber' : 'teal'}">
                    ${f.category === 'bug' ? '🐞 Problem' : f.category === 'improvement' ? '⚡ Përmirësim' : '💡 Veçori'}
                  </span>
                  <b>${esc(f.title)}</b>
                </div>
                <div class="meta" style="margin-top:4px">
                  nga <b>${esc(f.volunteer_name || 'Anonim')}</b>
                  ${f.volunteer_role ? ` (${esc(ROLES[f.volunteer_role as VolunteerRole] || f.volunteer_role)})` : ''}
                  ${f.unit_code ? ` · Njësia ${esc(f.unit_code)}` : ''}
                  · ${fmtDateTime(f.created_at)}
                  ${f.page_route ? ` · Faqja: <code>${esc(f.page_route)}</code>` : ''}
                </div>
              </div>
              <div class="row" style="gap:6px;align-items:center">
                <select class="sm" data-fb-status="${f.id}">
                  <option value="new" ${f.status === 'new' ? 'selected' : ''}>E re</option>
                  <option value="reviewed" ${f.status === 'reviewed' ? 'selected' : ''}>Shqyrtuar</option>
                  <option value="planned" ${f.status === 'planned' ? 'selected' : ''}>Planifikuar</option>
                  <option value="done" ${f.status === 'done' ? 'selected' : ''}>Përfunduar</option>
                </select>
              </div>
            </div>
            <div style="font-size:14px;white-space:pre-wrap;color:var(--text);background:var(--bg-card);padding:8px 10px;border-radius:6px;border:1px solid var(--line)">
              ${esc(f.description)}
            </div>
            ${f.device_info ? `<div class="meta" style="font-size:11px;opacity:0.7">${esc(f.device_info)}</div>` : ''}
          </div>
        `).join('') : '<div class="empty">Nuk ka ende sugjerime nga vullnetarët.</div>'}
      </div>
    </div>`;

  document.getElementById('btn_refresh_admin')?.addEventListener('click', vAdmin);
  document.getElementById('btn_go_feedback_tab')?.addEventListener('click', () => {
    const tabBtn = document.querySelector<HTMLElement>('.tab[data-tab="feedback"]');
    if (tabBtn) tabBtn.click();
  });
  document.getElementById('btn_export_pending_vols')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn_export_pending_vols') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    try {
      await downloadPendingVolunteers(currentPendingView(vols, units), units);
    } finally {
      if (btn && vols.length) btn.disabled = false;
    }
  });

  const applyPending = () => applyPendingFilters(vols, units);
  document.getElementById('pending_search')?.addEventListener('input', applyPending);
  document.getElementById('pending_filter_role')?.addEventListener('change', applyPending);
  document.getElementById('pending_filter_unit')?.addEventListener('change', applyPending);
  document.getElementById('pending_sort')?.addEventListener('change', applyPending);

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
  const resetAndApplyFilters = () => {
    regPage = 1;
    applyFilters();
  };

  document.getElementById('reg_search')?.addEventListener('input', resetAndApplyFilters);
  document.getElementById('reg_filter_status')?.addEventListener('change', resetAndApplyFilters);
  document.getElementById('reg_filter_role')?.addEventListener('change', resetAndApplyFilters);
  document.getElementById('reg_filter_unit')?.addEventListener('change', resetAndApplyFilters);
  document.getElementById('reg_sort')?.addEventListener('change', resetAndApplyFilters);

  document.getElementById('reg_prev_page')?.addEventListener('click', () => {
    if (regPage > 1) {
      regPage--;
      applyFilters();
    }
  });
  document.getElementById('reg_next_page')?.addEventListener('click', () => {
    regPage++;
    applyFilters();
  });

  function attachRegisteredRowListeners(row: HTMLElement): void {
    const id = row.dataset.volId;
    if (!id) return;

    const roleSel = document.getElementById(`registered_role_${id}`) as HTMLSelectElement | null;
    const unitSel = document.getElementById(`registered_unit_${id}`) as HTMLSelectElement | null;

    const checkDirty = () => {
      const vol = registered.find(v => v.id === id);
      if (!vol || !roleSel || !unitSel) return;
      const saveBtn = row.querySelector<HTMLButtonElement>('[data-update-vol]');
      if (!saveBtn) return;
      const isDirty = roleSel.value !== vol.role || (unitSel.value || null) !== (vol.unit_id || null);
      if (isDirty) {
        saveBtn.classList.remove('sec');
        saveBtn.classList.add('dirty');
        saveBtn.innerHTML = '● Ruaj';
      } else {
        saveBtn.classList.add('sec');
        saveBtn.classList.remove('dirty');
        saveBtn.innerHTML = 'Ruaj';
      }
    };

    roleSel?.addEventListener('change', checkDirty);
    unitSel?.addEventListener('change', checkDirty);

    row.querySelector<HTMLButtonElement>('[data-vol-contact]')?.addEventListener('click', () => {
      const vol = [...vols, ...registered].find(v => v.id === id);
      if (vol) showVolunteerContact(vol, units);
    });

    row.querySelector<HTMLButtonElement>('[data-update-vol]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
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
      const vol = registered.find(v => v.id === id);
      if (vol) {
        vol.role = role;
        vol.unit_id = unitSel?.value || null;
      }
      checkDirty();
      toast('Roli dhe njësia u përditësuan.');
    });

    const attachSuspend = () => {
      row.querySelector<HTMLButtonElement>('[data-suspend-vol]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const vol = registered.find(v => v.id === id);
        const name = vol?.full_name || 'këtë vullnetar';
        const ok = await confirmAction({
          title: 'Pezullo vullnetarin',
          message: `Llogaria e ${name} do të pezullohet nga aktivitetet e fushatës. Mund të riaktivizohet në çdo moment.`,
          confirmText: '✕ Pezullo llogarinë',
          confirmClass: 'btn red sm',
          icon: '⚠️',
        });
        if (!ok) return;

        btn.disabled = true;
        const { error } = await sb.rpc('vol_set_status', { p_id: id, p_status: 'suspended' });
        btn.disabled = false;
        if (error) return fail(error);
        toast('Vullnetari u anulua.');
        if (vol) vol.status = 'suspended';
        const pill = row.querySelector('.adm-nm .pill');
        if (pill) {
          pill.className = 'pill gray';
          pill.textContent = 'pezulluar';
        }
        btn.outerHTML = `<button class="btn green sm" data-reactivate-vol="${id}">↻ Riaktivizo</button>`;
        attachReactivate();
        applyFilters();
      });
    };

    const attachReactivate = () => {
      row.querySelector<HTMLButtonElement>('[data-reactivate-vol]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        const { error } = await sb.rpc('vol_set_status', { p_id: id, p_status: 'approved' });
        btn.disabled = false;
        if (error) return fail(error);
        toast('Vullnetari u riaktivizua.');
        const vol = registered.find(v => v.id === id);
        if (vol) vol.status = 'approved';
        const pill = row.querySelector('.adm-nm .pill');
        if (pill) {
          pill.className = 'pill ok';
          pill.textContent = 'aktiv';
        }
        btn.outerHTML = `<button class="btn red sm" data-suspend-vol="${id}">✕ Anulo</button>`;
        attachSuspend();
        applyFilters();
      });
    };

    attachSuspend();
    attachReactivate();
  }

  // Attach registered row listeners on initial load
  view.querySelectorAll<HTMLElement>('#registered_list .adm-row').forEach(attachRegisteredRowListeners);

  // Attach contact modal to pending volunteer rows
  view.querySelectorAll<HTMLButtonElement>('#pending_list [data-vol-contact]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.volContact;
      if (!id) return;
      const row = vols.find(v => v.id === id);
      if (row) showVolunteerContact(row, units);
    });
  });

  // Individual volunteer approve/reject listeners
  view.querySelectorAll<HTMLElement>('[data-approve-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.approveVol;
      if (!id) return;
      const roleSel = document.getElementById(`adm_role_${id}`) as HTMLSelectElement | null;
      const unitSel = document.getElementById(`adm_unit_${id}`) as HTMLSelectElement | null;
      const role = (roleSel?.value || 'ndihmes') as VolunteerRole;
      const unit = unitSel?.value || null;

      const actBtn = btn as HTMLButtonElement;
      actBtn.disabled = true;
      if (unit) {
        await sb.rpc('vol_set_unit', { p_id: id, p_unit: unit });
      }
      const { error } = await sb.rpc('vol_decide_pending', { p_id: id, p_approve: true, p_role: role });

      if (error) {
        actBtn.disabled = false;
        return fail(error);
      }
      toast('Vullnetari u miratua me sukses.');

      // Optimistic in-place move to registered
      const idx = vols.findIndex(v => v.id === id);
      if (idx >= 0) {
        const [moved] = vols.splice(idx, 1);
        moved.status = 'approved';
        moved.role = role;
        moved.unit_id = unit;
        registered.unshift(moved);
        document.querySelector(`.adm-row[data-vol-id="${id}"]`)?.remove();
        const regList = document.getElementById('registered_list');
        if (regList) {
          const temp = document.createElement('div');
          temp.innerHTML = renderRegisteredRowHtml(moved, units, roleKeys);
          const newRow = temp.firstElementChild as HTMLElement;
          if (newRow) {
            regList.prepend(newRow);
            attachRegisteredRowListeners(newRow);
          }
        }
        applyPending();
        applyFilters();

        const kpiPending = document.getElementById('kpi_pending_count');
        const kpiReg = document.getElementById('kpi_registered_count');
        if (kpiPending) kpiPending.textContent = String(Math.max(0, parseInt(kpiPending.textContent || '1', 10) - 1));
        if (kpiReg) kpiReg.textContent = String(parseInt(kpiReg.textContent || '0', 10) + 1);
      }
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reject-vol]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectVol;
      if (!id) return;
      const row = vols.find(v => v.id === id);
      const name = row?.full_name || 'këtë vullnetar';
      const ok = await confirmAction({
        title: 'Refuzo regjistrimin',
        message: `Jeni të sigurt që dëshironi të refuzoni kërkesën e regjistrimit për ${name}?`,
        confirmText: '✕ Po, refuzo',
        confirmClass: 'btn red sm',
        icon: '🚫',
      });
      if (!ok) return;

      const actBtn = btn as HTMLButtonElement;
      actBtn.disabled = true;
      const { error } = await sb.rpc('vol_decide_pending', { p_id: id, p_approve: false });
      if (error) {
        actBtn.disabled = false;
        return fail(error);
      }
      toast('Kërkesa u refuzua.');
      const idx = vols.findIndex(v => v.id === id);
      if (idx >= 0) {
        vols.splice(idx, 1);
        document.querySelector(`.adm-row[data-vol-id="${id}"]`)?.remove();
        applyPending();

        const kpiPending = document.getElementById('kpi_pending_count');
        if (kpiPending) kpiPending.textContent = String(Math.max(0, parseInt(kpiPending.textContent || '1', 10) - 1));
      }
    });
  });

  // Attach change request approve/reject listeners
  view.querySelectorAll<HTMLElement>('[data-approve-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.approveReq;
      if (!id) return;
      const actBtn = btn as HTMLButtonElement;
      actBtn.disabled = true;
      const { error } = await sb.rpc('review_change_request', { p_id: id, p_approve: true, p_note: null });
      if (error) {
        actBtn.disabled = false;
        return fail(error);
      }
      toast('Kërkesa u miratua.');
      document.querySelector(`.adm-row[data-req-id="${id}"]`)?.remove();
      const reqCount = document.getElementById('reqs_count');
      if (reqCount) {
        const cur = parseInt(reqCount.textContent || '1', 10);
        const next = Math.max(0, cur - 1);
        reqCount.textContent = String(next);
        if (next === 0) {
          const reqsEmpty = document.getElementById('reqs_empty');
          if (reqsEmpty) reqsEmpty.hidden = false;
        }
      }
      const kpiReqs = document.getElementById('kpi_reqs_count');
      if (kpiReqs) kpiReqs.textContent = String(Math.max(0, parseInt(kpiReqs.textContent || '1', 10) - 1));
    });
  });

  view.querySelectorAll<HTMLElement>('[data-reject-req]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectReq;
      if (!id) return;
      const ok = await confirmAction({
        title: 'Refuzo kërkesën e ndryshimit',
        message: 'Jeni të sigurt që dëshironi të refuzoni këtë kërkesë për ndryshim?',
        confirmText: '✕ Po, refuzo',
        confirmClass: 'btn red sm',
        icon: '🚫',
      });
      if (!ok) return;

      const actBtn = btn as HTMLButtonElement;
      actBtn.disabled = true;
      const { error } = await sb.rpc('review_change_request', { p_id: id, p_approve: false, p_note: 'Refuzuar nga administratori.' });
      if (error) {
        actBtn.disabled = false;
        return fail(error);
      }
      toast('Kërkesa u refuzua.');
      document.querySelector(`.adm-row[data-req-id="${id}"]`)?.remove();
      const reqCount = document.getElementById('reqs_count');
      if (reqCount) {
        const cur = parseInt(reqCount.textContent || '1', 10);
        const next = Math.max(0, cur - 1);
        reqCount.textContent = String(next);
        if (next === 0) {
          const reqsEmpty = document.getElementById('reqs_empty');
          if (reqsEmpty) reqsEmpty.hidden = false;
        }
      }
      const kpiReqs = document.getElementById('kpi_reqs_count');
      if (kpiReqs) kpiReqs.textContent = String(Math.max(0, parseInt(kpiReqs.textContent || '1', 10) - 1));
    });
  });

  // Attach feedback status update listeners
  view.querySelectorAll<HTMLSelectElement>('[data-fb-status]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.fbStatus;
      const status = sel.value as FeedbackStatus;
      if (!id) return;
      sel.disabled = true;
      const { error } = await sb.from('feedback').update({ status }).eq('id', id);
      sel.disabled = false;
      if (error) return fail(error);
      toast('Statusi i sugjerimit u përditësua.');
    });
  });
}
