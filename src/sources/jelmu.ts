import * as cheerio from 'cheerio';
import { dayKey, helsinkiIso, inferYear, isoDate } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const JELMU_URL = 'https://www.jelmu.net/';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const TIME = /(\d{1,2})[:.](\d{2})/;
/** Esiintymisaika otsikon lopussa: "Saimaa (21:00)". */
const TITLE_TIME = /\s*\((\d{1,2}[:.]\d{2})\)\s*$/;
const CANCELLED = /^peruttu\b/i;

/**
 * Jelmun etusivun "Tulevat keikat". Alkuaika on ovien aika, koska Keski-Suomen kalenteri
 * käyttää samoja keikkoja ovien ajalla; esiintymisaika kerrotaan kuvauksessa.
 */
export function parseJelmu(html: string, today: string): RawEvent[] {
  const $ = cheerio.load(html);
  const out: RawEvent[] = [];
  $('li.product').each((_, el) => {
    const li = $(el);
    const url = li.find('a.woocommerce-LoopProduct-link').first().attr('href');
    const rawTitle = clean(li.find('.woocommerce-loop-product__title').first().text());
    const showTime = rawTitle.match(TITLE_TIME)?.[1];
    const title = rawTitle.replace(TITLE_TIME, '');
    const date = li.find('.datetime .date').first().text().match(/(\d{1,2})\.(\d{1,2})\./);
    if (!url || !title || !date || CANCELLED.test(title)) return;

    const d = Number(date[1]);
    const m = Number(date[2]);
    const y = inferYear(m, d, today);
    const doors = clean(li.find('.doors').first().text());
    const time = doors.match(TIME) ?? showTime?.match(TIME) ?? null;
    const description = [
      clean(li.find('.age').first().text()),
      doors,
      showTime && `Keikka alkaa ${showTime}`,
      clean(li.find('.price').first().text()),
      li.find('.out-of-stock').length > 0 && 'Loppuunmyyty',
    ].filter(Boolean).join(' · ');

    out.push({
      source: 'jelmu',
      sourceId: new URL(url).pathname.split('/').filter(Boolean).pop() ?? url,
      title,
      start: time ? helsinkiIso(y, m, d, Number(time[1]), Number(time[2])) : isoDate(y, m, d),
      allDay: !time,
      venue: clean(li.find('.location').first().text()) || undefined,
      city: 'Jyväskylä',
      url,
      ticketUrl: url,
      image: li.find('img').first().attr('src') || undefined,
      description: description || undefined,
      categories: ['keikat'],
    });
  });
  return out;
}

export const jelmu: Source = {
  id: 'jelmu',
  name: 'Jelmu',
  async fetch(ctx) {
    return parseJelmu(await ctx.getText(JELMU_URL), dayKey(new Date().toISOString()));
  },
};
