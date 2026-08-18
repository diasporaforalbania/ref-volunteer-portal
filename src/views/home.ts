import { sb, DEFAULT_GOAL, VAPID_PUBLIC_KEY } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { nf, fmtDate, fmtTime, daysLeft } from '../utils/format';
import { slotsHtml } from '../components/slots';
import { shiftWhen } from './shifts';
import type { ShiftListItem } from '../types/database';

export function statCard(c: string, n: string, l: string): string {
  return `
  <div class="card stat">
    <div><div class="n" style="color:${c}">${n}</div>
         <div class="meta" style="margin-top:2px">${l}</div></div>
  </div>`;
}

export function quickCard(ic: string, t: string, d: string, tab: string): string {
  return `
  <div class="card" style="cursor:pointer" data-nav-tab="${tab}">
    <div style="font-size:24px">${ic}</div>
    <h3 style="margin:8px 0 2px">${t}</h3>
    <div class="meta">${d}</div>
  </div>`;
}

export async function vHome(go: (k: any) => void): Promise<void> {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '<div class="empty">Po ngarkohet…</div>';

  const [ann, camp, nextShift] = await Promise.all([
    sb.from('announcements')
      .select('id,title,level,created_at,author_name,pinned')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3),
    sb.from('campaign').select('*').eq('id', 1).maybeSingle(),
    store.isQendra() ? Promise.resolve({ data: null }) : sb.rpc('my_next_shift'),
  ]);

  const stats = store.STATS;
  const sig = stats.signatures || 0;
  const goal = camp.data?.goal || stats.goal || DEFAULT_GOAL;
  const pc = Math.min(100, Math.round((sig / goal) * 100));
  const dl = daysLeft(camp.data?.deadline || stats.deadline);
  const nextRows = nextShift.data as ShiftListItem[] | ShiftListItem | null;
  const next = Array.isArray(nextRows) ? nextRows[0] : nextRows;

  view.innerHTML = `
    <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,#ffffff 60%,#effaf8)">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div>
          <div class="meta" style="text-transform:uppercase;letter-spacing:.8px;font-weight:700;color:var(--teal)">
            ${esc(camp.data?.title || 'Fushata e nënshkrimeve')}</div>
          <div style="font-size:36px;font-weight:800;line-height:1.1;margin:4px 0">
            ${nf(sig)} <span style="font-size:20px;font-weight:600;color:var(--muted)">/ ${nf(goal)}</span>
          </div>
          <div class="meta">${pc}% e objektivit të përgjithshëm</div>
        </div>
        ${dl != null ? `<div class="pill ${dl < 10 ? 'red' : 'ok'}" style="font-size:13px;padding:6px 14px">
          ${dl > 0 ? `Edhe ${dl} ditë` : 'Afati ka kaluar'}</div>` : ''}
      </div>
      <div class="bar big" style="margin-top:14px"><span style="width:${pc}%"></span></div>
    </div>

    <div class="grid g-home" style="margin-bottom:16px">
      ${statCard('var(--teal)', nf(stats.active_volunteers || 0), 'Vullnetarë aktivë')}
      ${statCard('var(--cyan)', nf(stats.open_units || 0), 'Zona të hapura')}

      <div class="card wide" style="background:#fff">
        <div class="row" style="justify-content:space-between;align-items:baseline">
          <h3 style="margin:0">Turni juaj i radhës</h3>
          <a class="link" style="font-size:13px" data-nav-tab="shifts">Të gjitha ↗</a>
        </div>
        ${next ? `
          <div style="margin-top:8px">
            <div class="row" style="gap:8px;align-items:center">
              <span class="unit-tag">${esc(next.unit_code || '—')}</span>
              <div>
                <b style="font-size:15px">${esc(next.unit_name || '')}</b>
                <div class="meta" style="text-transform:capitalize">${esc(shiftWhen(next))}</div>
              </div>
            </div>
            ${slotsHtml(next.id, next.signed, next.capacity, null, 'flush')}
          </div>` : `
          <div class="meta" style="margin-top:10px">
            ${store.isQendra()
              ? 'Roli juaj është në qendër: turnet e planifikuara i shihni te <a class="link" data-nav-tab="shifts">Turni</a>.'
              : 'Nuk keni asnjë turn të planifikuar. Regjistrohuni te <a class="link" data-nav-tab="shifts">Turni</a>.'}
          </div>`}
      </div>
    </div>

    <div class="grid g2" style="margin-bottom:16px">
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:8px">
          <h3 style="margin:0">Njoftimet e fundit</h3>
          <a class="link" style="font-size:13px" data-nav-tab="news">Të gjitha ↗</a>
        </div>
        ${(ann.data || []).length ? `
          <ul class="list">
            ${(ann.data || []).map(a => `
              <li>
                <div>
                  <div style="font-weight:700;font-size:14.5px">
                    ${a.pinned ? '📌 ' : ''}${a.level === 'urgent' ? '🚨 ' : a.level === 'important' ? '❗ ' : ''}
                    ${esc(a.title)}
                  </div>
                  <div class="meta">${fmtDate(a.created_at)} · ${esc(a.author_name || 'qendra')}</div>
                </div>
              </li>`).join('')}
          </ul>` : '<div class="empty">Asnjë njoftim ende.</div>'}
      </div>

      <div class="grid g2">
        ${quickCard('📍', 'Terreni', 'Shih kush është në terren tani dhe ku ndodhen mbledhësit aktivë.', 'field')}
        ${quickCard('🪪', 'Karta ime', 'Karta juaj dixhitale e vullnetarit, kodi unik dhe QR-ja e verifikimit.', 'badge')}
        ${quickCard('📘', 'Materiale', 'Manuali i vullnetarit, formularët ligjorë dhe fletë-palosjet e fushatës.', 'materials')}
        ${quickCard('⚠️', 'Raporto', 'Njofto qendrën për incidente, pyetje ligjore ose materiale të dëmtuara.', 'reports')}
      </div>
    </div>`;

  // Attach navigation listeners
  view.querySelectorAll<HTMLElement>('[data-nav-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const tab = el.dataset.navTab;
      if (tab) go(tab);
    });
  });
}
