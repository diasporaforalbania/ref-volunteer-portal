import { sb } from '../api/client';
import { store } from '../state/store';
import { toast, fail } from './toast';
import { openModal, closeModal } from './modal';
import type { FeedbackCategory } from '../types/database';

export function openFeedbackModal(): void {
  if (!store.ME) {
    return fail('Duhet të jeni të kyçur për të dërguar sugjerime.');
  }

  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <div class="row" style="gap:8px;align-items:center;margin-bottom:8px">
      <span style="font-size:24px">💡</span>
      <div>
        <h3 style="margin:0">Sugjero një ide ose raporto</h3>
        <div class="meta">Mendimi juaj shkon drejtpërdrejt te ekipi i zhvillimit të portalit.</div>
      </div>
    </div>

    <label for="fb_cat">Kategoria *</label>
    <select id="fb_cat">
      <option value="feature">💡 Veçori e re — Diçka e re që ju duhet në portal</option>
      <option value="improvement">⚡ Përmirësim — Diçka ekzistuese që mund të bëhet më mirë</option>
      <option value="bug">🐞 Raporto gabim — Diçka që nuk po punon siç duhet</option>
    </select>

    <label for="fb_title" style="margin-top:12px">Titulli i shkurtër *</label>
    <input id="fb_title" type="text" maxlength="120" placeholder="p.sh. Eksporti i orarit në Excel, ose butoni i shpejtë në terren">

    <label for="fb_desc" style="margin-top:12px">Përshkrimi i hollësishëm *</label>
    <textarea id="fb_desc" rows="4" maxlength="1500" placeholder="Shpjegoni me pak fjalë çfarë do t'ju ndihmonte në punën tuaj të përditshme..."></textarea>

    <div class="row" style="margin-top:18px;justify-content:flex-end;gap:8px">
      <button class="btn ghost" id="fb_cancel_btn" type="button">Anulo</button>
      <button class="btn" id="fb_submit_btn" type="button">Dërgo sugjerimin</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('fb_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('fb_submit_btn')?.addEventListener('click', submitFeedback);
}

async function submitFeedback(): Promise<void> {
  const catSel = document.getElementById('fb_cat') as HTMLSelectElement | null;
  const titleInp = document.getElementById('fb_title') as HTMLInputElement | null;
  const descInp = document.getElementById('fb_desc') as HTMLTextAreaElement | null;
  const btn = document.getElementById('fb_submit_btn') as HTMLButtonElement | null;

  const category = (catSel?.value || 'feature') as FeedbackCategory;
  const title = (titleInp?.value || '').trim();
  const description = (descInp?.value || '').trim();

  if (!title) return fail('Ju lutem vendosni një titull për sugjerimin.');
  if (!description) return fail('Ju lutem përshkruani idenë ose problemin tuaj.');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Po dërgohet…';
  }

  const deviceInfo = typeof navigator !== 'undefined'
    ? `${navigator.userAgent.slice(0, 180)} (${window.innerWidth}x${window.innerHeight})`
    : null;

  const { error } = await sb.from('feedback').insert({
    volunteer_id: store.ME?.id,
    volunteer_name: store.ME?.full_name || store.ME?.volunteer_code,
    volunteer_role: store.ME?.role,
    unit_code: store.ME?.units?.code || null,
    category,
    title,
    description,
    page_route: store.activeTab,
    device_info: deviceInfo,
    status: 'new',
  });

  if (error) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dërgo sugjerimin';
    }
    return fail(error);
  }

  closeModal();
  toast('Faleminderit! Sugjerimi juaj iu dërgua me sukses ekipit të zhvillimit.');
}
