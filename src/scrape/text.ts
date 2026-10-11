import * as cheerio from 'cheerio';

export function htmlToText(html?: string | null, max = 600): string | undefined {
  if (!html) return undefined;
  const spaced = html.replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ' $&');
  const text = cheerio.load(spaced).root().text().replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function decodeEntities(s: string): string {
  return cheerio.load(`<p>${s}</p>`)('p').text();
}
