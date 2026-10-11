import { htmlToText } from '../scrape/text';
import type { RawEvent, Source } from '../shared/types';

interface LeText { fi?: string | null; en?: string | null; sv?: string | null }
export interface LeEvent {
  id: string;
  name: LeText;
  start_time: string;
  end_time?: string | null;
  location?: { name?: LeText | null; street_address?: LeText | null; address_locality?: LeText | null } | null;
  area?: { name?: LeText | null } | null;
  keywords?: { name?: LeText | null }[];
  images?: { url?: string | null }[];
  offers?: { info_url?: LeText | null }[];
  short_description?: LeText | null;
  description?: LeText | null;
  info_url?: LeText | null;
}
interface LePage { meta: { next: string | null; count: number }; data: LeEvent[] }

export const KSE_FIRST_URL =
  'https://keskisuomievents.fi/api/v1/event?page=1&page_size=100&include=location,keywords,area&start=today&super_event_type=umbrella,none';
const MAX_PAGES = 60;

const text = (t?: LeText | null): string | undefined =>
  (t?.fi || t?.en || t?.sv || '').trim() || undefined;

export function parseKse(e: LeEvent): RawEvent | null {
  const title = text(e.name);
  if (!title || !e.start_time) return null;
  const categories = (e.keywords ?? []).map((k) => text(k.name)).filter((k): k is string => !!k);
  return {
    source: 'keskisuomievents',
    sourceId: e.id,
    title,
    start: e.start_time,
    end: e.end_time || undefined,
    allDay: false,
    venue: text(e.location?.name),
    address: text(e.location?.street_address),
    city: text(e.area?.name) ?? text(e.location?.address_locality),
    url: `https://kalenteri.jyvaskyla.fi/tapahtuma/${e.id}`,
    ticketUrl: text(e.offers?.[0]?.info_url) ?? text(e.info_url),
    image: e.images?.[0]?.url || undefined,
    description: htmlToText(text(e.description) ?? text(e.short_description)),
    categories,
  };
}

export const keskisuomievents: Source = {
  id: 'keskisuomievents',
  name: 'Keski-Suomen tapahtumakalenteri',
  async fetch(ctx) {
    const out: RawEvent[] = [];
    let skipped = 0;
    let url: string | null = KSE_FIRST_URL;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res: LePage = await ctx.getJson<LePage>(url);
      for (const e of res.data) {
        const parsed = parseKse(e);
        if (parsed) out.push(parsed);
        else skipped++;
      }
      url = res.meta.next;
    }
    if (skipped) ctx.log(`keskisuomievents: ohitettiin ${skipped} puutteellista tapahtumaa`);
    return out;
  },
};
