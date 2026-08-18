export const esc = (s: unknown): string =>
  (s == null ? '' : String(s)).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );

export const truncate = (s: unknown, n: number): string => {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
};

export const newId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const safeUrl = (url: unknown): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Allow relative URLs, http, and https only (blocks javascript:, data:, vbscript:)
  if (/^(?:https?:|\/|\.\/|\.\.\/)/i.test(trimmed)) {
    return trimmed;
  }
  return null;
};
