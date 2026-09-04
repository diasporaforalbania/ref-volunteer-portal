import { sb } from '../api/client';
import { store, KINDS, REPORT_STATUS } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { getLocation } from '../utils/geo';
import { shrinkImage } from '../utils/image';
import { toast, fail } from '../components/toast';
import { openModal, closeModal, confirmAction } from '../components/modal';
import { notifyPush } from '../api/push';
import type { ReportRow, ReportKind, ReportSeverity, ReportStatus } from '../types/database';

let selectedReportKind: ReportKind = 'incident';
export type ReportFilter = 'all' | 'open' | 'urgent' | 'resolved';
let currentReportFilter: ReportFilter = 'all';

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

  function renderView() {
    if (!view) return;
    const countAll = rows.length;
    const countOpen = rows.filter(r => r.status === 'open' || r.status === 'review').length;
    const countUrgent = rows.filter(r => r.severity === 'high' && r.status !== 'resolved').length;
    const countResolved = rows.filter(r => r.status === 'resolved').length;

    const filtered = rows.filter(r => {
      if (currentReportFilter === 'open') return r.status === 'open' || r.status === 'review';
      if (currentReportFilter === 'urgent') return r.severity === 'high' && r.status !== 'resolved';
      if (currentReportFilter === 'resolved') return r.status === 'resolved';
      return true;
    });

    view.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 class="sec">Raportimet</h2>
          <p class="sub" style="margin:0">Raportoni probleme, incidente ose pyetje ligjore në terren. Qendra njoftohet menjëherë.</p>
        </div>
        <button class="btn red" id="btn_new_report">⚠️ Raporto problem</button>
      </div>

      <div class="filter-bar">
        <button class="filter-chip ${currentReportFilter === 'all' ? 'active' : ''}" data-report-filter="all">
          Të gjitha <span class="count">${countAll}</span>
        </button>
        <button class="filter-chip ${currentReportFilter === 'open' ? 'active' : ''}" data-report-filter="open">
          Të hapura <span class="count">${countOpen}</span>
        </button>
        <button class="filter-chip ${currentReportFilter === 'urgent' ? 'active' : ''}" data-report-filter="urgent">
          Urgjente 🚨 <span class="count">${countUrgent}</span>
        </button>
        <button class="filter-chip ${currentReportFilter === 'resolved' ? 'active' : ''}" data-report-filter="resolved">
          Të zgjidhura <span class="count">${countResolved}</span>
        </button>
      </div>

      ${filtered.length ? `
        <div class="grid" style="gap:14px">
          ${filtered.map(r => reportCardHtml(r)).join('')}
        </div>` : `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">🛡️</div>
          <div class="empty-state-title">Nuk ka asnjë raportim për këtë përzgjedhje</div>
          <div class="empty-state-desc">
            ${currentReportFilter === 'urgent'
              ? 'Shkëlqyeshëm! Nuk ka asnjë incident apo problem urgjent të pazgjidhur.'
              : currentReportFilter === 'open'
              ? 'Të gjitha raportimet nga terreni janë trajtuar me sukses.'
              : currentReportFilter === 'resolved'
              ? 'Ende nuk ka raportime të shënuara si të zgjidhura.'
              : 'Nuk ka asnjë raportim aktiv nga terreni në sistem.'}
          </div>
          <button class="btn red" id="btn_new_report_empty">⚠️ Raporto një problem të ri</button>
        </div>`}
    `;

    document.getElementById('btn_new_report')?.addEventListener('click', openReportModal);
    document.getElementById('btn_new_report_empty')?.addEventListener('click', openReportModal);

    view.querySelectorAll<HTMLElement>('[data-report-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentReportFilter = (btn.dataset.reportFilter || 'all') as ReportFilter;
        renderView();
      });
    });

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

  renderView();
}

export function reportCardHtml(r: ReportRow): string {
  const k = KINDS[r.kind] || { ic: '⚠️', lb: r.kind, d: '' };
  const st = REPORT_STATUS[r.status] || [r.status, 'gray'];
  const canManage = store.isStaff();

  return `
  <div class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:240px">
        <div class="row" style="gap:10px;align-items:center">
          <span class="stat-icon" style="width:36px;height:36px;font-size:18px;border-radius:10px" aria-hidden="true">${k.ic}</span>
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--ink)">${esc(r.title)}</h3>
            <div class="meta" style="margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="pill ${st[1]}" style="font-size:11px;padding:2px 7px">${st[0]}</span>
              <span>Nga <b>${esc(r.reporter_name || 'Vullnetar')}</b></span>
              <span>· ${fmtDateTime(r.created_at)}</span>
              ${r.location_text ? ` · <span>📍 ${esc(r.location_text)}</span>` : ''}
              ${r.lat ? ` · <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.lat},${r.lng}">harta ↗</a>` : ''}
            </div>
          </div>
        </div>
      </div>
      <span class="pill ${r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'amber' : 'gray'}" style="font-size:11px;font-weight:600">
        ${r.severity === 'high' ? '🚨 Urgjente' : r.severity === 'medium' ? 'Mesatare' : 'E ulët'}
      </span>
    </div>

    <div style="margin-top:12px;white-space:pre-wrap;line-height:1.6;font-size:14px;color:var(--ink)">${esc(r.body)}</div>

    ${canManage ? `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <label style="margin-top:0;font-size:12.5px;font-weight:600">Shënimi i qendrës / trajtimi:</label>
        <div class="row" style="gap:8px;margin-top:6px">
          <input id="rep_note_${r.id}" style="flex:1" placeholder="Shënim për zgjidhjen…" value="${esc(r.handled_note || '')}">
          <button class="btn sec sm" data-save-repnote="${r.id}">Ruaj</button>
        </div>
        <div class="row rep-actions" style="margin-top:10px;gap:8px">
          ${r.status === 'open'
            ? `<button class="rep-act" data-report-id="${r.id}" data-report-status="review">🔎 Merr në shqyrtim</button>`
            : ''}
          ${r.status !== 'resolved'
            ? `<button class="rep-act done" data-report-id="${r.id}" data-report-status="resolved">✓ Shënoje të zgjidhur</button>`
            : `<button class="rep-act reopen" data-report-id="${r.id}" data-report-status="open">↺ Rihap</button>`}
          ${store.isAdmin() ? `<button class="rep-del" data-del-report="${r.id}">🗑️ Fshi raportimin</button>` : ''}
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

  const { data, error } = await sb.from('reports').insert({
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
  }).select('id').single();

  if (error) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dërgo raportimin';
    }
    return fail(error);
  }

  closeModal();
  // Çdo vullnetar raporton, por vetëm qendra dhe koordinatorët njoftohen —
  // audienca caktohet nga serveri, jo nga këtu.
  const res = data?.id ? await notifyPush('report', data.id) : null;
  toast(res && res.sent > 0
    ? `Raportimi u dërgua · u njoftuan ${res.sent} pajisje (${res.audience}).`
    : 'Raportimi u dërgua te qendra.');
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
  const ok = await confirmAction({
    title: 'Fshi raportimin',
    message: 'A jeni i sigurt që dëshironi të fshini këtë raportim nga sistemi?',
    confirmText: 'Fshi raportimin',
    confirmClass: 'btn-danger',
    icon: '🗑️'
  });
  if (!ok) return;
  const { error } = await sb.from('reports').delete().eq('id', id);
  if (error) return fail(error);
  toast('Raportimi u fshi.');
  vReports();
}
