import { store, ROLES } from '../state/store';
import { esc, truncate } from '../utils/security';
import { avatarHtml } from '../api/storage';
import type { VolunteerRow } from '../types/database';

export function orgCard(v: VolunteerRow, meId?: string): string {
  const isMe = v.id === meId;
  const roleName = esc(ROLES[v.role] || v.role);
  return `
  <div class="org-card${isMe ? ' me' : ''}">
    ${avatarHtml(v.photo_path, v.full_name, 'mini-av')}
    <div class="nm">${esc(truncate(v.full_name || v.volunteer_code, 20))}</div>
    <div class="rl">${roleName}</div>
  </div>`;
}

export function orgBranch(v: VolunteerRow, kidsOf: Record<string, VolunteerRow[]>, meId?: string): string {
  const kids = kidsOf[v.id] || [];
  return `
  <div class="org-branch">
    ${orgCard(v, meId)}
    ${kids.length ? `<div class="org-kids">${kids.map(k => orgBranch(k, kidsOf, meId)).join('')}</div>` : ''}
  </div>`;
}

export function orgCount(v: VolunteerRow, kidsOf: Record<string, VolunteerRow[]>): number {
  return 1 + (kidsOf[v.id] || []).reduce((a, k) => a + orgCount(k, kidsOf), 0);
}

export function orgWrapHtml(roots: VolunteerRow[]): string {
  return `
  <div class="org-wrap">
    ${roots.map(r => `<div class="org-root">${orgBranch(r, store.ORG.kidsOf, store.ME?.id)}</div>`).join('')}
  </div>`;
}

export function structuraHtml(rows: VolunteerRow[]): string {
  if (!rows.length) return '<div class="empty">Ende pa strukturë të caktuar.</div>';
  const byId = Object.fromEntries(rows.map(v => [v.id, v]));
  store.ORG.kidsOf = {};
  rows.forEach(v => {
    if (v.supervisor_id && byId[v.supervisor_id]) {
      (store.ORG.kidsOf[v.supervisor_id] ??= []).push(v);
    }
  });

  const roots = rows.filter(v => !v.supervisor_id || !byId[v.supervisor_id]);

  if (!store.isQendra()) {
    store.ORG.groups = [];
    store.ORG.sel = null;
    return orgWrapHtml(roots);
  }

  store.ORG.groups = roots
    .filter(r => r.role === 'koordinator')
    .map(c => ({ id: c.id, label: c.full_name || c.volunteer_code, roots: [c] }));

  const loose = roots.filter(r => r.role !== 'koordinator');
  if (loose.length) {
    store.ORG.groups.push({ id: '__loose', label: 'Pa koordinator', roots: loose });
  }

  if (!store.ORG.groups.length) return '<div class="empty">Ende pa koordinatorë në strukturë.</div>';
  if (!store.ORG.groups.some(g => g.id === store.ORG.sel)) store.ORG.sel = null;

  return structuraBody();
}

export function structuraBody(): string {
  const sel = store.ORG.groups.find(g => g.id === store.ORG.sel);
  return `
    <div class="row" style="gap:8px" id="org_buttons">
      ${store.ORG.groups.map(g => {
        const on = g.id === store.ORG.sel;
        const total = g.roots.reduce((a, r) => a + orgCount(r, store.ORG.kidsOf), 0);
        return `<button class="btn ${on ? '' : 'sec'} sm" data-org-id="${g.id}">
          ${esc(truncate(g.label, 26))}
          <span class="pill ${on ? 'blue' : 'gray'}">${total}</span>
        </button>`;
      }).join('')}
    </div>
    ${sel
      ? orgWrapHtml(sel.roots)
      : `<div class="hint" style="margin-top:12px">Zgjidhni një koordinator për të parë strukturën e tij: mbledhësit e autorizuar dhe ndihmësit nën secilin prej tyre.</div>`}`;
}

export function pickOrg(id: string): void {
  store.ORG.sel = store.ORG.sel === id ? null : id;
  const box = document.getElementById('org_box');
  if (box) box.innerHTML = structuraBody();
}
