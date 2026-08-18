import { sb } from '../api/client';
import { store, KINDS, REPORT_STATUS } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { getLocation } from '../utils/geo';
import { shrinkImage } from '../utils/image';
import { toast, fail } from '../components/toast';
import { openModal, closeModal } from '../components/modal';
import type { ReportRow, ReportKind, ReportSeverity, ReportStatus } from '../types/database';

let selectedReportKind: ReportKind = 'incident';

export async function vReports(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohen raportimet…</div>';

  const { data, error } = await sb
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  const rows = (data || []) as ReportRow[];

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div>
        <h2 class="sec">Raportimet</h2>
        <p class="sub" style="margin:0">Raportoni probleme, incidente ose pyetje ligjore në terren. Qendra njoftohet menjëherë.</p>
      </div>
      <button class="btn red" id="btn_new_report">⚠️ Raporto problem</button>
    </div>

    ${rows.length ? `
      <div class="grid" style="gap:14px">
        ${rows.map(r => reportCardHtml(r)).join('')}
      </div>` : '<div class="empty">Nuk ka asnjë raportim të regjistruar.</div>'}`;

  document.getElementById('btn_new_report')?.addEventListener('click', openReportModal);

  view.querySelectorAll<HTMLElement>('[data-report-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reportId;
      const st = btn.dataset.reportStatus as ReportStatus;
      if (id && st) setReportStatus(id, st);
    });
  });

  view.querySelectorAll<HTMLElement>('[data-del-report]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delReport;
      if (id) delReport(id);
    });
  });

  view.querySelectorAll<HTMLElement>('[data-save-repnote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.saveRepnote;
      if (id) saveReportNote(id);
    });
  });
}

export function reportCardHtml(r: ReportRow): string {
  const k = KINDS[r.kind] || { ic: '⚠️', lb: r.kind, d: '' };
  const st = REPORT_STATUS[r.status] || [r.status, 'gray'];
  const canManage = store.isStaff();

  return `
  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <div class="row" style="gap:8px;align-items:center">
          <span class="pill ${st[1]}">${st[0]}</span>
          <h3 style="margin:0">${k.ic} ${esc(r.title)}</h3>
        </div>
        <div class="meta" style="margin-top:4px">
          Nga <b>${esc(r.reporter_name || 'Vullnetar')}</b> · ${fmtDateTime(r.created_at)}
          ${r.location_text ? ` · 📍 ${esc(r.location_text)}` : ''}
          ${r.lat ? ` · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.lat},${r.lng}">harta</a>` : ''}
        </div>
      </div>
      <span class="pill ${r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'amber' : 'gray'}">
        ${r.severity === 'high' ? 'Urgjente' : r.severity === 'medium' ? 'Mesatare' : 'E ulët'}
      </span>
    </div>

    <div style="margin-top:12px;white-space:pre-wrap;line-height:1.6">${esc(r.body)}</div>

    ${canManage ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <label style="margin-top:0">Shënimi i qendrës / trajtimi:</label>
        <div class="row" style="gap:8px">
          <input id="rep_note_${r.id}" style="flex:1" placeholder="Shënim për zgjidhjen…" value="${esc(r.handled_note || '')}">
          <button class="btn sec sm" data-save-repnote="${r.id}">Ruaj</button>
        </div>
        <div class="row rep-actions" style="margin-top:10px">
          ${r.status === 'open'
            ? `<button class="rep-act" data-report-id="${r.id}" data-report-status="review">🔎 Merr në shqyrtim</button>`
            : ''}
          ${r.status !== 'resolved'
            ? `<button class="rep-act done" data-report-id="${r.id}" data-report-status="resolved">✓ Shënoje të zgjidhur</button>`
            : `<button class="rep-act reopen" data-report-id="${r.id}" data-report-status="open">↺ Rihap</button>`}
          ${store.isAdmin() ? `<button class="rep-del" data-del-report="${r.id}">Fshi raportimin</button>` : ''}
        </div>
      </div>` : (r.handled_note ? `
      <div class="notice" style="margin-top:12px;margin-bottom:0">
        <b>Përgjigjja nga qendra (${esc(r.handled_name || 'Stafi')}):</b><br>${esc(r.handled_note)}
      </div>` : '')}
  </div>`;
}

export function openReportModal(): void {
  selectedReportKind = 'incident';
  const kindKeys = Object.keys(KINDS) as ReportKind[];

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Raporto një problem nga terreni</h3>
    <label>Lloji i raportimit *</label>
    <div class="kinds">
      ${kindKeys.map(k => `
        <div class="kind ${k === selectedReportKind ? 'on' : ''}" data-kind="${k}">
          <div class="ic">${KINDS[k].ic}</div>
          <div class="lb">${KINDS[k].lb}</div>
        </div>
      `).join('')}
    </div>
    <label style="margin-top:12px">Titulli i shkurtër *</label>
    <input id="rp_title" placeholder="p.sh. Policia kërkon autorizimin shtesë">
    <label>Përshkrimi i detajuar *</label>
    <textarea id="rp_body" placeholder="Çfarë ndodhi, kush ishte i përfshirë, si duhet ndërhyrë…"></textarea>
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Rëndësia</label>
        <select id="rp_sev">
          <option value="high">E lartë / Urgjente 🚨</option>
          <option value="medium" selected>Mesatare</option>
          <option value="low">E ulët / Informuese</option>
        </select>
      </div>
      <div style="flex:1">
        <label>Vendndodhja (pika)</label>
        <input id="rp_loc" placeholder="p.sh. Sheshi Skënderbej">
      </div>
    </div>
    <label>Bashkëngjit foto (opsionale)</label>
    <input id="rp_photo" type="file" accept="image/*">
    <div class="row" style="margin-top:16px">
      <button class="btn red" id="rp_save_btn">Dërgo raportimin</button>
      <button class="btn ghost" id="rp_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('rp_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('rp_save_btn')?.addEventListener('click', submitReport);

  document.querySelectorAll<HTMLElement>('.kind').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.kind').forEach(k => k.classList.remove('on'));
      el.classList.add('on');
      selectedReportKind = (el.dataset.kind || 'incident') as ReportKind;
    });
  });
}

export async function submitReport(): Promise<void> {
  const titleInput = document.getElementById('rp_title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('rp_body') as HTMLTextAreaElement | null;
  const sevSelect = document.getElementById('rp_sev') as HTMLSelectElement | null;
  const locInput = document.getElementById('rp_loc') as HTMLInputElement | null;
  const photoInput = document.getElementById('rp_photo') as HTMLInputElement | null;
  const btn = document.getElementById('rp_save_btn') as HTMLButtonElement | null;

  const title = (titleInput?.value || '').trim();
  const body = (bodyInput?.value || '').trim();
  const severity = (sevSelect?.value || 'medium') as ReportSeverity;
  const location_text = (locInput?.value || '').trim() || null;
  let photoFile = photoInput?.files?.[0];

  if (!title || !body) return fail('Plotësoni titullin dhe përshkrimin.');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Po dërgohet…';
  }

  const pos = await getLocation();
  let photo_path: string | null = null;

  if (photoFile) {
    photoFile = await shrinkImage(photoFile, 1400, 0.85);
    photo_path = `${store.ME?.id}/${Date.now()}_report.jpg`;
    await sb.storage.from('vol-reports').upload(photo_path, photoFile);
  }

  const { error } = await sb.from('reports').insert({
    reporter_id: store.ME?.id,
    reporter_name: store.ME?.full_name || store.ME?.volunteer_code,
    kind: selectedReportKind,
    severity,
    title,
    body,
    location_text,
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
    photo_path,
    status: 'open',
  });

  if (error) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dërgo raportimin';
    }
    return fail(error);
  }

  closeModal();
  toast('Raportimi u dërgua te qendra.');
  vReports();
}

export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  const { error } = await sb.from('reports').update({
    status,
    handled_by: store.ME?.id,
    handled_name: store.ME?.full_name || store.ME?.volunteer_code,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return fail(error);
  toast('Statusi i raportimit u përditësua.');
  vReports();
}

export async function saveReportNote(id: string): Promise<void> {
  const noteInput = document.getElementById(`rep_note_${id}`) as HTMLInputElement | null;
  const handled_note = (noteInput?.value || '').trim() || null;

  const { error } = await sb.from('reports').update({
    handled_note,
    handled_by: store.ME?.id,
    handled_name: store.ME?.full_name || store.ME?.volunteer_code,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return fail(error);
  toast('Shënimi u ruajt.');
}

export async function delReport(id: string): Promise<void> {
  if (!confirm('Të fshihet ky raportim?')) return;
  const { error } = await sb.from('reports').delete().eq('id', id);
  if (error) return fail(error);
  toast('Raportimi u fshi.');
  vReports();
}
