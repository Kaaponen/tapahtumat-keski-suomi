import { addDays, dayKey, lastDayKey } from '../../shared/time';
import type { Event } from '../../shared/types';
import { mainVenue } from '../../shared/venue';
import { weekday } from './format';

export type Range = 'all' | 'today' | 'weekend' | 'week' | 'custom';
const RANGES: Range[] = ['all', 'today', 'weekend', 'week', 'custom'];

export interface Filters {
  range: Range;
  from?: string;
  to?: string;
  category?: string;
  venue?: string;
  q?: string;
  starred?: '1';
}

const KEYS = ['from', 'to', 'category', 'venue', 'q'] as const;

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  const range = p.get('range') as Range | null;
  const f: Filters = { range: range && RANGES.includes(range) ? range : 'all' };
  for (const k of KEYS) {
    const v = p.get(k);
    if (v) f[k] = v;
  }
  if (p.get('starred') === '1') f.starred = '1';
  return f;
}

export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.range !== 'all') p.set('range', f.range);
  for (const k of KEYS) if (f[k]) p.set(k, f[k]!);
  if (f.starred) p.set('starred', '1');
  return p.toString();
}

const FILTER_PARAMS = ['range', 'starred', ...KEYS];

/** Päivittää vain suodatinavaimet; muut kyselyparametrit (esim. kirjautumisen `code`) säilyvät. Palauttaa ilman "?"-merkkiä. */
export function mergeFilterSearch(currentSearch: string, f: Filters): string {
  const p = new URLSearchParams(currentSearch);
  for (const k of FILTER_PARAMS) p.delete(k);
  for (const [k, v] of new URLSearchParams(filtersToSearch(f))) p.set(k, v);
  return p.toString();
}

export function rangeBounds(f: Filters, today: string): [string, string] | null {
  switch (f.range) {
    case 'today':
      return [today, today];
    case 'week':
      return [today, addDays(today, 6)];
    case 'weekend': {
      const dow = weekday(today);
      if (dow === 0) return [today, today];
      if (dow === 6) return [today, addDays(today, 1)];
      const friday = addDays(today, 5 - dow);
      return [friday, addDays(friday, 2)];
    }
    case 'custom':
      return [f.from ?? today, f.to ?? '9999-12-31'];
    default:
      return null;
  }
}

export { mainVenue };

export function applyFilters(events: Event[], f: Filters, today: string, stars?: Set<string>): Event[] {
  const bounds = rangeBounds(f, today);
  const q = f.q?.trim().toLowerCase();
  return events.filter((e) => {
    const first = dayKey(e.start);
    const last = lastDayKey(e);
    if (last < today) return false;
    if (bounds && (last < bounds[0] || first > bounds[1])) return false;
    if (f.starred && !stars?.has(e.id)) return false;
    if (f.category && !e.categories.includes(f.category)) return false;
    if (f.venue && mainVenue(e.venue) !== f.venue) return false;
    if (q && ![e.title, e.venue, e.description].some((s) => s?.toLowerCase().includes(q))) return false;
    return true;
  });
}
