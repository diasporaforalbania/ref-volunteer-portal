import { sb } from '../api/client';
import { ROLES } from '../state/store';
import { esc } from '../utils/security';
import { photoUrl } from '../api/storage';
import type { VerifiedVolunteerResult } from '../types/database';

export async function renderVerify(code: string): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `<div class="auth-wrap"><div class="auth" style="text-align:center">
    <p class="sub">Po verifikohet…</p></div></div>`;

  const { data, error } = await sb.rpc('verify_volunteer', { p_code: code });
  const rows = data as VerifiedVolunteerResult[] | VerifiedVolunteerResult;
  const v = Array.isArray(rows) ? rows[0] : rows;

  let inner: string;
  if (error || !v) {
    inner = `<div style="font-size:44px">❌</div>
      <h1 style="margin-top:8px">Nuk u gjet</h1>
      <p class="sub">Kodi <b>${esc(code)}</b> nuk i përket asnjë vullnetari të regjistruar.
      Mos i jepni nënshkrimin dikujt që nuk verifikohet dot.</p>`;
  } else if (!v.valid) {
    inner = `<div style="font-size:44px">⚠️</div>
      <h1 style="margin-top:8px">Kartë jo aktive</h1>
      <p class="sub"><b>${esc(v.full_name || '')}</b> (${esc(v.volunteer_code || '')}) nuk është aktualisht
      vullnetar aktiv i kësaj fushate.</p>`;
  } else {
    const u = photoUrl(v.photo_path);
    const roleLabel = esc(ROLES[v.role!] || v.role || '');
    inner = `<div style="font-size:44px">✅</div>
      <h1 style="margin-top:8px">Vullnetar i verifikuar</h1>
      <p class="sub">Kjo kartë është aktive për mbledhjen e nënshkrimeve.</p>
      ${u
        ? `<img src="${esc(u)}" alt="" style="width:130px;height:160px;object-fit:cover;
             border-radius:12px;border:1px solid var(--line);margin:6px auto 12px;display:block">`
        : ''}
      <div style="font-size:20px;font-weight:800">${esc(v.full_name || '')}</div>
      <div class="badge-code">${esc(v.volunteer_code || '')}</div>
      <div class="badge-line" style="margin-top:6px">${roleLabel}${v.unit_name ? ' · ' + esc(v.unit_name) : ''}</div>
      ${v.city ? `<div class="badge-line">${esc(v.city)}</div>` : ''}`;
  }

  root.innerHTML = `<div class="auth-wrap"><div class="auth" style="text-align:center">
    ${inner}
    <div class="notice" style="margin-top:18px;text-align:left">Verifikim publik i fushatës për referendumin.
      Nëse dyshoni për keqpërdorim, njoftoni qendrën.</div>
  </div></div>`;
}
