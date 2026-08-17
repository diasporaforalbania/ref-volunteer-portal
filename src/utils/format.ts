export const MONTHS_S = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gus', 'sht', 'tet', 'nën', 'dhj'];
export const MONTHS_L = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'
];

export const p2 = (n: number | string): string => String(n).padStart(2, '0');

export const nf = (n: number | string | null | undefined): string =>
  (Number(n) || 0).toLocaleString('sq-AL');

export const fmtDate = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateTime = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export const fmtTime = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export const ago = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '—';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'tani';
  if (s < 3600) return `${Math.floor(s / 60)} min më parë`;
  if (s < 86400) return `${Math.floor(s / 3600)} orë më parë`;
  return `${Math.floor(s / 86400)} ditë më parë`;
};

export const dur = (from: string | number | Date, to?: string | number | Date | null): string => {
  const ms = (to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return m > 0 ? `${h} orë e ${m} min` : `${h} orë`;
  return `${m} min`;
};

export const fmtSize = (b: number | null | undefined): string => {
  const bytes = b || 0;
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
};

export const daysLeft = (d: string | null | undefined): number | null => {
  if (!d) return null;
  return Math.ceil((new Date(`${d}T23:59:59`).getTime() - Date.now()) / 86400000);
};

export const localDay = (ts: string | number | Date): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

export const toLocalInput = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '';
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
