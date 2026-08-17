import { sb } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openModal, closeModal } from '../components/modal';
import type { AnnouncementRow, AnnouncementLevel, AnnouncementAudience } from '../types/database';

export async function vNews(): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohen njoftimet…</div>';

  const { data, error } = await sb
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  const rows = (data || []) as AnnouncementRow[];
  const canPost = store.isStaff();

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div>
        <h2 class="sec">Njoftimet</h2>
        <p class="sub" style="margin:0">Udhëzimet zyrtare, njoftimet ditore dhe lajmet e fushatës.</p>
      </div>
      ${canPost ? `<button class="btn" id="btn_new_ann">📣 Njoftim i ri</button>` : ''}
    </div>

    ${rows.length ? `
      <div class="grid" style="gap:14px">
        ${rows.map(a => annCardHtml(a)).join('')}
      </div>` : '<div class="empty">Nuk ka njoftime të publikuara.</div>'}`;

  document.getElementById('btn_new_ann')?.addEventListener('click', openAnnModal);

  view.querySelectorAll<HTMLElement>('[data-del-ann]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delAnn;
      if (id) delAnn(id);
    });
  });
}

export function annCardHtml(a: AnnouncementRow): string {
  const isUrgent = a.level === 'urgent';
  const isImportant = a.level === 'important';
  const levelClass = isUrgent ? 'danger' : isImportant ? 'warn' : '';
  const levelIcon = isUrgent ? '🚨' : isImportant ? '❗' : '📣';
  const isAuthorOrAdmin = a.author_id === store.ME?.id || store.isAdmin();

  return `
  <div class="card" style="border-left:5px solid ${isUrgent ? 'var(--red)' : isImportant ? 'var(--amber)' : 'var(--teal)'}">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div>
        <h3 style="margin:0">
          ${a.pinned ? '📌 ' : ''}${levelIcon} ${esc(a.title)}
        </h3>
        <div class="meta" style="margin-top:3px">
          Nga <b>${esc(a.author_name || 'Qendra')}</b> · ${fmtDateTime(a.created_at)}
          ${a.audience === 'staff' ? ' · <span class="pill blue">Vetëm qendra & koordinatorët</span>' : ''}
        </div>
      </div>
      ${isAuthorOrAdmin ? `<button class="btn ghost sm" data-del-ann="${a.id}" title="Fshi njoftimin">✕</button>` : ''}
    </div>
    <div style="margin-top:12px;white-space:pre-wrap;line-height:1.6">${esc(a.body)}</div>
  </div>`;
}

export function openAnnModal(): void {
  openModal(`
  <div class="modal">
    <button class="modal-x" id="modal_close_btn">✕</button>
    <h3>Shkruaj njoftim të ri</h3>
    <label>Titulli *</label>
    <input id="an_title" placeholder="Titulli i njoftimit">
    <label>Përmbajtja *</label>
    <textarea id="an_body" placeholder="Shkruani mesazhin këtu…"></textarea>
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Rëndësia</label>
        <select id="an_level">
          <option value="info">Normale (info)</option>
          <option value="important">E rëndësishme ❗</option>
          <option value="urgent">Urgjente 🚨</option>
        </select>
      </div>
      <div style="flex:1">
        <label>Kush e sheh?</label>
        <select id="an_aud">
          <option value="all">Të gjithë vullnetarët</option>
          <option value="staff">Vetëm qendra & koordinatorët</option>
        </select>
      </div>
    </div>
    <label style="margin-top:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
      <input type="checkbox" id="an_pin" style="width:auto;height:auto"> Mbaje të gozhduar lart (pinned)
    </label>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="an_save_btn">Publiko</button>
      <button class="btn ghost" id="an_cancel_btn">Anulo</button>
    </div>
  </div>`);

  document.getElementById('modal_close_btn')?.addEventListener('click', closeModal);
  document.getElementById('an_cancel_btn')?.addEventListener('click', closeModal);
  document.getElementById('an_save_btn')?.addEventListener('click', addAnn);
}

export async function addAnn(): Promise<void> {
  const titleInput = document.getElementById('an_title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('an_body') as HTMLTextAreaElement | null;
  const levelSelect = document.getElementById('an_level') as HTMLSelectElement | null;
  const audSelect = document.getElementById('an_aud') as HTMLSelectElement | null;
  const pinCheck = document.getElementById('an_pin') as HTMLInputElement | null;
  const btn = document.getElementById('an_save_btn') as HTMLButtonElement | null;

  const title = (titleInput?.value || '').trim();
  const body = (bodyInput?.value || '').trim();
  const level = (levelSelect?.value || 'info') as AnnouncementLevel;
  const audience = (audSelect?.value || 'all') as AnnouncementAudience;
  const pinned = !!pinCheck?.checked;

  if (!title) return fail('Vendosni titullin.');
  if (btn) btn.disabled = true;

  const { error } = await sb.from('announcements').insert({
    title,
    body,
    level,
    audience,
    pinned,
    author_id: store.ME?.id,
    author_name: store.ME?.full_name || store.ME?.volunteer_code,
  });

  if (error) {
    if (btn) btn.disabled = false;
    return fail(error);
  }

  closeModal();
  toast('Njoftimi u publikua.');
  vNews();
}

export async function delAnn(id: string): Promise<void> {
  if (!confirm('Të fshihet ky njoftim?')) return;
  const { error } = await sb.from('announcements').delete().eq('id', id);
  if (error) return fail(error);
  toast('Njoftimi u fshi.');
  vNews();
}
