import { createHash } from 'node:crypto';
import type { Event, RawEvent, SourceLink } from '../shared/types';
import { categorize } from './categories';
import { groupDuplicates } from './match';
import { normalizeEvent, type Normalized } from './normalize';

/** Tapahtumapaikkojen omat sivut ensin, kokoavat kalenterit viimeisenä. */
export const SOURCE_PRIORITY = ['paviljonki', 'peurunka', 'keikkalista', 'keskisuomievents'];

const rank = (source: string) => {
  const i = SOURCE_PRIORITY.indexOf(source);
  return i === -1 ? SOURCE_PRIORITY.length : i;
};

export function stableId(e: Normalized): string {
  return createHash('sha1')
    .update(`${e.nTitle}|${e.day}|${e.time ?? ''}|${e.vKey ?? ''}`)
    .digest('hex')
    .slice(0, 12);
}

export function mergeGroup(group: Normalized[]): Event {
  const sorted = [...group].sort((a, b) => rank(a.source) - rank(b.source));
  const primary = sorted[0];
  const timing = sorted.find((e) => e.time !== null) ?? primary;
  const pick = <K extends 'venue' | 'address' | 'city' | 'ticketUrl' | 'image'>(key: K) =>
    sorted.find((e) => e[key])?.[key];
  const description = sorted
    .map((e) => e.description)
    .filter((d): d is string => !!d)
    .sort((a, b) => b.length - a.length)[0];

  const sources: SourceLink[] = [];
  for (const e of sorted) {
    if (!sources.some((s) => s.source === e.source && s.url === e.url)) sources.push({ source: e.source, url: e.url });
  }

  return {
    id: stableId({ ...primary, time: timing.time }),
    title: primary.title,
    start: timing.start,
    end: timing.end,
    allDay: timing.time === null,
    venue: pick('venue'),
    address: pick('address'),
    city: pick('city'),
    url: primary.url,
    ticketUrl: pick('ticketUrl'),
    image: pick('image'),
    description,
    categories: categorize(sorted.flatMap((e) => e.categories ?? [])),
    sources,
  };
}

export function dedupe(events: RawEvent[]): Event[] {
  return groupDuplicates(events.map(normalizeEvent))
    .map(mergeGroup)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title, 'fi'));
}
