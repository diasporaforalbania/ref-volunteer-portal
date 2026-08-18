import { sb, DEFAULT_GOAL } from '../api/client';
import { store, ROLE_DESC, ROLES } from '../state/store';
import { esc } from '../utils/security';
import { nf } from '../utils/format';
import { toast, fail } from '../components/toast';
import type { VolunteerRole } from '../types/database';

/**
 * Returns the appropriate auth redirect URL.
 * In production / deployed mode: strictly points to https://portal.referendum21.org/
 * In local development: points to local origin (e.g. http://localhost:5173/)
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/`;
    }
  }
  return 'https://portal.referendum21.org/';
}

export function renderAuth(mode: 'login' | 'signup'): void {
  const root = document.getElementById('root');
  if (!root) return;

  const roleDescKeys = Object.keys(ROLE_DESC) as Array<Exclude<VolunteerRole, 'admin'>>;

  root.innerHTML = `
  <div class="auth-wrap"><div class="auth">
    <h1>Referendumi</h1>
    <p class="sub">Portali i vullnetarëve · mbledhja e ${nf(DEFAULT_GOAL)} nënshkrimeve</p>

    <div class="switcher">
      <button class="${mode === 'login' ? 'on' : ''}" id="btn_switch_login">Hyr</button>
      <button class="${mode === 'signup' ? 'on' : ''}" id="btn_switch_signup">Regjistrohu</button>
    </div>

    ${mode === 'signup' ? `
      <label>Emri dhe mbiemri *</label>
      <input id="a_name" type="text" autocomplete="name" placeholder="Emri juaj i plotë">
      <label>Qyteti / zona *</label>
      <input id="a_city" type="text" autocomplete="address-level2" placeholder="p.sh. Tiranë">
      <label>Telefoni</label>
      <input id="a_phone" type="tel" autocomplete="tel" placeholder="+355 …">
      <label>Cilin rol do të kontribuosh? *</label>
      <select id="a_role">
        ${roleDescKeys.map(k => `<option value="${k}">${esc(ROLES[k])}</option>`).join('')}
      </select>
      <p class="hint" id="a_role_hint">${esc(ROLE_DESC.ndihmes)}</p>
      <p class="hint">Kjo është vetëm preferenca juaj — qendra e konfirmon rolin final kur ju miraton.</p>
    ` : ''}

    <label>Email *</label>
    <input id="a_email" type="email" autocomplete="email" placeholder="ju@shembull.com">
    <label>Fjalëkalimi *</label>
    <input id="a_pass" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"
           placeholder="${mode === 'signup' ? 'të paktën 8 karaktere' : ''}">

    <div style="margin-top:16px">
      <button class="btn wide" id="a_btn">
        ${mode === 'signup' ? 'Krijo llogarinë' : 'Hyr në portal'}</button>
    </div>

    ${mode === 'login' ? `
      <div style="margin-top:12px;text-align:center">
        <a class="link" id="btn_forgot_pass">Harrova fjalëkalimin</a>
      </div>` : `
      <p class="hint" style="margin-top:12px">Llogaria juaj shqyrtohet nga qendra para se të aktivizohet.
        Kjo mbron fushatën — çdo vullnetar duhet të njihet nga koordinatori i tij.</p>`}
  </div></div>`;

  document.getElementById('btn_switch_login')?.addEventListener('click', () => renderAuth('login'));
  document.getElementById('btn_switch_signup')?.addEventListener('click', () => renderAuth('signup'));
  document.getElementById('btn_forgot_pass')?.addEventListener('click', doReset);

  const aRole = document.getElementById('a_role') as HTMLSelectElement | null;
  aRole?.addEventListener('change', () => {
    const hint = document.getElementById('a_role_hint');
    if (hint) hint.textContent = ROLE_DESC[aRole.value as Exclude<VolunteerRole, 'admin'>] || '';
  });

  const aPass = document.getElementById('a_pass');
  aPass?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'signup') doSignup();
      else doLogin();
    }
  });

  document.getElementById('a_btn')?.addEventListener('click', () => {
    if (mode === 'signup') doSignup();
    else doLogin();
  });
}

export async function doLogin(): Promise<void> {
  const emailInput = document.getElementById('a_email') as HTMLInputElement | null;
  const passInput = document.getElementById('a_pass') as HTMLInputElement | null;
  const btn = document.getElementById('a_btn') as HTMLButtonElement | null;

  const email = (emailInput?.value || '').trim();
  const password = passInput?.value || '';

  if (!email || !password) return fail('Plotësoni email-in dhe fjalëkalimin.');
  if (btn) btn.disabled = true;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (btn) btn.disabled = false;

  if (error) {
    return fail(error.message === 'Invalid login credentials' ? 'Email ose fjalëkalim i gabuar.' : error.message);
  }
  store.SESSION = data.session;
  window.dispatchEvent(new CustomEvent('app:authenticated'));
}

export async function doSignup(): Promise<void> {
  const nameInput = document.getElementById('a_name') as HTMLInputElement | null;
  const cityInput = document.getElementById('a_city') as HTMLInputElement | null;
  const phoneInput = document.getElementById('a_phone') as HTMLInputElement | null;
  const roleSelect = document.getElementById('a_role') as HTMLSelectElement | null;
  const emailInput = document.getElementById('a_email') as HTMLInputElement | null;
  const passInput = document.getElementById('a_pass') as HTMLInputElement | null;
  const btn = document.getElementById('a_btn') as HTMLButtonElement | null;

  const full_name = (nameInput?.value || '').trim();
  const city = (cityInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();
  const requested_role = roleSelect?.value || 'ndihmes';
  const email = (emailInput?.value || '').trim();
  const password = passInput?.value || '';

  if (!full_name) return fail('Shkruani emrin dhe mbiemrin.');
  if (!city) return fail('Shkruani qytetin ose zonën ku do të kontribuoni.');
  if (!email || !password) return fail('Plotësoni email-in dhe fjalëkalimin.');
  if (password.length < 8) return fail('Fjalëkalimi duhet të ketë të paktën 8 karaktere.');

  if (btn) btn.disabled = true;
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: { full_name, city, phone, requested_role },
    },
  });
  if (btn) btn.disabled = false;

  if (error) return fail(error.message);

  if (!data.session) {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `<div class="auth-wrap"><div class="auth">
        <h1>Kontrolloni email-in</h1>
        <p class="sub">Ju dërguam një link konfirmimi te <b>${esc(email)}</b>. Hapeni, pastaj kthehuni këtu dhe hyni.</p>
        <button class="btn wide" id="btn_back_login">Kthehu te hyrja</button></div></div>`;
      document.getElementById('btn_back_login')?.addEventListener('click', () => renderAuth('login'));
    }
    return;
  }
  store.SESSION = data.session;
  window.dispatchEvent(new CustomEvent('app:authenticated'));
}

export async function doReset(): Promise<void> {
  const emailInput = document.getElementById('a_email') as HTMLInputElement | null;
  const email = (emailInput?.value || '').trim();
  if (!email) return fail('Shkruani email-in më sipër, pastaj klikoni sërish.');

  const redirectTo = getAuthRedirectUrl();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) return fail(error.message || String(error));
  toast('Ju dërguam një email me lidhjen për rivendosjen e fjalëkalimit.');
}

export function renderNewPassword(): void {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
  <div class="auth-wrap"><div class="auth">
    <h1>Fjalëkalim i ri</h1>
    <p class="sub">Vendosni fjalëkalimin tuaj të ri për të vazhduar në portal.</p>

    <label>Fjalëkalimi i ri *</label>
    <input id="np_pass" type="password" placeholder="Të paktën 8 karaktere" autocomplete="new-password">

    <label>Konfirmoni fjalëkalimin *</label>
    <input id="np_pass_confirm" type="password" placeholder="Përsëritni fjalëkalimin" autocomplete="new-password">

    <div style="margin-top:16px">
      <button class="btn wide" id="np_btn">Ruaj fjalëkalimin</button>
    </div>
  </div></div>`;

  const doSave = async () => {
    const passInput = document.getElementById('np_pass') as HTMLInputElement | null;
    const confirmInput = document.getElementById('np_pass_confirm') as HTMLInputElement | null;
    const btn = document.getElementById('np_btn') as HTMLButtonElement | null;

    const pass = passInput?.value || '';
    const confirm = confirmInput?.value || '';

    if (!pass || pass.length < 8) return fail('Fjalëkalimi duhet të ketë të paktën 8 karaktere.');
    if (pass !== confirm) return fail('Fjalëkalimet nuk përputhen.');

    if (btn) btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pass });
    if (btn) btn.disabled = false;

    if (error) return fail(error.message);
    toast('Fjalëkalimi u ndryshua me sukses!');
    window.dispatchEvent(new CustomEvent('app:authenticated'));
  };

  document.getElementById('np_btn')?.addEventListener('click', doSave);
  document.getElementById('np_pass_confirm')?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') doSave();
  });
}

export async function doLogout(): Promise<void> {
  await sb.auth.signOut();
  store.ME = null;
  store.SESSION = null;
  renderAuth('login');
}

export function renderGate(kind: 'pending' | 'suspended' | 'missing'): void {
  const root = document.getElementById('root');
  if (!root) return;

  const box = {
    pending: [
      '⏳',
      'Llogaria juaj është në pritje',
      "Një koordinator duhet t'ju miratojë para se të hyni në portal. Zakonisht brenda 24 orësh. Nëse ngutet, kontaktoni koordinatorin e njësisë suaj.",
    ],
    suspended: ['⛔', 'Llogaria juaj është pezulluar', 'Kontaktoni qendrën ose koordinatorin tuaj për sqarim.'],
    missing: [
      '⚠️',
      'Profili nuk u gjet',
      'Llogaria u krijua, por profili i vullnetarit mungon. Njoftoni qendrën — ka gjasa që skema e bazës së të dhënave nuk është ngarkuar plotësisht.',
    ],
  }[kind];

  root.innerHTML = `<div class="auth-wrap"><div class="auth" style="text-align:center">
    <div style="font-size:44px;line-height:1">${box[0]}</div>
    <h1 style="margin-top:8px">${box[1]}</h1>
    <p class="sub">${box[2]}</p>
    <p class="hint">I lidhur si ${esc(store.SESSION?.user?.email || '')}</p>
    <button class="btn sec wide" id="gate_logout">Dil</button>
  </div></div>`;

  document.getElementById('gate_logout')?.addEventListener('click', doLogout);
}
