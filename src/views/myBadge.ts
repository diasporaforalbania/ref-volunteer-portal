import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { shrinkImage } from '../utils/image';
import { toast, fail } from '../components/toast';
import { openModal, closeModal } from '../components/modal';
import { badgeCardHtml, renderBadgeQr } from '../components/badge';
import type {
  ChangeRequestKind,
  ChangeRequestRow,
  UnitRow,
  UnitTotalItem,
  VolunteerPrivateRow,
  VolunteerRow,
} from '../types/database';

export async function vBadge(): Promise<void> {
  const view = document.getElementById('view');
  if (!view || !store.ME) return;
  view.innerHTML = '<div class="empty">Po ngarkohet karta…</div>';

  const [privRes, unitsRes, reqsRes, totalsRes, teamRes] = await Promise.all([
    sb.from('volunteer_private').select('*').eq('id', store.ME.id).maybeSingle(),
    sb.from('units').select('id,code,name,is_open').order('code'),
    sb.from('change_requests').select('*').eq('volunteer_id', store.ME.id).eq('status', 'pending'),
    sb.rpc('unit_totals'),
    sb.rpc('struktura_tree'),
  ]);

  store.BADGE.priv = privRes.data as VolunteerPrivateRow | null;
  store.BADGE.units = (unitsRes.data || []) as UnitRow[];
  store.BADGE.reqs = Object.fromEntries(
    ((reqsRes.data || []) as ChangeRequestRow[]).map(r => [r.kind, r])
  );

  const totals = (totalsRes.data || []) as UnitTotalItem[];
  const team = (teamRes.data || []) as VolunteerRow[];

  const verifyUrl = `${location.origin}${location.pathname}?v=${encodeURIComponent(store.ME.volunteer_code)}`;
  const pReq = store.BADGE.reqs.profile;
  const zReq = store.BADGE.reqs.zone;
  const phReq = store.BADGE.reqs.photo;

  view.innerHTML = `
    <h2 class="sec no-print">Karta ime</h2>
    <p class="sub no-print">Karta juaj dixhitale e identifikimit, të dhënat e profilit dhe kërkesat për ndryshim.</p>

    <div class="grid g2" style="align-items:start">
      <div style="display:flex;flex-direction:column;align-items:center">
        ${badgeCardHtml(store.ME, 'my_badge_qr')}
        <div class="row no-print" style="margin-top:14px;gap:8px">
          <button class="btn sec sm" id="btn_print_badge">🖨️ Printo kartën</button>
          <button class="btn ghost sm" id="btn_upload_badge_photo">📷 Ndrysho foton</button>
          <input id="input_badge_photo" type="file" accept="image/*" style="display:none">
        </div>
        ${phReq ? `<div class="notice warn no-print" style="margin-top:10px">Kërkesa për foto të re është në shqyrtim nga qendra.</div>` : ''}
      </div>

      <div class="card no-print">
        <h3>Të dhënat e mia</h3>
        <div class="meta">Ndryshimet shqyrtohen nga qendra para se të miratohen.</div>

        <div style="margin-top:14px;display:flex;flex-direction:column">
          <div class="row" style="justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
            <div>
              <div class="meta" style="font-size:12px">Emri i plotë</div>
              <div style="font-weight:700;color:var(--ink);margin-top:2px">${esc(store.ME.full_name)}</div>
            </div>
            ${pReq ? '<span class="pill amber" style="font-size:11px">● në shqyrtim</span>' : `<button class="btn ghost sm" id="btn_edit_profile">Ndrysho</button>`}
          </div>

          <div class="row" style="justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
            <div>
              <div class="meta" style="font-size:12px">Zona / Njësia</div>
              <div style="font-weight:700;color:var(--ink);margin-top:2px">${esc(store.ME.units?.name || 'Pa zonë të caktuar')}</div>
            </div>
            ${zReq ? '<span class="pill amber" style="font-size:11px">● në shqyrtim</span>' : `<button class="btn ghost sm" id="btn_edit_zone">Ndrysho</button>`}
          </div>

          <div class="row" style="justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
            <div>
              <div class="meta" style="font-size:12px">Qyteti</div>
              <div style="font-weight:600;color:var(--ink);margin-top:2px">${esc(store.ME.city || '—')}</div>
            </div>
          </div>

          <div class="row" style="justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
            <div>
              <div class="meta" style="font-size:12px">Numri i telefonit</div>
              <div style="font-weight:600;font-family:var(--mono);color:var(--ink);margin-top:2px">${esc(store.BADGE.priv?.phone || '—')}</div>
            </div>
          </div>

          <div class="row" style="justify-content:space-between;align-items:center;padding:10px 0">
            <div>
              <div class="meta" style="font-size:12px">Email</div>
              <div style="font-weight:600;color:var(--ink);margin-top:2px">${esc(store.SESSION?.user?.email || '—')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" id="struct_card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0">Si funksionon struktura</h3>
        <button class="btn sec sm no-print" id="btn_print_struct">🖨️ Printo udhëzimet</button>
      </div>
      <div class="meta print-only" style="font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--teal-d);margin-top:6px">Referendumi — Udhëzuesi i organizimit</div>
      <div class="meta" style="margin-top:4px">
        Njësia është qendra e gjithçkaje. Njerëzit vendosen rreth saj, dhe vendi tregon
        se kush i përgjigjet kujt.
      </div>

      <div class="struct-me">${myPlaceHtml(totals, team)}</div>

      <div class="struct-rules">
        <div class="struct-rule r-coord">
          <div class="struct-hd"><span class="struct-dot"></span><b>Koordinatori</b>
            <span class="struct-where">mbi njësi</span></div>
          <p>Një koordinator mund të mbajë disa njësi njëherësh, dhe një njësi mund të
             mbahet nga disa koordinatorë. Vetëm qendra i cakton.</p>
        </div>
        <div class="struct-rule r-collect">
          <div class="struct-hd"><span class="struct-dot"></span><b>Mbledhësi i autorizuar</b>
            <span class="struct-where">nën njësi</span></div>
          <p>I përket një njësie të vetme. Eprorët e tij janë të gjithë koordinatorët e
             asaj njësie — nuk ka më një supervizor të vetëm personal.</p>
        </div>
        <div class="struct-rule r-help">
          <div class="struct-hd"><span class="struct-dot"></span><b>Ndihmësi</b>
            <span class="struct-where">nën një mbledhës</span></div>
          <p>I përgjigjet një mbledhësi të vetëm dhe ndjek njësinë e tij. Nëse mbledhësi
             del nga njësia, ndihmësi mbetet në pritje derisa ta marrë një mbledhës tjetër.</p>
        </div>
        <div class="struct-rule">
          <div class="struct-hd"><span class="struct-dot"></span><b>Njësitë e mbyllura</b>
            <span class="struct-where">pa vende të reja</span></div>
          <p>Mbeten të dukshme që historiku të lexohet, por nuk pranojnë njerëz të rinj
             derisa qendra t’i rihapë.</p>
        </div>
      </div>

      <div class="meta" style="margin-top:12px">
        Vendet ndryshohen te <b>Paneli</b>: qendra i lëviz të gjithë, koordinatori
        mbledhësit dhe ndihmësit brenda njësive që mban, mbledhësi vetëm ndihmësit e
        ekipit të vet.
      </div>
    </div>`;

  renderBadgeQr('my_badge_qr', verifyUrl);

  const printSection = (mode: 'print-badge-mode' | 'print-struct-mode'): void => {
    document.body.classList.remove('print-badge-mode', 'print-struct-mode');
    document.body.classList.add(mode);

    const cleanup = (): void => {
      document.body.classList.remove('print-badge-mode', 'print-struct-mode');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000);
  };

  document.getElementById('btn_print_badge')?.addEventListener('click', () => printSection('print-badge-mode'));
  document.getElementById('btn_print_struct')?.addEventListener('click', () => printSection('print-struct-mode'));
  document.getElementById('btn_upload_badge_photo')?.addEventListener('click', () => {
    document.getElementById('input_badge_photo')?.click();
  });
  document.getElementById('input_badge_photo')?.addEventListener('change', uploadPhoto);
  document.getElementById('btn_edit_profile')?.addEventListener('click', () => openChangeModal('profile'));
  document.getElementById('btn_edit_zone')?.addEventListener('click', () => openChangeModal('zone'));
}

/** Where this volunteer currently sits, in their own words. */
function myPlaceHtml(totals: UnitTotalItem[], team: VolunteerRow[]): string {
  const me = store.ME;
  if (!me) return '';

  const unitOf = (id: string | null): UnitTotalItem | undefined =>
    id ? totals.find(u => u.id === id) : undefined;
  const label = (u: UnitTotalItem): string => `${esc(u.code)} · ${esc(u.name)}`;

  if (me.role === 'koordinator') {
    const held = totals.filter(u => (u.coordinators || []).some(c => c.id === me.id));
    return held.length
      ? `<b>Ju mbani ${held.length === 1 ? 'një njësi' : `${held.length} njësi`}:</b>
         ${held.map(u => `<span class="chip">${label(u)}</span>`).join(' ')}`
      : '<b>Ende pa njësi.</b> Qendra ju vendos mbi një njësi te Paneli.';
  }

  if (me.role === 'mbledhes') {
    const unit = unitOf(me.unit_id);
    if (!unit) return '<b>Ende pa njësi.</b> Ju pret një vend nën një njësi të hapur.';
    const coords = unit.coordinators || [];
    const helpers = team.filter(v => v.supervisor_id === me.id).length;
    return `<b>Jeni nën njësinë ${label(unit)}.</b>
      ${coords.length
        ? `Koordinatorët e saj: ${coords.map(c => `<span class="chip">${esc(c.name || c.code || '—')}</span>`).join(' ')}`
        : 'Kjo njësi ende nuk ka koordinator.'}
      ${helpers ? `Ekipi juaj: <b>${helpers}</b> ndihmës.` : 'Ende pa ndihmës në ekip.'}`;
  }

  if (me.role === 'ndihmes') {
    const lead = team.find(v => v.id === me.supervisor_id);
    if (!lead) return '<b>Ende pa mbledhës.</b> Jeni në pritje derisa t’ju marrë një mbledhës i autorizuar.';
    const unit = unitOf(me.unit_id);
    return `<b>Jeni në ekipin e ${esc(lead.full_name || lead.volunteer_code)}</b>${
      unit ? `, te njësia ${label(unit)}.` : '.'}`;
  }

  return '<b>Ju jeni pjesë e qendrës.</b> Qendra nuk qëndron nën një njësi terreni.';
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
