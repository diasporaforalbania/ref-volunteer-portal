import { store, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { avatarHtml } from '../api/storage';
import { doLogout } from '../views/auth';

export function renderHeader(): string {
  if (!store.ME) return '';
  const email = store.SESSION?.user?.email || '';
  const unitName = store.ME.units ? ' · ' + esc(store.ME.units.name) : '';
  const roleName = esc(ROLES[store.ME.role] || store.ME.role);

  return `
  <header class="app"><div class="h-row">
    <div class="brand"><h1>Referendumi</h1><span class="tag">Portali i vullnetarëve</span></div>
    <div class="who">
      ${avatarHtml(store.ME.photo_path, store.ME.full_name, 'av')}
      <div><div class="nm">${esc(store.ME.full_name || email)}</div>
           <div class="rl">${roleName}${unitName}</div></div>
      <button class="btn ghost sm" style="color:#fff;border:1px solid rgba(255,255,255,.5)" id="btn_logout">Dil</button>
    </div>
  </div></header>`;
}

export function attachHeaderEvents(): void {
  document.getElementById('btn_logout')?.addEventListener('click', doLogout);
}
