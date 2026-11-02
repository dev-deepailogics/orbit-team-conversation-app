// Calendar dates are plain 'YYYY-MM-DD' strings (UTC midnight on the server), so no timezone shifts.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toYmd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function todayYmd(now = new Date()): string {
  return toYmd(now.getFullYear(), now.getMonth(), now.getDate());
}

// Rows of 7; null pads the days outside the month. `month` is 0-based.
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const t = year * 12 + month + delta;
  return { year: Math.floor(t / 12), month: ((t % 12) + 12) % 12 };
}

export function parseYmd(v: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? { year: +m[1], month: +m[2] - 1, day: +m[3] } : null;
}

export function formatYmd(v: string): string {
  const p = parseYmd(v);
  return p ? `${MONTHS[p.month].slice(0, 3)} ${p.day}, ${p.year}` : '';
}
