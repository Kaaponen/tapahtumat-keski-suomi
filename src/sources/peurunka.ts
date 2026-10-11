import { decodeEntities, htmlToText } from '../scrape/text';
import { helsinkiIso, isoDate, parseFinnishDate, parseTimes } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export interface PeurunkaEvent {
  event_id: number;
  event_title: string;
  event_link: string;
  event_category?: string[];
  event_start_date: string;
  event_end_date?: string;
  event_time?: string;
  event_place?: string;
  event_ticket_link?: { url?: string; title?: string } | '' | null;
  event_content?: string;
  event_image?: string | false | null;
}

export const PEURUNKA_URL = 'https://peurunka.fi/wp-json/events/v2/upcoming';

export function parsePeurunka(e: PeurunkaEvent): RawEvent | null {
  const d = parseFinnishDate(e.event_start_date ?? '');
  if (!d || !e.event_title) return null;
  const endDate = parseFinnishDate(e.event_end_date ?? '');
  const multiDay = !!endDate && (endDate.y !== d.y || endDate.m !== d.m || endDate.d !== d.d);
  const times = parseTimes(e.event_time ?? '');
  const timed = !multiDay && !!times.start;

  const start = timed ? helsinkiIso(d.y, d.m, d.d, ...times.start!) : isoDate(d.y, d.m, d.d);
  let end: string | undefined;
  if (multiDay) end = isoDate(endDate!.y, endDate!.m, endDate!.d);
  else if (timed && times.end) end = helsinkiIso(d.y, d.m, d.d, ...times.end);

  const place = (e.event_place ?? '').trim();
  const ticket = e.event_ticket_link && typeof e.event_ticket_link === 'object' ? e.event_ticket_link.url : undefined;

  return {
    source: 'peurunka',
    sourceId: String(e.event_id),
    title: decodeEntities(e.event_title).trim(),
    start,
    end,
    allDay: !timed,
    venue: place && !/^peurunka$/i.test(place) ? `Peurunka – ${place}` : 'Peurunka',
    address: 'Peurungantie 85',
    city: 'Laukaa',
    url: e.event_link,
    ticketUrl: ticket || undefined,
    image: e.event_image || undefined,
    description: htmlToText(e.event_content),
    categories: e.event_category ?? [],
  };
}

export const peurunka: Source = {
  id: 'peurunka',
  name: 'Peurunka',
  async fetch(ctx) {
    const list = await ctx.getJson<PeurunkaEvent[]>(PEURUNKA_URL);
    const out = list.map(parsePeurunka).filter((e): e is RawEvent => e !== null);
    if (out.length < list.length) ctx.log(`peurunka: ohitettiin ${list.length - out.length} tapahtumaa`);
    return out;
  },
};
