import { sb, DEFAULT_GOAL } from '../api/client';
import { store } from '../state/store';
import { esc } from '../utils/security';
import { nf, fmtDate, fmtTime, daysLeft } from '../utils/format';
import { slotsHtml } from '../components/slots';
import { toast, fail } from '../components/toast';
import { pushState, enablePush, disablePush, notifyPush } from '../api/push';
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

    <div id="push_card"></div>

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

  renderPushCard();

  // Attach navigation listeners
  view.querySelectorAll<HTMLElement>('[data-nav-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const tab = el.dataset.navTab;
      if (tab) go(tab);
    });
  });
}

/**
 * Njoftimet në telefon — çelësi ndez/fik, i dukshëm për ÇDO vullnetar.
 *
 * Karta shfaqet gjithmonë. Nëse njoftimet s'mund të ndizen, arsyeja shkruhet
 * këtu: heshtja e mëparshme (karta zhdukej kur mungonte çelësi VAPID) e linte
 * përdoruesin pa asnjë shenjë se çfarë kishte ndodhur.
 */
export async function renderPushCard(): Promise<void> {
  const host = document.getElementById('push_card');
  if (!host) return;

  const state = await pushState();
  const forReports = store.isInternal();

  const copy: Record<string, { line: string; hint?: string }> = {
    on: {
      line: 'Njoftimet janë <b>aktive</b> në këtë pajisje.',
      hint: forReports
        ? 'Do të njoftoheni për njoftimet e qendrës dhe për raportimet e reja nga terreni.'
        : 'Do të njoftoheni kur qendra publikon një njoftim.',
    },
    off: {
      line: 'Njoftimet janë <b>të fikura</b> në këtë pajisje.',
      hint: forReports
        ? 'Ndizini për të marrë njoftimet e qendrës dhe raportimet e reja nga terreni.'
        : 'Ndizini për të marrë njoftimet e qendrës në telefon.',
    },
    blocked: {
      line: 'Njoftimet janë <b>të bllokuara</b> nga shfletuesi.',
      hint: 'Hapni cilësimet e faqes te shfletuesi, lejoni njoftimet, dhe rifreskoni këtë faqe.',
    },
    'needs-install': {
      line: 'Në iPhone duhet fillimisht <b>instalimi</b> i portalit.',
      hint: 'Safari → butoni i ndarjes → «Add to Home Screen». Pastaj hapeni nga ikona dhe kthehuni këtu.',
    },
    unsupported: {
      line: 'Ky shfletues nuk i mbështet njoftimet.',
      hint: 'Provoni me Chrome në Android, ose me portalin e instaluar në iPhone.',
    },
    'not-configured': {
      line: 'Njoftimet nuk janë aktivizuar ende nga qendra.',
      hint: store.isAdmin()
        ? 'Mungon VITE_VAPID_PUBLIC_KEY në ndërtim dhe VAPID_PRIVATE_KEY te Cloudflare. Shihni PUSH_SETUP.md.'
        : 'Kur qendra ta përfundojë konfigurimin, butoni do të funksionojë vetvetiu.',
    },
  };

  const c = copy[state];
  const canToggle = state === 'on' || state === 'off';

  host.innerHTML = `
    <div class="card wide" style="margin-bottom:16px">
      <div class="row" style="justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="min-width:220px;flex:1">
          <div class="row" style="gap:8px;align-items:center">
            <h3 style="margin:0">🔔 Njoftimet në telefon</h3>
            <span class="pill ${state === 'on' ? 'ok' : state === 'off' ? 'gray' : 'amber'}">
              ${state === 'on' ? 'Aktive' : state === 'off' ? 'Të fikura' : 'Të padisponueshme'}
            </span>
          </div>
          <div class="meta" style="margin-top:5px">${c.line}</div>
          ${c.hint ? `<div class="meta" style="margin-top:3px">${c.hint}</div>` : ''}
        </div>
        <div class="row" style="gap:8px">
          ${state === 'on'
            ? `<button class="btn sec sm" id="push_test">Provo</button>
               <button class="btn ghost sm" id="push_off">Çaktivizo</button>`
            : `<button class="btn" id="push_on" ${canToggle ? '' : 'disabled'}>Aktivizo njoftimet</button>`}
        </div>
      </div>
    </div>`;

  document.getElementById('push_on')?.addEventListener('click', async () => {
    const btn = document.getElementById('push_on') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = 'Po aktivizohet…'; }
    const res = await enablePush();
    if (!res.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'Aktivizo njoftimet'; }
      fail(res.reason || 'Njoftimet nuk u aktivizuan.');
      return renderPushCard();
    }
    toast('Njoftimet u aktivizuan në këtë pajisje.');
    window.dispatchEvent(new CustomEvent('push:changed'));
    renderPushCard();
  });

  document.getElementById('push_off')?.addEventListener('click', async () => {
    const res = await disablePush();
    if (!res.ok) return fail(res.reason || 'Njoftimet nuk u çaktivizuan.');
    toast('Njoftimet u çaktivizuan në këtë pajisje.');
    window.dispatchEvent(new CustomEvent('push:changed'));
    renderPushCard();
  });

  document.getElementById('push_test')?.addEventListener('click', async () => {
    const res = await notifyPush('test');
    toast(res && res.sent > 0
      ? 'Njoftimi provë u dërgua — duhet të shfaqet brenda pak sekondash.'
      : 'Prova nuk u dërgua. Kontrolloni lidhjen dhe cilësimet e njoftimeve.');
  });
}

// Çelësi te koka e faqes dhe karta këtu tregojnë të njëjtën gjendje.
window.addEventListener('push:changed', () => {
  if (document.getElementById('push_card')) renderPushCard();
});
