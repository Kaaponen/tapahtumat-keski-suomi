import * as cheerio from 'cheerio';
import { isDateOnly } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const KEIKKALISTA_URL = 'https://www.keikkalista.fi/jyvaskyla';

interface LdEvent {
  '@type'?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  image?: string | string[];
  description?: string;
  location?: { name?: string; address?: { streetAddress?: string; addressLocality?: string } | string };
  offers?: { url?: string } | { url?: string }[];
}

function* findEvents(node: unknown): Generator<LdEvent> {
  if (Array.isArray(node)) {
    for (const child of node) yield* findEvents(child);
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (/Event$/.test(String(obj['@type'] ?? ''))) yield obj as LdEvent;
    for (const value of Object.values(obj)) yield* findEvents(value);
  }
}

function toRaw(e: LdEvent): RawEvent | null {
  if (!e.name || !e.startDate || !e.url) return null;
  const address = typeof e.location?.address === 'object' ? e.location.address : undefined;
  const image = Array.isArray(e.image) ? e.image[0] : e.image;
  const offer = Array.isArray(e.offers) ? e.offers[0] : e.offers;
  return {
    source: 'keikkalista',
    sourceId: e.url,
    title: e.name.trim(),
    start: e.startDate,
    end: e.endDate,
    allDay: isDateOnly(e.startDate),
    venue: e.location?.name,
    address: address?.streetAddress,
    city: address?.addressLocality,
    url: e.url,
    ticketUrl: offer?.url,
    image,
    description: e.description,
    categories: ['keikat'],
  };
}

export function parseKeikkalista(html: string): RawEvent[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, RawEvent>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    for (const e of findEvents(data)) {
      const raw = toRaw(e);
      if (raw && !byUrl.has(raw.url)) byUrl.set(raw.url, raw);
    }
  });
  return [...byUrl.values()];
}

export const keikkalista: Source = {
  id: 'keikkalista',
  name: 'Keikkalista',
  async fetch(ctx) {
    return parseKeikkalista(await ctx.getText(KEIKKALISTA_URL));
  },
};
