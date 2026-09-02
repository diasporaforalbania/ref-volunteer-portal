import { store, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { avatarHtml } from '../api/storage';
import { doLogout } from '../views/auth';
import { toast, fail } from '../components/toast';
import { pushState, pushStateMessage, enablePush, disablePush } from '../api/push';
import { siteSwitcherHtml } from './siteSwitcher';
import { openFeedbackModal } from './feedbackModal';

export function renderHeader(): string {
  if (!store.ME) return '';
  const email = store.SESSION?.user?.email || '';
  const unitName = store.ME.units ? ' · ' + esc(store.ME.units.name) : '';
  const roleName = esc(ROLES[store.ME.role] || store.ME.role);

  return `
  <header class="app"><div class="h-row">
    <div class="brand"><h1>Referendumi</h1><span class="tag">Portali i vullnetarëve</span></div>
    ${siteSwitcherHtml()}
    <div class="who">
      ${avatarHtml(store.ME.photo_path, store.ME.full_name, 'av')}
      <div><div class="nm">${esc(store.ME.full_name || email)}</div>
           <div class="rl">${roleName}${unitName}</div></div>
      <button class="btn ghost sm" id="btn_feedback"
              style="color:#fff;border:1px solid rgba(255,255,255,.5)"
              title="Sugjero një ide ose raporto">💡 Ide</button>
      <button class="btn ghost sm push-toggle" id="btn_push"
              style="color:#fff;border:1px solid rgba(255,255,255,.5)"
              aria-pressed="false" title="Njoftimet">🔕</button>
      <button class="btn ghost sm" style="color:#fff;border:1px solid rgba(255,255,255,.5)" id="btn_logout">Dil</button>
    </div>
  </div></header>`;
}

/**
 * Çelësi i njoftimeve te koka e faqes — i pranishëm në çdo skedë, që vullnetari
 * të mos e kërkojë nëpër faqe. Nuk çaktivizohet kurrë: nëse njoftimet s'mund të
 * ndizen, prekja e tij shpjegon pse, sepse një buton i vdekur në telefon duket
 * thjesht i prishur.
 */
export async function refreshPushButton(): Promise<void> {
  const btn = document.getElementById('btn_push') as HTMLButtonElement | null;
  if (!btn) return;

  const state = await pushState();
  const on = state === 'on';
  const ready = state === 'on' || state === 'off';

  btn.textContent = on ? '🔔' : '🔕';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = pushStateMessage(state, store.isAdmin());
  btn.dataset.state = state;
  // Të padisponueshmet zbehen, por mbeten të prekshme për të dhënë arsyen.
  btn.style.opacity = ready ? '1' : '.55';
}

async function togglePush(): Promise<void> {
  const btn = document.getElementById('btn_push') as HTMLButtonElement | null;
  if (!btn) return;
  const state = btn.dataset.state as string | undefined;

  if (state !== 'on' && state !== 'off') {
    // 'blocked', 'needs-install', 'unsupported', 'not-configured'
    return fail(pushStateMessage((state || 'unsupported') as never, store.isAdmin()));
  }

  btn.disabled = true;
  try {
    if (state === 'on') {
      const res = await disablePush();
      if (!res.ok) return fail(res.reason || 'Njoftimet nuk u çaktivizuan.');
      toast('Njoftimet u fikën në këtë pajisje.');
    } else {
      const res = await enablePush();
      if (!res.ok) return fail(res.reason || 'Njoftimet nuk u aktivizuan.');
      toast('Njoftimet u ndezën në këtë pajisje.');
    }
  } finally {
    btn.disabled = false;
    await refreshPushButton();
    // Karta te faqja kryesore tregon të njëjtën gjendje — mbaji të njëjtat.
    window.dispatchEvent(new CustomEvent('push:changed'));
  }
}

export function attachHeaderEvents(): void {
  document.getElementById('btn_logout')?.addEventListener('click', doLogout);
  document.getElementById('btn_push')?.addEventListener('click', togglePush);
  document.getElementById('btn_feedback')?.addEventListener('click', openFeedbackModal);
  refreshPushButton();
}

// Ndezja/fikja mund të vijë edhe nga karta te faqja kryesore — çelësi këtu
// duhet ta pasqyrojë menjëherë, ndryshe mbetet me ikonën e vjetër.
window.addEventListener('push:changed', () => { refreshPushButton(); });
