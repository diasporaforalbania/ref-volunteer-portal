import { sb, DEFAULT_GOAL } from '../api/client';
import { clearRecoveryParams } from '../api/recovery';
import { store, ROLE_DESC, ROLES, SIGNUP_ROLES } from '../state/store';
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
        ${SIGNUP_ROLES.map(k => `<option value="${k}">${esc(ROLES[k])}</option>`).join('')}
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
  const picked = (roleSelect?.value || '') as Exclude<VolunteerRole, 'admin'>;
  const requested_role = SIGNUP_ROLES.includes(picked) ? picked : 'ndihmes';
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

/**
 * Shkaqet e dështimit, secili me mesazhin e vet.
 *
 * Njësoj si te dërgimi i njoftimeve: një «provoni sërish» i vetëm për çdo
 * dështim e fsheh pikërisht atë që e zgjidh problemin. Këtu shumica e shkaqeve
 * kërkojnë veprim nga qendra, jo nga vullnetari — ndaj mesazhi duhet t'i thotë
 * vullnetarit se ku ta çojë fjalën.
 */
const RESET_ERRORS: Record<string, string> = {
  invalid_email: 'Adresa e email-it nuk duket e saktë. Kontrollojeni dhe provoni sërish.',
  rate_limited: 'U kërkua shumë shpesh për këtë adresë. Prisni një minutë dhe provoni sërish.',
  server_misconfigured: 'Shërbimi i rivendosjes nuk është konfiguruar te serveri. Njoftoni qendrën.',
  email_not_configured: 'Dërguesi i email-it nuk është konfiguruar ende te serveri. Njoftoni qendrën.',
  email_send_failed: 'Email-i nuk u nis dot nga serveri. Njoftoni qendrën.',
  upstream_unreachable: 'Serveri nuk komunikoi dot me Supabase-in. Provoni pas pak.',
  upstream_unexpected: 'Supabase-i ktheu një përgjigje të papritur. Njoftoni qendrën.',
  forbidden_origin: 'Kërkesa u refuzua nga serveri (origjinë e panjohur). Njoftoni qendrën.',
};

export async function doReset(): Promise<void> {
  const emailInput = document.getElementById('a_email') as HTMLInputElement | null;
  const email = (emailInput?.value || '').trim();
  if (!email) {
    emailInput?.focus();
    return fail('Shkruani email-in më sipër, pastaj klikoni sërish.');
  }

  const link = document.getElementById('btn_forgot_pass');
  const previousText = link?.textContent || 'Harrova fjalëkalimin';
  if (link) {
    link.textContent = 'Po dërgohet…';
    link.setAttribute('aria-busy', 'true');
  }

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // Te `npm run dev` faqja shërbehet nga Vite dhe Worker-i nuk ndërhyn fare,
    // ndaj `/api/reset-password` kthen guaskën HTML të SPA-së me status 200.
    // Pa këtë kontroll, `res.json()` hidhet dhe dështimi duket si defekt rrjeti.
    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      return fail(
        res.ok
          ? 'Endpointi /api/reset-password nuk u gjet. Për ta provuar lokalisht përdorni `npm run pages:dev`.'
          : `Serveri ktheu ${res.status}.`
      );
    }

    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!res.ok) {
      const code = data?.error || '';
      return fail(RESET_ERRORS[code] || `Rivendosja dështoi (${code || res.status}).`);
    }

    // Përgjigja është e njëjtë edhe kur adresa nuk i përket asnjë llogarie —
    // me qëllim, që endpointi të mos tregojë se cilat adresa janë regjistruar.
    // Prandaj mesazhi thotë «nëse … është e regjistruar», dhe jo «u dërgua».
    toast('Nëse kjo adresë është e regjistruar, brenda pak minutash ju vjen email-i me lidhjen.');
  } catch (err) {
    console.error('[auth] kërkesa e rivendosjes dështoi:', err);
    fail('Kërkesa nuk doli dot nga pajisja. Kontrolloni lidhjen dhe provoni sërish.');
  } finally {
    if (link) {
      link.textContent = previousText;
      link.removeAttribute('aria-busy');
    }
  }
}

/**
 * Ekran pritjeje sa kohë shkëmbehet tokeni i lidhjes.
 *
 * `verifyOtp()` është një kërkesë rrjeti mbi një faqe ende bosh. Pa këtë,
 * vullnetari që hap email-in shikon të bardhën dhe mendon se lidhja s'punoi.
 */
export function renderRecoveryPending(): void {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `<div class="auth-wrap"><div class="auth" style="text-align:center">
    <h1>Po verifikohet lidhja…</h1>
    <p class="sub">Një çast — po hapim formën e fjalëkalimit të ri.</p>
  </div></div>`;
}

/**
 * Lidhja nuk vlen më: e skaduar, e përdorur, ose e hapur dy herë.
 *
 * Ekran më vete dhe jo një njoftim kalimtar mbi ekranin e hyrjes — vullnetari
 * këtu ka ardhur nga email-i dhe pret të vendosë fjalëkalimin; duhet t'i themi
 * qartë pse s'po ndodh dhe si të vazhdojë.
 */
export function renderRecoveryProblem(detail?: string): void {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `<div class="auth-wrap"><div class="auth" style="text-align:center">
    <div style="font-size:44px;line-height:1">⏱️</div>
    <h1 style="margin-top:8px">Lidhja nuk vlen më</h1>
    <p class="sub">Lidhjet e rivendosjes skadojnë për një orë dhe hapen vetëm një herë.
      Kërkoni një lidhje të re — kjo e vjetra nuk prek gjë.</p>
    ${detail ? `<p class="hint">${esc(detail)}</p>` : ''}
    <button class="btn wide" id="rec_back">Kërko lidhje të re</button>
  </div></div>`;

  document.getElementById('rec_back')?.addEventListener('click', () => {
    clearRecoveryParams();
    renderAuth('login');
  });
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

    if (error) {
      if (btn) btn.disabled = false;
      // «Auth session missing» do të thotë që lidhja u konsumua ose skadoi —
      // gjë që s'ka lidhje me fjalëkalimin që sapo u shkrua, ndaj mesazhi i
      // papërkthyer i Supabase-it këtu vetëm ngatërron.
      const expired = /session|expired|invalid/i.test(error.message || '');
      return fail(
        expired
          ? 'Lidhja ka skaduar ose është përdorur njëherë. Kërkoni një lidhje të re nga «Harrova fjalëkalimin».'
          : error.message
      );
    }

    // KUJDES: pa këtë rresht, vullnetari e ndërron fjalëkalimin me sukses dhe
    // menjëherë hidhet te ekrani i hyrjes. `loadUserAndStats()` niset nga
    // `store.SESSION`, dhe në rrjedhën e rivendosjes atë s'e mbush kush —
    // `boot()` kthehet para se ta lexojë sesionin.
    const { data: sessionData } = await sb.auth.getSession();
    store.SESSION = sessionData.session;

    // URL-ja ende mban tokenin e rivendosjes. Po e rifreskoi faqen vullnetari,
    // ai token tashmë i harxhuar do ta çonte sërish te ky ekran, me një gabim
    // që nuk e shkakton ai.
    clearRecoveryParams();

    if (btn) btn.disabled = false;
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
