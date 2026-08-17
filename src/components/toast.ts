export function toast(msg: string, isErr = false): void {
  const container = document.getElementById('toast');
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
