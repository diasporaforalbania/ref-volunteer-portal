import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { shrinkImage } from '../utils/image';
import { toast, fail } from '../components/toast';
import { openModal, closeModal } from '../components/modal';
import { badgeCardHtml, renderBadgeQr } from '../components/badge';
import type { ChangeRequestKind, ChangeRequestRow, UnitRow, VolunteerPrivateRow } from '../types/database';

export async function vBadge(): Promise<void> {
  const view = document.getElementById('view');
  if (!view || !store.ME) return;
  view.innerHTML = '<div class="empty">Po ngarkohet karta…</div>';

  const [privRes, unitsRes, reqsRes] = await Promise.all([
    sb.from('volunteer_private').select('*').eq('id', store.ME.id).maybeSingle(),
    sb.from('units').select('id,code,name,is_open').order('code'),
    sb.from('change_requests').select('*').eq('volunteer_id', store.ME.id).eq('status', 'pending'),
  ]);

  store.BADGE.priv = privRes.data as VolunteerPrivateRow | null;
  store.BADGE.units = (unitsRes.data || []) as UnitRow[];
  store.BADGE.reqs = Object.fromEntries(
    ((reqsRes.data || []) as ChangeRequestRow[]).map(r => [r.kind, r])
  );

  const verifyUrl = `${location.origin}${location.pathname}?v=${encodeURIComponent(store.ME.volunteer_code)}`;
  const pReq = store.BADGE.reqs.profile;
  const zReq = store.BADGE.reqs.zone;
  const phReq = store.BADGE.reqs.photo;

  view.innerHTML = `
    <h2 class="sec">Karta ime</h2>
    <p class="sub">Karta juaj dixhitale e identifikimit, të dhënat e profilit dhe kërkesat për ndryshim.</p>

    <div class="grid g2" style="align-items:start">
      <div style="display:flex;flex-direction:column;align-items:center">
        ${badgeCardHtml(store.ME, 'my_badge_qr')}
        <div class="row no-print" style="margin-top:14px;gap:8px">
          <button class="btn sec sm" id="btn_print_badge">🖨️ Printo kartën</button>
          <button class="btn ghost sm" id="btn_upload_badge_photo">📷 Ndrysho foton</button>
          <input id="input_badge_photo" type="file" accept="image/*" style="display:none">
        </div>
        ${phReq ? `<div class="notice warn" style="margin-top:10px">Kërkesa për foto të re është në shqyrtim nga qendra.</div>` : ''}
      </div>

      <div class="card">
        <h3>Të dhënat e mia</h3>
        <div class="meta">Ndryshimet shqyrtohen nga qendra para se të miratohen.</div>

        <div style="margin-top:14px">
          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
            <div><div class="meta">Emri i plotë</div><b>${esc(store.ME.full_name)}</b></div>
            ${pReq ? '<span class="pill amber">në shqyrtim</span>' : `<button class="btn ghost sm" id="btn_edit_profile">Ndrysho</button>`}
          </div>

          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
            <div><div class="meta">Zona / Njësia</div><b>${esc(store.ME.units?.name || 'Pa zonë të caktuar')}</b></div>
            ${zReq ? '<span class="pill amber">në shqyrtim</span>' : `<button class="btn ghost sm" id="btn_edit_zone">Ndrysho</button>`}
          </div>

          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
            <div><div class="meta">Qyteti</div><b>${esc(store.ME.city || '—')}</b></div>
          </div>

          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
            <div><div class="meta">Numri i telefonit</div><b>${esc(store.BADGE.priv?.phone || '—')}</b></div>
          </div>

          <div class="row" style="justify-content:space-between;padding:8px 0">
            <div><div class="meta">Email</div><b>${esc(store.SESSION?.user?.email || '—')}</b></div>
          </div>
        </div>
      </div>
    </div>`;

  renderBadgeQr('my_badge_qr', verifyUrl);

  document.getElementById('btn_print_badge')?.addEventListener('click', () => window.print());
  document.getElementById('btn_upload_badge_photo')?.addEventListener('click', () => {
    document.getElementById('input_badge_photo')?.click();
  });
  document.getElementById('input_badge_photo')?.addEventListener('change', uploadPhoto);
  document.getElementById('btn_edit_profile')?.addEventListener('click', () => openChangeModal('profile'));
  document.getElementById('btn_edit_zone')?.addEventListener('click', () => openChangeModal('zone'));
}

export function openChangeModal(kind: 'profile' | 'zone'): void {
  if (kind === 'profile') {
    openModal(`
    <div class="modal">
      <button class="modal-x" id="modal_close_btn">✕</button>
      <h3>Kërko ndryshimin e profilit</h3>
      <label>Emri i ri i plotë *</label>
      <input id="ch_name" value="${esc(store.ME?.full_name || '')}">
      <label>Qyteti *</label>
      <input id="ch_city" value="${esc(store.ME?.city || '')}">
      <label>Numri i telefonit</label>
      <input id="ch_phone" value="${esc(store.BADGE.priv?.phone || '')}">
      <label>Arsyeja e ndryshimit</label>
      <textarea id="ch_note" placeholder="Pse kërkohet ndryshimi…"></textarea>
      <div class="row" style="margin-top:16px">
        <button class="btn" id="ch_save_btn">Dërgo kërkesën</button>
        <button class="btn ghost" id="ch_cancel_btn">Anulo</button>
      </div>
    </div>`);
  } else {
    openModal(`
    <div class="modal">
      <button class="modal-x" id="modal_close_btn">✕</button>
      <h3>Kërko ndryshimin e zonës</h3>
      <label>Zgjidhni njësinë e re *</label>
      <select id="ch_unit">
        ${store.BADGE.units.map(u => `
          <option value="${u.id}" ${u.id === store.ME?.unit_id ? 'selected' : ''}>
            ${esc(u.code)} · ${esc(u.name)}
          </option>
        `).join('')}
      </select>
      <label>Arsyeja e ndryshimit</label>
      <textarea id="ch_note" placeholder="Pse kërkoni kalimin në këtë zonë…"></textarea>
      <div class="row" style="margin-top:16px">
        <button class="btn" id="ch_save_btn">Dërgo kërkesën</button>
        <button class="btn ghost" id="ch_cancel_btn">Anulo</button>
      </div>
    </div>`);
  }

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('ch_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('ch_save_btn')?.addEventListener('click', () => submitChangeRequest(kind));
}

export async function submitChangeRequest(kind: ChangeRequestKind): Promise<void> {
  const btn = document.getElementById('ch_save_btn') as HTMLButtonElement | null;
  const noteInput = document.getElementById('ch_note') as HTMLTextAreaElement | null;
  const note = (noteInput?.value || '').trim() || null;

  let payload: Record<string, unknown> = {};
  if (kind === 'profile') {
    const nameInput = document.getElementById('ch_name') as HTMLInputElement | null;
    const cityInput = document.getElementById('ch_city') as HTMLInputElement | null;
    const phoneInput = document.getElementById('ch_phone') as HTMLInputElement | null;
    payload = {
      full_name: (nameInput?.value || '').trim(),
      city: (cityInput?.value || '').trim(),
      phone: (phoneInput?.value || '').trim(),
    };
  } else if (kind === 'zone') {
    const unitSelect = document.getElementById('ch_unit') as HTMLSelectElement | null;
    payload = { unit_id: unitSelect?.value };
  }

  if (btn) btn.disabled = true;

  const { error } = await sb.rpc('submit_change_request', {
    p_kind: kind,
    p_payload: payload,
    p_note: note,
  });

  if (error) {
    if (btn) btn.disabled = false;
    return fail(error);
  }

  closeModal();
  toast('Kërkesa u dërgua te qendra për shqyrtim.');
  vBadge();
}

export async function uploadPhoto(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  let file = input.files?.[0];
  if (!file || !store.ME) return;

  file = await shrinkImage(file, 800, 0.88);
  const path = `${store.ME.id}/${Date.now()}.jpg`;

  const { error: upErr } = await sb.storage.from('vol-photos').upload(path, file, { upsert: true });
  if (upErr) return fail(upErr);

  const { error: reqErr } = await sb.rpc('submit_change_request', {
    p_kind: 'photo',
    p_payload: { photo_path: path },
    p_note: 'Foto e re e ngarkuar nga përdoruesi.',
  });

  if (reqErr) return fail(reqErr);
  toast('Fotoja u ngarkua dhe iu dërgua qendrës për miratim.');
  vBadge();
}
