import { store } from '../state/store';
import type { TabKey } from '../types/app';

export function tabList(): Array<[TabKey, string]> {
  const t: Array<[TabKey, string]> = [
    ['home', 'Hyrje'],
    ['news', 'Njoftime'],
    ['field', 'Terreni'],
    ['shifts', 'Turni'],
    ['materials', 'Materiale'],
    ['reports', 'Raportimet'],
    ['badge', 'Karta ime'],
    ['panel', 'Paneli'],
  ];
  if (store.isAdmin() || store.isStaff()) {
    t.push(['history', 'Historiku']);
  }
  if (store.isAdmin()) {
    t.push(['admin', 'Admin']);
  }
  if (store.isFeedbackAdmin()) {
    t.push(['feedback', 'Idetë']);
  }
  return t;
}

export function buildTabsHtml(onTabClick: (k: TabKey) => void): string {
  const openReports = store.isStaff() ? (store.STATS.open_reports || 0) : 0;
  const pendingAdmin = store.isAdmin() ? ((store.STATS.pending || 0) + (store.STATS.pending_requests || 0)) : 0;

  return tabList().map(([k, l]) => {
    let b = '';
    if (k === 'admin' && pendingAdmin) b = `<span class="badge">${pendingAdmin}</span>`;
    if (k === 'reports' && openReports) b = `<span class="badge">${openReports}</span>`;
    return `<button class="tab ${k === store.activeTab ? 'active' : ''}" data-tab="${k}">${l}${b}</button>`;
  }).join('');
}
