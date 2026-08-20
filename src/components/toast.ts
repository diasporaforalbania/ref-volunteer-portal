/**
 * Kutia e njoftimeve, e mbajtur nga vetë ky modul te `document.body`.
 *
 * Më parë `<div id="toast">` jetonte vetëm brenda `renderShell()`, pra vetëm
 * pasi vullnetari kishte hyrë. Te ekrani i hyrjes kontejneri nuk ekzistonte
 * fare dhe `toast()` kthehej pa bërë gjë — ndaj ATY BINTE ÇDO MESAZH: «Email
 * ose fjalëkalim i gabuar», «Fjalëkalimi duhet të ketë të paktën 8 karaktere»,
 * dhe i gjithë reagimi i rivendosjes së fjalëkalimit. Vullnetari klikonte dhe
 * nuk shihte asgjë.
 *
 * Te `body` dhe jo te `#root`: pamjet e rishkruajnë `#root.innerHTML`, dhe një
 * kontejner që e fshin rirenderimi është pikërisht problemi që u rregullua.
 * CSS-ja e ka `position: fixed`, ndaj vendi në DOM nuk e prek pamjen.
 */
function toastContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById('toast');
  if (existing) return existing;

  if (!document.body) return null;
  const created = document.createElement('div');
  created.id = 'toast';
  document.body.appendChild(created);
  return created;
}

export function toast(msg: string, isErr = false): void {
  const container = toastContainer();
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), isErr ? 5200 : 3200);
}

export function fail(e: unknown): void {
  const msg = typeof e === 'string'
    ? e
    : (e as { message?: string })?.message || 'Ndodhi një gabim.';
  toast(msg, true);
}
