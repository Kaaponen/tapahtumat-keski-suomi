import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PAVILJONKI_LIST_URL, paviljonki, parsePaviljonkiDetail, parsePaviljonkiList,
} from '../../src/sources/paviljonki';
import { fakeCtx } from '../helpers';

const LIST = `
<div class="event-list">
  <h2 class="month_year">lokakuu 2026</h2>
  <div class="event-list-item">
    <div class="event-list-item__image"><img src="https://www.paviljonki.fi/kuva.jpg"></div>
    <div class="event-list-item__details">
      <h2 class="event-details__title"><a href="https://www.paviljonki.fi/tapahtuma/benjamin/"> Benjamin Locker Room Tour K18 </a></h2>
      <div class="event-details__meta"><div class="tag-list"><span class="tag-list-item">Konsertit</span><span class="tag-list-item">Paviljonki Klubi</span></div> 16.10.2026 </div>
    </div>
    <div class="event-list-item__tickets"><a href="https://www.lippu.fi/event/1/">Osta liput</a></div>
  </div>
  <div class="event-list-item">
    <div class="event-list-item__details">
      <h2 class="event-details__title"><a href="https://www.paviljonki.fi/tapahtuma/rikki/">Ei päivämäärää</a></h2>
      <div class="event-details__meta"></div>
    </div>
  </div>
</div>`;

const DETAIL = `
<main><article><div class="event"><div class="event__main"><h1>Benjamin</h1><p>Kuvausteksti.</p></div>
<div class="event__sidebar">
  <div class="icon-link icon-link--calender"><p> 16.10.2026 klo 19.30 </p></div>
  <div class="icon-link icon-link--clock"><p>noin 2h 15 min</p></div>
  <div class="icon-link icon-link--location"><p>Paikka: <a href="https://www.paviljonki.fi/tilat/klubi/">Paviljonki Klubi</a></p></div>
</div></div></article></main>`;

describe('parsePaviljonkiList', () => {
  it('lukee tapahtumat ja ohittaa rivit ilman päivämäärää', () => {
    expect(parsePaviljonkiList(LIST)).toEqual([{
      url: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      title: 'Benjamin Locker Room Tour K18',
      date: { y: 2026, m: 10, d: 16 },
      categories: ['Konsertit', 'Paviljonki Klubi'],
      ticketUrl: 'https://www.lippu.fi/event/1/',
      image: 'https://www.paviljonki.fi/kuva.jpg',
    }]);
  });
});

describe('parsePaviljonkiDetail', () => {
  it('lukee kellonajan, keston, salin ja kuvauksen', () => {
    expect(parsePaviljonkiDetail(DETAIL)).toEqual({
      start: [19, 30], durationMin: 135, hall: 'Paviljonki Klubi', description: 'Kuvausteksti.',
    });
  });
});

describe('paviljonki.fetch', () => {
  it('yhdistää listan ja tapahtumasivun tiedot', async () => {
    const ctx = fakeCtx({
      [PAVILJONKI_LIST_URL]: LIST,
      'https://www.paviljonki.fi/tapahtuma/benjamin/': DETAIL,
    });
    const [e] = await paviljonki.fetch(ctx);
    expect(e).toEqual({
      source: 'paviljonki',
      sourceId: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      title: 'Benjamin Locker Room Tour K18',
      start: '2026-10-16T19:30:00+03:00',
      end: '2026-10-16T18:45:00.000Z',
      allDay: false,
      venue: 'Paviljonki – Paviljonki Klubi',
      address: 'Lutakonaukio 12',
      city: 'Jyväskylä',
      url: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      ticketUrl: 'https://www.lippu.fi/event/1/',
      image: 'https://www.paviljonki.fi/kuva.jpg',
      description: 'Kuvausteksti.',
      categories: ['Konsertit', 'Paviljonki Klubi'],
    });
  });

  it('käyttää pelkkää päivämäärää, jos tapahtumasivun haku epäonnistuu', async () => {
    const ctx = fakeCtx({ [PAVILJONKI_LIST_URL]: LIST });
    const [e] = await paviljonki.fetch(ctx);
    expect(e).toMatchObject({ start: '2026-10-16', allDay: true, venue: 'Paviljonki' });
  });

  it('jäsentää oikean tallennetun listan ja tapahtumasivun', () => {
    const items = parsePaviljonkiList(readFileSync('test/fixtures/paviljonki/list.html', 'utf8'));
    expect(items.length).toBeGreaterThan(10);
    const detail = parsePaviljonkiDetail(readFileSync('test/fixtures/paviljonki/detail.html', 'utf8'));
    expect(detail.start).toBeDefined();
  });
});
