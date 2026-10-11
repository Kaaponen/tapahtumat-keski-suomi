import * as cheerio from 'cheerio';
import { dayKey, helsinkiIso, inferYear, isoDate } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

const BASE = 'https://www.jklteatteri.fi';
export const JKLTEATTERI_LIST_URL = `${BASE}/kaupunginteatteri/ohjelmisto`;

/** Koostesivu, jolla on monta eri tapahtumaa yhden otsikon alla. */
const SKIP = new Set(['muut-tapahtumat']);
const SHOW_PATH = /^\/kaupunginteatteri\/ohjelmisto\/([^/]+)\/?$/;
/** Esityskerran rivi alkaa viikonpäivällä: "pe 25.9. klo 18.30", "ma 16.11.2026 klo 18.30". */
const LINE = /^(?:ma|ti|ke|to|pe|la|su) (\d{1,2})\.(\d{1,2})\.(\d{4})?/i;
/** "klo 18.30", "klo 18", "klo 10–12". */
const KLO = /klo\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*[–-]\s*(\d{1,2})(?:[.:](\d{2}))?)?/gi;

export function parseTeatteriList(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL($(a).attr('href')!, JKLTEATTERI_LIST_URL);
    } catch {
      return; // rikkinäinen linkki
    }
    const m = u.pathname.match(SHOW_PATH);
    if (u.hostname === 'www.jklteatteri.fi' && m && !SKIP.has(m[1])) {
      urls.add(`${BASE}/kaupunginteatteri/ohjelmisto/${m[1]}`);
    }
  });
  return [...urls];
}

/** Sivun tekstirivit: <br> ja lohkoelementtien loput ovat rivinvaihtoja. */
function textLines(html: string): string[] {
  const marked = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '$&\n');
  return cheerio.load(marked).root().text().split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
}

export function parseTeatteriShow(html: string, url: string, today: string): RawEvent[] {
  const $ = cheerio.load(html);
  const meta = (p: string) => $(`meta[property="og:${p}"]`).attr('content')?.trim() || undefined;
  const title = meta('title')?.replace(/^(vierailu|yhteistyö):\s*/i, '');
  if (!title) return [];
  const main = $('.main').first();
  const root = main.length ? main : $('body');
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop()!;
  const ticketUrl = root.find('a[href*="lippu.fi"]').first().attr('href') || undefined;

  const out: RawEvent[] = [];
  const seen = new Set<string>();
  for (const line of textLines(root.html() ?? '')) {
    const date = line.match(LINE);
    if (!date) continue;
    const d = Number(date[1]);
    const m = Number(date[2]);
    const y = date[3] ? Number(date[3]) : inferYear(m, d, today);
    for (const t of line.matchAll(KLO)) {
      const hh = Number(t[1]);
      const mm = Number(t[2] ?? 0);
      if (hh > 23 || mm > 59) continue;
      const sourceId = `${slug}-${isoDate(y, m, d)}-${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      out.push({
        source: 'jklteatteri',
        sourceId,
        title,
        start: helsinkiIso(y, m, d, hh, mm),
        end: t[3] ? helsinkiIso(y, m, d, Number(t[3]), Number(t[4] ?? 0)) : undefined,
        allDay: false,
        venue: 'Jyväskylän kaupunginteatteri',
        city: 'Jyväskylä',
        url,
        ticketUrl,
        image: meta('image'),
        description: meta('description'),
        categories: ['teatteri'],
      });
    }
  }
  return out;
}

export const jklteatteri: Source = {
  id: 'jklteatteri',
  name: 'Jyväskylän kaupunginteatteri',
  async fetch(ctx) {
    const today = dayKey(new Date().toISOString());
    const urls = parseTeatteriList(await ctx.getText(JKLTEATTERI_LIST_URL));
    const out: RawEvent[] = [];
    for (const url of urls) {
      try {
        out.push(...parseTeatteriShow(await ctx.getText(url), url, today));
      } catch (err) {
        ctx.log(`jklteatteri: esityssivu epäonnistui ${url}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
