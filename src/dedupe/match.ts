import type { Normalized } from './normalize';

const SIMILARITY_THRESHOLD = 0.85;
const MAX_TIME_DIFF_MIN = 90;
const MIN_CONTAINED_LENGTH = 4;

function dice<T>(a: T[], b: T[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<T, number>();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  let overlap = 0;
  for (const x of b) {
    const c = counts.get(x) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(x, c - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

export function titleSimilarity(a: string, b: string): number {
  return Math.max(dice(a.split(' '), b.split(' ')), dice(bigrams(a), bigrams(b)));
}

function containsWhole(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_CONTAINED_LENGTH && ` ${long} `.includes(` ${short} `);
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function venueCompatible(a: Normalized, b: Normalized): boolean {
  return !a.vKey || !b.vKey || a.vKey === b.vKey;
}

/** Kadun nimi osoitteen alusta ("Hannikaisenkatu 39, Jyväskylä" -> "hannikaisenkatu"). */
function streetOf(address?: string): string | undefined {
  const m = address?.toLowerCase().match(/^\s*([\p{L}-]+)/u);
  return m?.[1];
}

/** Osoitteet ristiriidassa vain, kun paikkaa ei voitu tunnistaa kummastakin saman paikan avaimella. */
function addressCompatible(a: Normalized, b: Normalized): boolean {
  if (a.vKey && a.vKey === b.vKey) return true;
  const sa = streetOf(a.address);
  const sb = streetOf(b.address);
  return !sa || !sb || sa === sb;
}

function timeCompatible(a: Normalized, b: Normalized): boolean {
  return !a.time || !b.time || Math.abs(minutes(a.time) - minutes(b.time)) <= MAX_TIME_DIFF_MIN;
}

export function isSameEvent(a: Normalized, b: Normalized): boolean {
  if (!a.nTitle || !b.nTitle) return false;
  if (a.day !== b.day || !venueCompatible(a, b) || !addressCompatible(a, b) || !timeCompatible(a, b)) return false;
  return titleSimilarity(a.nTitle, b.nTitle) >= SIMILARITY_THRESHOLD || containsWhole(a.nTitle, b.nTitle);
}

/**
 * Ryhmittelee tuplat. Kellonajalliset käsitellään ensin, ja tapahtuma liitetään vain ryhmään,
 * jonka kaikki jäsenet sopivat siihen paikan ja kellonajan osalta.
 */
export function groupDuplicates(events: Normalized[]): Normalized[][] {
  const ordered = [...events].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (!!a.time !== !!b.time) return a.time ? -1 : 1;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });
  const groups: Normalized[][] = [];
  for (const e of ordered) {
    const target = groups.find(
      (g) =>
        g[0].day === e.day &&
        g.every((m) => venueCompatible(m, e) && addressCompatible(m, e) && timeCompatible(m, e)) &&
        g.some((m) => isSameEvent(m, e)),
    );
    if (target) target.push(e);
    else groups.push([e]);
  }
  return groups;
}
