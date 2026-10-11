export const TZ = 'Europe/Helsinki';

const pad = (n: number) => String(n).padStart(2, '0');

function offsetFor(date: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')!.value; // "GMT+03:00"
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

/** Helsingin seinäkelloaika -> ISO 8601 oikealla offsetilla. */
export function helsinkiIso(y: number, m: number, d: number, hh = 0, mm = 0): string {
  // Arvioidaan UTC-hetki (Helsinki on +2/+3), jotta offset valitaan oikealta puolelta kesäajan vaihdetta.
  const approx = new Date(Date.UTC(y, m - 1, d, hh, mm) - 2 * 3600_000);
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${offsetFor(approx)}`;
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Paikallinen päivä (YYYY-MM-DD) Helsingin ajassa. */
export function dayKey(iso: string): string {
  if (isDateOnly(iso)) return iso;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

/** Kellonaika "HH:MM" Helsingin ajassa, null jos pelkkä päivämäärä. */
export function localTime(iso: string): string | null {
  if (isDateOnly(iso)) return null;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Viimeinen paikallinen päivä: keskiyöhön (00:00) päättyvä aikatapahtuma kuuluu edelliselle päivälle. */
export function lastDayKey(e: { start: string; end?: string; allDay?: boolean }): string {
  const first = dayKey(e.start);
  if (!e.end) return first;
  if (e.allDay || isDateOnly(e.end)) return dayKey(e.end);
  const last = dayKey(new Date(Date.parse(e.end) - 1).toISOString());
  return last < first ? first : last;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function parseFinnishDate(s: string): { y: number; m: number; d: number } | null {
  const match = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  return { y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) };
}

/** Kaksi ensimmäistä kellonaikaa vapaasta tekstistä ("Ovet 19.30", "18 - 20"). */
export function parseTimes(s: string): { start?: [number, number]; end?: [number, number] } {
  const found: [number, number][] = [];
  for (const m of s.matchAll(/\b(\d{1,2})(?:[.:](\d{2}))?\b/g)) {
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h <= 23 && min <= 59) found.push([h, min]);
    if (found.length === 2) break;
  }
  return { start: found[0], end: found[1] };
}

/** "noin 2h 15 min" -> 135 */
export function parseDurationMinutes(s: string): number | undefined {
  const h = s.match(/(\d+)\s*h/i);
  const min = s.match(/(\d+)\s*min/i);
  if (!h && !min) return undefined;
  return (h ? Number(h[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
}
