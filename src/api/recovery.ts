/**
 * Njohja e lidhjes së rivendosjes së fjalëkalimit.
 *
 * Portali duhet të njohë DY forma lidhjeje, sepse të dyja qarkullojnë:
 *
 *   1. `#token_hash=…&type=recovery`
 *      Lidhja jonë, e ndërtuar te `functions/api/reset-password.js`. Tokeni
 *      shkëmbehet me `verifyOtp()` nga shfletuesi.
 *
 *   2. `#access_token=…&type=recovery`
 *      Forma e vjetër, kur mesazhin e dërgon vetë Supabase-i (p.sh. nga paneli
 *      i tij). Aty sesionin e ka vendosur `detectSessionInUrl` përpara nesh.
 *
 * Të dyja lexohen edhe nga query-ja, jo vetëm nga fragmenti: disa klientë
 * email-i e rishkruajnë URL-në dhe fragmenti humbet rrugës.
 *
 * `parseRecoveryParams()` mban vetëm vargje — pa `window`, pa `location` —
 * që rregulli të jetë i testueshëm pa shfletues.
 */

export interface RecoveryParams {
  /** Tokeni i lidhjes sonë; shkëmbehet me `verifyOtp()`. */
  tokenHash: string | null;
  /** Lidhje rivendosjeje e formës së vjetër — sesioni vjen nga vetë URL-ja. */
  isLegacyRecovery: boolean;
}

export function parseRecoveryParams(hash: string, search: string): RecoveryParams {
  const fromHash = new URLSearchParams((hash || '').replace(/^#/, ''));
  const fromQuery = new URLSearchParams(search || '');

  const type = fromHash.get('type') || fromQuery.get('type');
  if (type !== 'recovery') {
    return { tokenHash: null, isLegacyRecovery: false };
  }

  const tokenHash = fromHash.get('token_hash') || fromQuery.get('token_hash');
  if (tokenHash) {
    return { tokenHash, isLegacyRecovery: false };
  }

  return { tokenHash: null, isLegacyRecovery: true };
}

/** Njësoj si më sipër, por e lexon URL-në e faqes. */
export function readRecoveryParams(): RecoveryParams {
  if (typeof window === 'undefined') return { tokenHash: null, isLegacyRecovery: false };
  return parseRecoveryParams(window.location.hash, window.location.search);
}

/**
 * Heq gjurmët e rivendosjes nga shiriti i adresës.
 *
 * Pa këtë, një rifreskim i thjeshtë e rihap ekranin e fjalëkalimit me një token
 * tashmë të harxhuar — dhe vullnetari lexon një gabim që s'e shkaktoi ai.
 * `replaceState` dhe jo `pushState`: butoni «prapa» nuk duhet ta kthejë atje.
 */
export function clearRecoveryParams(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;

  const url = new URL(window.location.href);
  for (const key of ['token_hash', 'type', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type']) {
    url.searchParams.delete(key);
  }
  url.hash = '';

  window.history.replaceState({}, document.title, url.pathname + url.search);
}
