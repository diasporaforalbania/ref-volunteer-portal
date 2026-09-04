import { sb } from '../api/client';
import { store, CATS } from '../state/store';
import { esc, safeUrl } from '../utils/security';
import { fmtDate, fmtSize } from '../utils/format';
import { matUrl } from '../api/storage';
import { toast, fail } from '../components/toast';
import { openModal, closeModal, confirmAction } from '../components/modal';
import type { MaterialRow, MaterialCategory } from '../types/database';

export async function vMaterials(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohen materialet…</div>';

  const { data, error } = await sb
    .from('materials')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  const rows = (data || []) as MaterialRow[];
  const canUpload = store.isStaff();

  const byCat: Record<string, MaterialRow[]> = {};
  rows.forEach(m => {
    (byCat[m.category] ??= []).push(m);
  });

  const catKeys = Object.keys(CATS) as MaterialCategory[];

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px;gap:8px">
      <div>
        <h2 class="sec">Materiale & Dokumente</h2>
        <p class="sub" style="margin:0">Manuali i vullnetarit, fletë-palosjet, formularët ligjorë dhe materialet e trajnimit.</p>
      </div>
      ${canUpload ? `<button class="btn" id="btn_upload_mat"><span aria-hidden="true">📤</span> Ngarko material</button>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px;padding:14px 18px">
      <div class="row" style="justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
        <div class="row" style="gap:12px;align-items:center;min-width:0;flex:1">
          <span class="stat-icon" style="width:42px;height:42px;font-size:22px" aria-hidden="true">🧠</span>
          <div style="min-width:0;flex:1">
            <div style="font-size:14.5px;font-weight:700;color:var(--ink)">
              Ndihmësi i xhepit: Përgjigje për skeptikët
            </div>
            <div class="meta" style="font-size:13px;margin-top:2px">
              Argumente dhe përgjigje të shpejta për pyetjet më të shpeshta të qytetarëve në terren.
            </div>
          </div>
        </div>
        <a class="btn sec sm" href="https://referendum21.org/skeptik" target="_blank" rel="noopener" style="white-space:nowrap;font-weight:600">
          Hap udhëzuesin ↗
        </a>
      </div>
    </div>

    ${rows.length ? `
      <div class="grid" style="gap:16px">
        ${catKeys.filter(k => byCat[k]?.length).map(cat => `
          <div class="card">
            <div class="row" style="gap:10px;align-items:center;margin-bottom:12px">
              <span class="stat-icon" style="width:36px;height:36px;font-size:18px" aria-hidden="true">${CATS[cat][0]}</span>
              <h3 style="margin:0;font-size:16px">${esc(CATS[cat][1])}</h3>
            </div>
            <div>
              ${byCat[cat].map(m => materialItemHtml(m)).join('')}
            </div>
          </div>`).join('')}
      </div>` : `
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">📚</div>
          <div class="empty-state-title">Ende pa materiale të ngarkuara</div>
          <div class="empty-state-desc">
            Udhëzuesit ligjorë, fletëpalosjet dhe formularët zyrtarë do të shfaqen këtu për shkarkim.
          </div>
          ${canUpload ? `<button class="btn" id="btn_upload_mat_empty">➕ Ngarko material të ri</button>` : ''}
        </div>`}`;

  document.getElementById('btn_upload_mat')?.addEventListener('click', openMaterialModal);
  document.getElementById('btn_upload_mat_empty')?.addEventListener('click', openMaterialModal);

  view.querySelectorAll<HTMLElement>('[data-del-mat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delMat;
      const path = btn.dataset.matPath;
      if (id) delMat(id, path || null);
    });
  });
}

export function materialItemHtml(m: MaterialRow): string {
  const rawUrl = m.file_path ? matUrl(m.file_path) : m.external_url;
  const url = safeUrl(rawUrl);
  const canDel = store.isStaff();

  return `
  <div class="file-item" style="padding:12px 0;align-items:center">
    <div class="file-ic" aria-hidden="true" style="font-size:20px">${CATS[m.category]?.[0] || '📎'}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:14.5px">
        ${url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : esc(m.title)}
      </div>
      ${m.description ? `<div class="meta" style="margin-top:2px">${esc(m.description)}</div>` : ''}
      <div class="meta" style="margin-top:2px;font-size:12px">
        ${m.size ? `<span class="pill gray" style="font-size:10.5px;padding:1px 6px;margin-right:4px">${fmtSize(m.size)}</span>` : ''}ngarkuar ${fmtDate(m.created_at)}
        ${m.uploader_name ? ` nga <b>${esc(m.uploader_name)}</b>` : ''}
      </div>
    </div>
    <div class="row" style="gap:8px">
      ${url ? `<a class="btn sec sm" href="${esc(url)}" target="_blank" rel="noopener" download style="font-weight:600">Shkarko ↗</a>` : ''}
      ${canDel ? `<button class="btn ghost sm" data-del-mat="${m.id}" data-mat-path="${esc(m.file_path || '')}" title="Fshi materialin" style="color:var(--muted)">✕</button>` : ''}
    </div>
  </div>`;
}

export function openMaterialModal(): void {
  const catKeys = Object.keys(CATS) as MaterialCategory[];

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Ngarko material të ri</h3>
    <label>Titulli *</label>
    <input id="mat_title" placeholder="p.sh. Manuali i mbledhjes v1.2">
    <label>Kategoria *</label>
    <select id="mat_cat">
      ${catKeys.map(k => `<option value="${k}">${CATS[k][0]} ${CATS[k][1]}</option>`).join('')}
    </select>
    <label>Përshkrimi (opsionale)</label>
    <textarea id="mat_desc" placeholder="Për çfarë shërben ky material…"></textarea>
    <label>Skedari (PDF, DOCX, PNG, JPG deri 25MB)</label>
    <input id="mat_file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg">
    <label style="margin-top:8px">Ose link i jashtëm (URL)</label>
    <input id="mat_url" type="url" placeholder="https://…">
    <div class="row" style="margin-top:16px">
      <button class="btn" id="mat_save_btn">Ruaj materialin</button>
      <button class="btn ghost" id="mat_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('mat_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('mat_save_btn')?.addEventListener('click', uploadMat);
}

export async function uploadMat(): Promise<void> {
  const titleInput = document.getElementById('mat_title') as HTMLInputElement | null;
  const catSelect = document.getElementById('mat_cat') as HTMLSelectElement | null;
  const descInput = document.getElementById('mat_desc') as HTMLTextAreaElement | null;
  const fileInput = document.getElementById('mat_file') as HTMLInputElement | null;
  const urlInput = document.getElementById('mat_url') as HTMLInputElement | null;
  const btn = document.getElementById('mat_save_btn') as HTMLButtonElement | null;

  const title = (titleInput?.value || '').trim();
  const category = (catSelect?.value || 'other') as MaterialCategory;
  const description = (descInput?.value || '').trim() || null;
  const external_url = (urlInput?.value || '').trim() || null;
  const file = fileInput?.files?.[0];

  if (!title) return fail('Vendosni titullin e materialit.');
  if (!file && !external_url) return fail('Zgjidhni një skedar ose vendosni një link URL.');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Po ngarkohet…';
  }

  let file_path: string | null = null;
  let file_name: string | null = null;
  let mime: string | null = null;
  let size: number | null = null;

  if (file) {
    const ext = file.name.split('.').pop() || 'dat';
    file_path = `mats/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    file_name = file.name;
    mime = file.type || null;
    size = file.size;

    const { error: upErr } = await sb.storage.from('vol-materials').upload(file_path, file);
    if (upErr) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Ruaj materialin';
      }
      return fail(upErr);
    }
  }

  const { error: insErr } = await sb.from('materials').insert({
    title,
    category,
    description,
    file_path,
    file_name,
    mime,
    size,
    external_url,
    uploader_name: store.ME?.full_name || store.ME?.volunteer_code,
  });

  if (insErr) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Ruaj materialin';
    }
    return fail(insErr);
  }

  closeModal();
  toast('Materiali u ngarkua me sukses.');
  vMaterials();
}

export async function delMat(id: string, path: string | null): Promise<void> {
  const ok = await confirmAction({
    title: 'Fshi materialin',
    message: 'A jeni i sigurt që dëshironi të fshini këtë material? Ky veprim nuk mund të kthehet mbrapa.',
    confirmText: 'Fshi materialin',
    confirmClass: 'btn-danger',
    icon: '🗑️'
  });
  if (!ok) return;
  if (path) {
    await sb.storage.from('vol-materials').remove([path]);
  }
  const { error } = await sb.from('materials').delete().eq('id', id);
  if (error) return fail(error);
  toast('Materiali u fshi.');
  vMaterials();
}
