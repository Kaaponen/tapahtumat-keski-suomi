import { dayKey } from '../../shared/time';
import type { Event } from '../../shared/types';
import { dayLabel } from './format';

export interface ListItem {
  event: Event;
  series: Event[];
}

export interface DayGroup {
  day: string;
  label: string;
  /** Tapahtumat, jotka alkavat tänä päivänä. */
  items: ListItem[];
  /** Aiemmin alkaneet, edelleen käynnissä olevat (vain ensimmäisessä ryhmässä). */
  ongoing: ListItem[];
}

const seriesKey = (e: Event) =>
  `${e.title.trim().toLowerCase()}|${(e.venue ?? e.address ?? e.city ?? '').trim().toLowerCase()}`;

/** `from`: listan ensimmäinen päivä (aikarajauksen alku); sitä ennen alkaneet ovat sen päivän käynnissä olevia. */
export function buildDayGroups(events: Event[], today: string, from = today): DayGroup[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const seriesByKey = new Map<string, ListItem>();
  const byDay = new Map<string, { items: ListItem[]; ongoing: ListItem[] }>();

  for (const e of sorted) {
    const key = seriesKey(e);
    const existing = seriesByKey.get(key);
    if (existing) {
      existing.series.push(e);
      continue;
    }
    const item: ListItem = { event: e, series: [e] };
    seriesByKey.set(key, item);
    const start = dayKey(e.start);
    const day = start < from ? from : start;
    if (!byDay.has(day)) byDay.set(day, { items: [], ongoing: [] });
    byDay.get(day)![start < from ? 'ongoing' : 'items'].push(item);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { items, ongoing }]) => ({ day, label: dayLabel(day, today), items, ongoing }));
}

export function limitGroups(groups: DayGroup[], limit: number): { groups: DayGroup[]; hasMore: boolean } {
  const out: DayGroup[] = [];
  let left = limit;
  for (const g of groups) {
    if (left <= 0) return { groups: out, hasMore: true };
    out.push({ ...g, items: g.items.slice(0, left) });
    if (g.items.length > left) return { groups: out, hasMore: true };
    left -= g.items.length;
  }
  return { groups: out, hasMore: false };
}
