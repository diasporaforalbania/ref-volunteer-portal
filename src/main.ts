import './styles/main.css';
import { sb, isConfigMissing } from './api/client';
import { store } from './state/store';
import { renderHeader, attachHeaderEvents } from './components/header';
import { buildTabsHtml } from './components/tabs';
import { renderAuth, renderGate, renderNewPassword } from './views/auth';
import { renderVerify } from './views/verify';
import { vHome } from './views/home';
import { vNews } from './views/news';
import { vField } from './views/field';
import { vShifts } from './views/shifts';
import { vMaterials } from './views/materials';
import { vReports } from './views/reports';
import { vBadge } from './views/myBadge';
import { vPanel } from './views/panel';
import { vAdmin } from './views/admin';
import { vHistory } from './views/history';
import { slotPop } from './components/slots';
import type { TabKey } from './types/app';
import type { VolunteerRow } from './types/database';

export async function go(tab: TabKey): Promise<void> {
  store.activeTab = tab;
  renderShell();

  switch (tab) {
    case 'home':
      await vHome(go);
      break;
    case 'news':
      await vNews();
      break;
    case 'field':
      await vField(go);
      break;
    case 'shifts':
      await vShifts();
      break;
    case 'materials':
      await vMaterials();
      break;
    case 'reports':
      await vReports();
      break;
    case 'badge':
      await vBadge();
      break;
    case 'panel':
      await vPanel();
      break;
    case 'admin':
      await vAdmin();
      break;
    case 'history':
      await vHistory();
      break;
    default:
      await vHome(go);
  }
}

export function renderShell(): void {
  const root = document.getElementById('root');
  if (!root) return;

  const tabsHtml = buildTabsHtml(go);

  root.innerHTML = `
    ${renderHeader()}
    <nav class="tabs"><div class="tabs-inner" id="tabs_container">${tabsHtml}</div></nav>
    <main id="view"></main>
    <div id="toast"></div>
  `;

  attachHeaderEvents();

  // Attach tab click listeners
  document.querySelectorAll<HTMLElement>('.tab[data-tab]').forEach(tabEl => {
    tabEl.addEventListener('click', () => {
      const k = tabEl.dataset.tab as TabKey;
      if (k) go(k);
    });
  });
}

export async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const verifyCode = params.get('v');
  if (verifyCode) {
    return renderVerify(verifyCode);
  }

  // Check if user returned from password reset link
  if (location.hash.includes('type=recovery')) {
    return renderNewPassword();
  }

  if (isConfigMissing()) {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `<div class="auth-wrap"><div class="auth config-warn">
        <h3>Konfigurimi i Supabase mungon</h3>
        <p class="sub">Vendosni <code>SUPABASE_URL</code> dhe <code>SUPABASE_ANON_KEY</code> në kod.</p>
      </div></div>`;
    }
    return;
  }

  // Register service worker if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration skipped:', err);
    });
  }

  // Subscribe to auth state changes (e.g. password recovery)
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      renderNewPassword();
    }
  });

  const { data: sessionData } = await sb.auth.getSession();
  store.SESSION = sessionData.session;

  if (!store.SESSION) {
    return renderAuth('login');
  }

  await loadUserAndStats();
}

export async function loadUserAndStats(): Promise<void> {
  if (!store.SESSION?.user) return renderAuth('login');

  try {
    let meRes = await sb
      .from('volunteers')
      .select('*, units:units!volunteers_unit_id_fkey(*)')
      .eq('id', store.SESSION.user.id)
      .maybeSingle();

    if (meRes.error && !meRes.data) {
      console.warn('[auth] Embed me fkey dështoi, po lexohet direkt tabela volunteers:', meRes.error.message);
      const directRes = await sb
        .from('volunteers')
        .select('*')
        .eq('id', store.SESSION.user.id)
        .maybeSingle();

      if (directRes.data) {
        meRes = directRes;
        if (directRes.data.unit_id) {
          const { data: unitData } = await sb
            .from('units')
            .select('*')
            .eq('id', directRes.data.unit_id)
            .maybeSingle();
          (meRes.data as any).units = unitData || null;
        }
      }
    }

    if (!meRes.data) {
      console.warn('[auth] Profili i vullnetarit nuk ekziston në tabelën volunteers për user id:', store.SESSION.user.id);
      return renderGate('missing');
    }

    store.ME = meRes.data as VolunteerRow;

    // Ngarkojmë statistikat veçmas — nëse dështojnë, nuk bllokojnë hyrjen në portal
    try {
      const statsRes = await sb.rpc('campaign_stats');
      store.STATS = (statsRes.data as any) || {};
    } catch (statsErr) {
      console.warn('[auth] campaign_stats u kapërcye:', statsErr);
      store.STATS = {};
    }

    if (store.ME.status === 'pending') {
      return renderGate('pending');
    }
    if (store.ME.status === 'suspended') {
      return renderGate('suspended');
    }

    go('home');
  } catch (err) {
    console.error('[auth] Përjashtim i papritur gjatë ngarkimit të profilit:', err);
    return renderGate('missing');
  }
}

// Global Custom Event listener when user logs in or signs up
window.addEventListener('app:authenticated', () => {
  loadUserAndStats();
});

// Slot participant popup click delegation
document.addEventListener('click', (e: MouseEvent) => {
  const slotEl = (e.target as HTMLElement)?.closest<HTMLElement>('.slot-p');
  if (slotEl) {
    const sid = slotEl.dataset.slotId;
    const idx = parseInt(slotEl.dataset.slotIdx || '0', 10);
    if (sid != null) {
      slotPop(sid, idx);
    }
  }
});

// Boot the application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => boot());
} else {
  boot();
}
