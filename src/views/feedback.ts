import { sb } from '../api/client';
import { store, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { fmtDateTime } from '../utils/format';
import { toast, fail } from '../components/toast';
import { openFeedbackModal } from '../components/feedbackModal';
import type { FeedbackRow, FeedbackStatus, FeedbackCategory, VolunteerRole } from '../types/database';

let activeStatusFilter: 'all' | FeedbackStatus = 'all';
let activeCategoryFilter: 'all' | FeedbackCategory = 'all';
let searchQuery = '';

export async function vFeedback(): Promise<void> {
  const view = document.getElementById('view');
  if (!view || !store.isFeedbackAdmin()) return;

  view.innerHTML = '<div class="empty">Po ngarkohen idetë dhe sugjerimet…</div>';

  const { data, error } = await sb
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  const rows = (data || []) as FeedbackRow[];

  renderFeedbackView(rows);
}

function renderFeedbackView(allRows: FeedbackRow[]): void {
  const view = document.getElementById('view');
  if (!view) return;

  const totalNew = allRows.filter(r => r.status === 'new').length;
  const totalReviewed = allRows.filter(r => r.status === 'reviewed').length;
  const totalPlanned = allRows.filter(r => r.status === 'planned').length;
  const totalDone = allRows.filter(r => r.status === 'done').length;

  const filtered = allRows.filter(r => {
    if (activeStatusFilter !== 'all' && r.status !== activeStatusFilter) return false;
    if (activeCategoryFilter !== 'all' && r.category !== activeCategoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDesc = (r.description || '').toLowerCase().includes(q);
      const matchAuthor = (r.volunteer_name || '').toLowerCase().includes(q);
      const matchUnit = (r.unit_code || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchAuthor && !matchUnit) return false;
    }
    return true;
  });

  view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div>
        <h2 class="sec" style="margin:0">💡 Idetë & Sugjerimet e Vullnetarëve</h2>
        <p class="sub" style="margin:0">Paneli i dedikuar për IT dhe Administratorët për shqyrtimin dhe menaxhimin e ideve nga terreni.</p>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn sec sm" id="btn_refresh_fb">↻ Rifresko</button>
        <button class="btn sm" id="btn_new_fb">+ Shto ide të re</button>
      </div>
    </div>

    <!-- Përmbledhja Statistikore -->
    <div class="grid g4" style="gap:12px;margin-bottom:18px">
      <div class="card stat-card" style="padding:12px 14px;cursor:pointer;border-top:3px solid var(--c-amber-500,#f59e0b)" data-set-status="new">
        <div class="meta" style="font-size:12px">TË REJA</div>
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-top:4px">
          <b style="font-size:24px;color:var(--c-amber-600,#d97706)">${totalNew}</b>
          <span class="pill amber">Nevoje shqyrtimi</span>
        </div>
      </div>
      <div class="card stat-card" style="padding:12px 14px;cursor:pointer;border-top:3px solid var(--c-blue-500,#3b82f6)" data-set-status="reviewed">
        <div class="meta" style="font-size:12px">NË SHQYRTIM</div>
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-top:4px">
          <b style="font-size:24px;color:var(--c-blue-600,#2563eb)">${totalReviewed}</b>
          <span class="pill blue">Në diskutim</span>
        </div>
      </div>
      <div class="card stat-card" style="padding:12px 14px;cursor:pointer;border-top:3px solid #8b5cf6" data-set-status="planned">
        <div class="meta" style="font-size:12px">TË PLANIFIKUARA</div>
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-top:4px">
          <b style="font-size:24px;color:#7c3aed">${totalPlanned}</b>
          <span class="pill" style="background:rgba(139,92,246,0.15);color:#7c3aed">Në roadmap</span>
        </div>
      </div>
      <div class="card stat-card" style="padding:12px 14px;cursor:pointer;border-top:3px solid var(--c-green-500,#10b981)" data-set-status="done">
        <div class="meta" style="font-size:12px">PËRFUNDUARA</div>
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-top:4px">
          <b style="font-size:24px;color:var(--c-green-600,#059669)">${totalDone}</b>
          <span class="pill green">Të kryera</span>
        </div>
      </div>
    </div>

    <!-- Filtra dhe Kërkimi -->
    <div class="card" style="margin-bottom:16px;padding:12px 16px">
      <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <button class="btn ${activeStatusFilter === 'all' ? '' : 'ghost'} sm" data-fb-filter-status="all">Të gjitha (${allRows.length})</button>
          <button class="btn ${activeStatusFilter === 'new' ? '' : 'ghost'} sm" data-fb-filter-status="new">Të reja (${totalNew})</button>
          <button class="btn ${activeStatusFilter === 'reviewed' ? '' : 'ghost'} sm" data-fb-filter-status="reviewed">Në shqyrtim (${totalReviewed})</button>
          <button class="btn ${activeStatusFilter === 'planned' ? '' : 'ghost'} sm" data-fb-filter-status="planned">Planifikuar (${totalPlanned})</button>
          <button class="btn ${activeStatusFilter === 'done' ? '' : 'ghost'} sm" data-fb-filter-status="done">Përfunduar (${totalDone})</button>
        </div>
        <div class="row" style="gap:8px;flex:1;justify-content:flex-end;min-width:260px">
          <select id="fb_sel_category" style="max-width:160px;font-size:13px;padding:6px 10px">
            <option value="all" ${activeCategoryFilter === 'all' ? 'selected' : ''}>Çdo kategori</option>
            <option value="feature" ${activeCategoryFilter === 'feature' ? 'selected' : ''}>💡 Veçori</option>
            <option value="improvement" ${activeCategoryFilter === 'improvement' ? 'selected' : ''}>⚡ Përmirësim</option>
            <option value="bug" ${activeCategoryFilter === 'bug' ? 'selected' : ''}>🐞 Problem</option>
          </select>
          <input id="fb_search_input" type="text" placeholder="Kërko titull, vullnetar..." value="${esc(searchQuery)}" style="max-width:200px;font-size:13px;padding:6px 10px">
        </div>
      </div>
    </div>

    <!-- Lista e Sugjerimeve -->
    <div style="display:flex;flex-direction:column;gap:12px" id="feedback_container">
      ${filtered.length ? filtered.map(f => feedbackItemCardHtml(f)).join('') : '<div class="empty">Nuk ka ide ose sugjerime që përputhen me filtrat.</div>'}
    </div>
  `;

  attachFeedbackEvents(allRows);
}

function feedbackCategoryPill(cat: FeedbackCategory): string {
  switch (cat) {
    case 'bug':
      return `<span class="pill red">🐞 Problem</span>`;
    case 'improvement':
      return `<span class="pill amber">⚡ Përmirësim</span>`;
    case 'feature':
    default:
      return `<span class="pill teal">💡 Veçori</span>`;
  }
}

function feedbackStatusPill(status: FeedbackStatus): string {
  switch (status) {
    case 'new':
      return `<span class="pill amber">E re</span>`;
    case 'reviewed':
      return `<span class="pill blue">Në shqyrtim</span>`;
    case 'planned':
      return `<span class="pill" style="background:rgba(139,92,246,0.15);color:#7c3aed">E planifikuar</span>`;
    case 'done':
      return `<span class="pill green">Përfunduar</span>`;
  }
}

function feedbackItemCardHtml(f: FeedbackRow): string {
  const roleName = f.volunteer_role ? (ROLES[f.volunteer_role as VolunteerRole] || f.volunteer_role) : '';
  const isDone = f.status === 'done';

  return `
  <div class="card" style="padding:16px;border-left:4px solid ${f.category === 'bug' ? 'var(--c-red-500,#ef4444)' : f.category === 'improvement' ? 'var(--c-amber-500,#f59e0b)' : 'var(--c-teal-500,#0d9488)'};background:var(--bg-card)">
    <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
      <div style="flex:1;min-width:280px">
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
          ${feedbackCategoryPill(f.category)}
          <h3 style="margin:0;font-size:16px;color:var(--text)">${esc(f.title)}</h3>
          ${feedbackStatusPill(f.status)}
        </div>
        <div class="meta" style="margin-top:6px;font-size:13px">
          nga <b>${esc(f.volunteer_name || 'Vullnetar')}</b>
          ${roleName ? ` · <span class="tag" style="padding:1px 6px;font-size:11px">${esc(roleName)}</span>` : ''}
          ${f.unit_code ? ` · Njësia <b>${esc(f.unit_code)}</b>` : ''}
          · dorëzuar ${fmtDateTime(f.created_at)}
          ${f.page_route ? ` · 📍 Faqja: <code>${esc(f.page_route)}</code>` : ''}
        </div>
      </div>

      <!-- Action Box -->
      <div class="row" style="gap:8px;align-items:center">
        <select class="sm" data-fb-change-status="${f.id}" style="font-size:13px;padding:5px 8px">
          <option value="new" ${f.status === 'new' ? 'selected' : ''}>E re</option>
          <option value="reviewed" ${f.status === 'reviewed' ? 'selected' : ''}>Në shqyrtim</option>
          <option value="planned" ${f.status === 'planned' ? 'selected' : ''}>E planifikuar</option>
          <option value="done" ${f.status === 'done' ? 'selected' : ''}>Përfunduar</option>
        </select>
        ${!isDone ? `
          <button class="btn green sm" data-fb-mark-done="${f.id}" title="Shëno si e kryer">
            ✓ Shëno si e kryer
          </button>
        ` : `
          <button class="btn ghost sm" data-fb-reopen="${f.id}" title="Rihap sugjerimin">
            ↻ Rihape
          </button>
        `}
      </div>
    </div>

    <!-- Përmbajtja e Sugjerimit -->
    <div style="margin-top:12px;padding:10px 14px;background:var(--bg-main);border-radius:6px;border:1px solid var(--line);font-size:14px;line-height:1.55;color:var(--text);white-space:pre-wrap">
      ${esc(f.description)}
    </div>

    <!-- Footer info & Timestamp -->
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;flex-wrap:wrap;gap:8px">
      <div>
        ${isDone && f.closed_at ? `
          <span style="color:var(--c-green-600,#059669);font-weight:600">
            ✅ Përfunduar më: ${fmtDateTime(f.closed_at)}
          </span>
        ` : isDone ? `
          <span style="color:var(--c-green-600,#059669);font-weight:600">
            ✅ Përfunduar
          </span>
        ` : ''}
      </div>
      ${f.device_info ? `
        <div class="meta" style="font-size:11.5px;opacity:0.65" title="${esc(f.device_info)}">
          Pajisja: ${esc(f.device_info.slice(0, 70))}${f.device_info.length > 70 ? '…' : ''}
        </div>
      ` : ''}
    </div>
  </div>`;
}

function attachFeedbackEvents(allRows: FeedbackRow[]): void {
  const view = document.getElementById('view');
  if (!view) return;

  document.getElementById('btn_refresh_fb')?.addEventListener('click', vFeedback);
  document.getElementById('btn_new_fb')?.addEventListener('click', openFeedbackModal);

  // Status stats cards click
  view.querySelectorAll<HTMLElement>('[data-set-status]').forEach(card => {
    card.addEventListener('click', () => {
      const st = card.dataset.setStatus as FeedbackStatus;
      if (st) {
        activeStatusFilter = activeStatusFilter === st ? 'all' : st;
        renderFeedbackView(allRows);
      }
    });
  });

  // Filter status buttons
  view.querySelectorAll<HTMLElement>('[data-fb-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = btn.dataset.fbFilterStatus as 'all' | FeedbackStatus;
      if (st) {
        activeStatusFilter = st;
        renderFeedbackView(allRows);
      }
    });
  });

  // Category select
  document.getElementById('fb_sel_category')?.addEventListener('change', (e) => {
    activeCategoryFilter = (e.target as HTMLSelectElement).value as 'all' | FeedbackCategory;
    renderFeedbackView(allRows);
  });

  // Search input
  const searchInp = document.getElementById('fb_search_input') as HTMLInputElement | null;
  searchInp?.addEventListener('input', () => {
    searchQuery = searchInp.value.trim();
    renderFeedbackView(allRows);
  });

  // Change status select
  view.querySelectorAll<HTMLSelectElement>('[data-fb-change-status]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.fbChangeStatus;
      const status = sel.value as FeedbackStatus;
      if (!id) return;
      sel.disabled = true;

      const updatePayload: { status: FeedbackStatus; closed_at?: string | null } = { status };
      if (status === 'done') {
        updatePayload.closed_at = new Date().toISOString();
      } else {
        updatePayload.closed_at = null;
      }

      const { error } = await sb.from('feedback').update(updatePayload).eq('id', id);
      sel.disabled = false;
      if (error) return fail(error);

      toast(`Statusi u përditësua në "${status === 'done' ? 'Përfunduar' : status}".`);
      await vFeedback();
    });
  });

  // Mark done button
  view.querySelectorAll<HTMLElement>('[data-fb-mark-done]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.fbMarkDone;
      if (!id) return;
      const closedAt = new Date().toISOString();
      const { error } = await sb
        .from('feedback')
        .update({ status: 'done', closed_at: closedAt })
        .eq('id', id);

      if (error) return fail(error);
      toast('Ideja u shënua si e kryer.');
      await vFeedback();
    });
  });

  // Reopen button
  view.querySelectorAll<HTMLElement>('[data-fb-reopen]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.fbReopen;
      if (!id) return;
      const { error } = await sb
        .from('feedback')
        .update({ status: 'reviewed', closed_at: null })
        .eq('id', id);

      if (error) return fail(error);
      toast('Ideja u rihap për shqyrtim.');
      await vFeedback();
    });
  });
}
