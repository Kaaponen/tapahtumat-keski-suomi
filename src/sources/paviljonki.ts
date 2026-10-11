import * as cheerio from 'cheerio';
import { htmlToText } from '../scrape/text';
import { helsinkiIso, isoDate, parseDurationMinutes, parseFinnishDate, parseTimes } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const PAVILJONKI_LIST_URL = 'https://www.paviljonki.fi/tapahtumat-liput/';

export interface PavListItem {
  url: string;
  title: string;
  date: { y: number; m: number; d: number };
  categories: string[];
  ticketUrl?: string;
  image?: string;
}

export interface PavDetail {
  start?: [number, number];
  durationMin?: number;
  hall?: string;
  description?: string;
}

export function parsePaviljonkiList(html: string): PavListItem[] {
  const $ = cheerio.load(html);
  const items: PavListItem[] = [];
  $('.event-list-item').each((_, el) => {
    const item = $(el);
    const link = item.find('.event-details__title a').first();
    const url = link.attr('href');
    const title = link.text().replace(/\s+/g, ' ').trim();
    const date = parseFinnishDate(item.find('.event-details__meta').text());
    if (!url || !title || !date) return;
    items.push({
      url,
      title,
      date,
      categories: item.find('.tag-list-item').map((_, t) => $(t).text().trim()).get().filter(Boolean),
      ticketUrl: item.find('.event-list-item__tickets a').first().attr('href') || undefined,
      image: item.find('.event-list-item__image img').first().attr('src') || undefined,
    });
  });
  return items;
}

export function parsePaviljonkiDetail(html: string): PavDetail {
  const $ = cheerio.load(html);
  const when = $('.icon-link--calender p').first().text();
  const afterKlo = when.split(/klo/i)[1] ?? '';
  const main = $('.event__main').clone();
  main.find('h1').remove();
  return {
    start: parseTimes(afterKlo).start,
    durationMin: parseDurationMinutes($('.icon-link--clock p').first().text()),
    hall: $('.icon-link--location a').first().text().trim() || undefined,
    description: htmlToText(main.html()),
  };
}

export const paviljonki: Source = {
  id: 'paviljonki',
  name: 'Paviljonki',
  async fetch(ctx) {
    const items = parsePaviljonkiList(await ctx.getText(PAVILJONKI_LIST_URL));
    const out: RawEvent[] = [];
    for (const item of items) {
      let detail: PavDetail = {};
      try {
        detail = parsePaviljonkiDetail(await ctx.getText(item.url));
      } catch (err) {
        ctx.log(`paviljonki: tapahtumasivu epäonnistui ${item.url}: ${(err as Error).message}`);
      }
      const { y, m, d } = item.date;
      const start = detail.start ? helsinkiIso(y, m, d, ...detail.start) : isoDate(y, m, d);
      const end = detail.start && detail.durationMin
        ? new Date(Date.parse(start) + detail.durationMin * 60_000).toISOString()
        : undefined;
      out.push({
        source: 'paviljonki',
        sourceId: item.url,
        title: item.title,
        start,
        end,
        allDay: !detail.start,
        venue: detail.hall ? `Paviljonki – ${detail.hall}` : 'Paviljonki',
        address: 'Lutakonaukio 12',
        city: 'Jyväskylä',
        url: item.url,
        ticketUrl: item.ticketUrl,
        image: item.image,
        description: detail.description,
        categories: item.categories,
      });
    }
    return out;
  },
};
