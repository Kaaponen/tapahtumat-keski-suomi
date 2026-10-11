import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JKLTEATTERI_LIST_URL, jklteatteri, parseTeatteriList, parseTeatteriShow,
} from '../../src/sources/jklteatteri';
import { fakeCtx } from '../helpers';

const BASE = 'https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto';
const AINO = `${BASE}/aino`;
const LUOLAMIES = `${BASE}/vierailu-luolamies`;

const LIST = `<html><body><div class="main">
  <a href="/kaupunginteatteri/ohjelmisto">Ohjelmisto</a>
  <a href="/kaupunginteatteri/ohjelmisto/aino">Aino A.</a>
  <a href="/kaupunginteatteri/ohjelmisto/aino">Lue lisää</a>
  <a href="/kaupunginteatteri/ohjelmisto/muut-tapahtumat">Muut tapahtumat</a>
  <a href="https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto/vierailu-luolamies/">Luolamies</a>
  <a href="/tanssiteatteri/ohjelmisto/jotain">Tanssi</a>
</div></body></html>`;

const SHOW = `<html><head>
<meta property="og:title" content="Vierailu: Aino A." />
<meta property="og:description" content="Kuvaus &amp; lisää." />
<meta property="og:image" content="https://www.jklteatteri.fi/kuva.jpg" />
</head><body>
<div class="main main--with-sidebar">
<p><strong>Ensi-ilta</strong> la 26.9.2026 klo 15 | &nbsp;suuri näyttämö<br>
<a href="https://www.lippu.fi/eventseries/name-1">Osta liput &gt;&gt;</a></p>
<p><strong>pe 16.10. </strong>klo 18.30&nbsp;<strong>&nbsp;ennakkonäytös</strong><br>
<strong>la 28.11. </strong>klo 13.00 ja klo 14.30<br>
<strong>ke 13.1. </strong>klo 10–12<br>
<strong>pe 16.10. </strong>klo 18.30 TÄYNNÄ<br>
Teosesittely 17.10. klo 13.00<br>
<strong>la 21.11.2026</strong> klo 18 | suuri näyttämö</p>
</div></body></html>`;

const TODAY = '2026-10-11';

describe('parseTeatteriList', () => {
  it('palauttaa esityssivut ilman tuplia ja ohittaa koostesivun', () => {
    expect(parseTeatteriList(LIST)).toEqual([AINO, LUOLAMIES]);
  });

  it('jäsentää oikean tallennetun ohjelmistosivun', () => {
    const urls = parseTeatteriList(readFileSync('test/fixtures/jklteatteri/list.html', 'utf8'));
    expect(urls.length).toBeGreaterThanOrEqual(5);
    expect(urls).toContain(AINO);
    expect(urls.some((u) => u.endsWith('/muut-tapahtumat'))).toBe(false);
  });
});

describe('parseTeatteriShow', () => {
  const events = () => parseTeatteriShow(SHOW, AINO, TODAY);

  it('tekee jokaisesta esityskerrasta oman tapahtuman', () => {
    expect(events()[0]).toEqual({
      source: 'jklteatteri',
      sourceId: 'aino-2026-10-16-1830',
      title: 'Aino A.',
      start: '2026-10-16T18:30:00+03:00',
      allDay: false,
      venue: 'Jyväskylän kaupunginteatteri',
      city: 'Jyväskylä',
      url: AINO,
      ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
      image: 'https://www.jklteatteri.fi/kuva.jpg',
      description: 'Kuvaus & lisää.',
      categories: ['teatteri'],
    });
  });

  it('lukee useat ajat, aikavälin ja rivin vuoden; ohittaa tuplat ja rivit ilman viikonpäivää', () => {
    expect(events().map((e) => [e.start, e.end])).toEqual([
      ['2026-10-16T18:30:00+03:00', undefined],
      ['2026-11-28T13:00:00+02:00', undefined],
      ['2026-11-28T14:30:00+02:00', undefined],
      ['2027-01-13T10:00:00+02:00', '2027-01-13T12:00:00+02:00'],
      ['2026-11-21T18:00:00+02:00', undefined],
    ]);
  });

  it('ei palauta mitään ilman otsikkoa', () => {
    expect(parseTeatteriShow('<html><body><div class="main">pe 16.10. klo 18</div></body></html>', AINO, TODAY)).toEqual([]);
  });

  it('jäsentää oikeat tallennetut esityssivut', () => {
    const aino = parseTeatteriShow(readFileSync('test/fixtures/jklteatteri/aino.html', 'utf8'), AINO, TODAY);
    expect(aino.length).toBeGreaterThanOrEqual(10);
    expect(aino.every((e) => e.title === 'Aino A.' && e.ticketUrl?.includes('lippu.fi'))).toBe(true);
    const luolamies = parseTeatteriShow(
      readFileSync('test/fixtures/jklteatteri/vierailu-luolamies.html', 'utf8'), LUOLAMIES, TODAY,
    );
    expect(luolamies.length).toBeGreaterThanOrEqual(1);
    expect(luolamies[0].title).toBe('Luolamies');
  });
});

describe('jklteatteri.fetch', () => {
  afterEach(() => vi.useRealTimers());

  it('hakee listan ja esityssivut; epäonnistunut sivu ohitetaan', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T09:00:00Z'));
    const logs: string[] = [];
    const ctx = { ...fakeCtx({ [JKLTEATTERI_LIST_URL]: LIST, [AINO]: SHOW }), log: (m: string) => logs.push(m) };
    const events = await jklteatteri.fetch(ctx);
    expect(events).toHaveLength(5);
    expect(ctx.requested).toEqual([JKLTEATTERI_LIST_URL, AINO, LUOLAMIES]);
    expect(logs.join('\n')).toContain(LUOLAMIES);
  });

  it('listasivun virhe kaataa lähteen', async () => {
    await expect(jklteatteri.fetch(fakeCtx({}))).rejects.toThrow();
  });
});
