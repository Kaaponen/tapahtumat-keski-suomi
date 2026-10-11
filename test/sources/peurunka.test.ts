import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PEURUNKA_URL, parsePeurunka, peurunka, type PeurunkaEvent } from '../../src/sources/peurunka';
import { fakeCtx } from '../helpers';

const base: PeurunkaEvent = {
  event_id: 1,
  event_title: 'Keikka &#8211; Bändi',
  event_link: 'https://peurunka.fi/kaikki-tapahtumat/keikka/',
  event_category: ['Keikat'],
  event_start_date: '24.10.2026',
  event_end_date: '24.10.2026',
  event_time: 'Ovet 20:00',
  event_place: 'Pub',
  event_ticket_link: { title: 'Varaa', url: 'https://www.ticketmaster.fi/event/1' },
  event_content: '<p>Kuvaus</p>',
  event_image: 'https://peurunka.fi/kuva.jpg',
};

describe('parsePeurunka', () => {
  it('yhden illan keikka kellonajalla', () => {
    expect(parsePeurunka(base)).toEqual({
      source: 'peurunka',
      sourceId: '1',
      title: 'Keikka – Bändi',
      start: '2026-10-24T20:00:00+03:00',
      end: undefined,
      allDay: false,
      venue: 'Peurunka – Pub',
      address: 'Peurungantie 85',
      city: 'Laukaa',
      url: 'https://peurunka.fi/kaikki-tapahtumat/keikka/',
      ticketUrl: 'https://www.ticketmaster.fi/event/1',
      image: 'https://peurunka.fi/kuva.jpg',
      description: 'Kuvaus',
      categories: ['Keikat'],
    });
  });

  it('aikaväli "18 - 20" antaa myös loppuajan', () => {
    const e = parsePeurunka({ ...base, event_time: '18 - 20' })!;
    expect(e.start).toBe('2026-10-24T18:00:00+03:00');
    expect(e.end).toBe('2026-10-24T20:00:00+03:00');
  });

  it('ilman kellonaikaa tapahtuma on koko päivän', () => {
    const e = parsePeurunka({ ...base, event_time: '' })!;
    expect(e).toMatchObject({ start: '2026-10-24', allDay: true });
  });

  it('monipäiväinen näyttely on koko päivän tapahtuma loppupäivällä', () => {
    const e = parsePeurunka({ ...base, event_start_date: '04.10.2026', event_end_date: '01.11.2026', event_time: '' })!;
    expect(e).toMatchObject({ start: '2026-10-04', end: '2026-11-01', allDay: true });
  });

  it('paikka "Peurunka" ei toistu', () => {
    expect(parsePeurunka({ ...base, event_place: 'Peurunka' })!.venue).toBe('Peurunka');
    expect(parsePeurunka({ ...base, event_place: '' })!.venue).toBe('Peurunka');
  });

  it('puuttuva lippulinkki ja kuva', () => {
    const e = parsePeurunka({ ...base, event_ticket_link: '', event_image: false })!;
    expect(e.ticketUrl).toBeUndefined();
    expect(e.image).toBeUndefined();
  });

  it('virheellinen päivämäärä ohitetaan', () => {
    expect(parsePeurunka({ ...base, event_start_date: '' })).toBeNull();
  });
});

describe('peurunka.fetch', () => {
  it('jäsentää oikean tallennetun vastauksen', async () => {
    const real = JSON.parse(readFileSync('test/fixtures/peurunka/upcoming.json', 'utf8'));
    const events = await peurunka.fetch(fakeCtx({ [PEURUNKA_URL]: real }));
    expect(events.length).toBeGreaterThan(5);
    for (const e of events) expect(Number.isNaN(Date.parse(e.start))).toBe(false);
  });
});
