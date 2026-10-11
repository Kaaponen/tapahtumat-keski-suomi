import * as cheerio from 'cheerio';
import { dayKey, finnishWeekday, helsinkiIso, inferYear, isValidDate, isoDate } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const JELMU_URL = 'https://www.jelmu.net/';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const TIME = /(\d{1,2})[:.](\d{2})/;
/** Esiintymisaika otsikon lopussa: "Saimaa (21:00)". */
const TITLE_TIME = /\s*\((\d{1,2}[:.]\d{2})\)\s*$/;
const CANCELLED = /^peruttu\b/i;

/** Kellonaika [tunnit, minuutit], jos teksti sisältää kelvollisen ajan. */
function parseTime(s?: string): [number, number] | undefined {
  const t = s?.match(TIME);
  if (!t) return undefined;
  const hh = Number(t[1]);
  const mm = Number(t[2]);
  return hh <= 23 && mm <= 59 ? [hh, mm] : undefined;
}

/**
 * Otsikossa on yksi span esiintyjää kohden ("Maija Vilkkumaa (20:00)", "M (19:00)"), tai pelkkä teksti.
 * Palauttaa nimet pilkulla eroteltuna ja pääesiintyjän (ensimmäisen) esiintymisajan.
 */
function parseTitle($: cheerio.CheerioAPI, h2: ReturnType<cheerio.CheerioAPI>): { title: string; showTime?: string } {
  const spans = h2.children('span').toArray().map((el) => clean($(el).text())).filter(Boolean);
  const parts = spans.length ? spans : [clean(h2.text())];
  return {
    title: parts.map((p) => p.replace(TITLE_TIME, '')).filter(Boolean).join(', '),
    showTime: parts[0]?.match(TITLE_TIME)?.[1],
  };
}

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
    const { title, showTime } = parseTitle($, li.find('.woocommerce-loop-product__title').first());
    const date = li.find('.datetime .date').first().text().match(/(\d{1,2})\.(\d{1,2})\./);
    if (!url || !title || !date || CANCELLED.test(title)) return;

    const d = Number(date[1]);
    const m = Number(date[2]);
    const weekday = finnishWeekday(li.find('.datetime span').first().text());
    const y = inferYear(m, d, today, weekday);
    if (!isValidDate(y, m, d)) return;
    const doors = clean(li.find('.doors').first().text());
    const time = parseTime(doors) ?? parseTime(showTime);
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
      start: time ? helsinkiIso(y, m, d, ...time) : isoDate(y, m, d),
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
