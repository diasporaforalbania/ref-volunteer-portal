export const MONTHS_S = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'kor', 'gus', 'sht', 'tet', 'nën', 'dhj'];
export const MONTHS_L = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'
];

export const p2 = (n: number | string): string => String(n).padStart(2, '0');

export const nf = (n: number | string | null | undefined): string =>
  (Number(n) || 0).toLocaleString('sq-AL');

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

const zonedParts = (ts: string | number | Date, timeZone: string): ZonedParts => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts));
  const get = (type: string): number => Number(parts.find(p => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
};

export const fmtDate = (ts: string | number | Date | null | undefined, timeZone?: string): string => {
  if (!ts) return '—';
  if (timeZone) {
    const p = zonedParts(ts, timeZone);
    return `${p.day} ${MONTHS_S[p.month - 1]} ${p.year}`;
  }
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateTime = (ts: string | number | Date | null | undefined): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export const fmtTime = (ts: string | number | Date | null | undefined, timeZone?: string): string => {
  if (!ts) return '—';
  if (timeZone) {
    const p = zonedParts(ts, timeZone);
    return `${p2(p.hour)}:${p2(p.minute)}`;
  }
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

export const toZonedInput = (ts: string | number | Date, timeZone: string): { date: string; time: string } => {
  const p = zonedParts(ts, timeZone);
  return {
    date: `${p.year}-${p2(p.month)}-${p2(p.day)}`,
    time: `${p2(p.hour)}:${p2(p.minute)}`,
  };
};

/** Convert a wall-clock date/time in an IANA zone into an absolute ISO instant. */
export const zonedDateTimeToIso = (date: string, time: string, timeZone: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !clock) return null;

  const wanted = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(clock[1]), minute: Number(clock[2]),
  };
  const wantedMs = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  let instant = wantedMs;

  try {
    for (let i = 0; i < 3; i += 1) {
      const actual = zonedParts(instant, timeZone);
      const actualMs = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
      instant += wantedMs - actualMs;
    }
    const actual = zonedParts(instant, timeZone);
    if (Object.keys(wanted).some(k => actual[k as keyof ZonedParts] !== wanted[k as keyof ZonedParts])) return null;
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
};
