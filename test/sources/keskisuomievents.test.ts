import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KSE_FIRST_URL, keskisuomievents, parseKse } from '../../src/sources/keskisuomievents';
import { fakeCtx } from '../helpers';

const sample = {
  id: '0cfc5109-53f5-4502-a485-14dc0b0e320b',
  name: { fi: 'Flanels salibandy', en: 'Flanels floorball', sv: '' },
  start_time: '2026-10-11T07:00:00.000Z',
  end_time: '2026-10-11T11:00:00.000Z',
  location: { name: { fi: 'Joutsan liikuntahalli', sv: null, en: null }, street_address: { fi: 'Tapiontie 3, Joutsa' } },
  area: { name: { fi: 'Joutsa' } },
  keywords: [{ name: { fi: 'Urheilu' } }, { name: { fi: '' } }],
  images: [{ url: 'https://keskisuomievents.fi/api/assets/x.jpg' }],
  offers: [{ info_url: { fi: 'https://liput.example/1' }, is_free: false }],
  short_description: { fi: 'Lyhyt.' },
  description: { fi: '<p>Flanels <b>salibandyä</b>.</p>' },
  info_url: null,
};

describe('parseKse', () => {
  it('muuntaa rajapinnan tapahtuman', () => {
    expect(parseKse(sample)).toEqual({
      source: 'keskisuomievents',
      sourceId: '0cfc5109-53f5-4502-a485-14dc0b0e320b',
      title: 'Flanels salibandy',
      start: '2026-10-11T07:00:00.000Z',
      end: '2026-10-11T11:00:00.000Z',
      allDay: false,
      venue: 'Joutsan liikuntahalli',
      address: 'Tapiontie 3, Joutsa',
      city: 'Joutsa',
      url: 'https://kalenteri.jyvaskyla.fi/tapahtuma/0cfc5109-53f5-4502-a485-14dc0b0e320b',
      ticketUrl: 'https://liput.example/1',
      image: 'https://keskisuomievents.fi/api/assets/x.jpg',
      description: 'Flanels salibandyä.',
      categories: ['Urheilu'],
    });
  });

  it('jättää paikan pois, jos se on sama kuin kunta', () => {
    const r = parseKse({ ...sample, location: { name: { fi: 'Jämsä' } }, area: { name: { fi: 'jämsä' } } });
    expect(r?.venue).toBeUndefined();
    expect(r?.city).toBe('jämsä');
  });

  it('käsittelee 00:00-alkuisen yhden päivän tapahtuman koko päivän tapahtumana', () => {
    const r = parseKse({ ...sample, start_time: '2026-10-10T21:00:00.000Z', end_time: '2026-10-11T21:00:00.000Z' });
    expect(r).toMatchObject({ allDay: true, start: '2026-10-11' });
    expect(r?.end).toBeUndefined();
  });

  it('käsittelee 00:00-alkuisen usean päivän tapahtuman koko päivän tapahtumana', () => {
    const r = parseKse({ ...sample, start_time: '2026-10-10T21:00:00.000Z', end_time: '2026-10-13T21:00:00.000Z' });
    expect(r).toMatchObject({ allDay: true, start: '2026-10-11', end: '2026-10-13' });
  });

  it('käyttää englantia, jos suomenkielinen nimi puuttuu', () => {
    expect(parseKse({ ...sample, name: { fi: '', en: 'Only English' } })?.title).toBe('Only English');
  });

  it('ohittaa tapahtuman ilman nimeä tai alkuaikaa', () => {
    expect(parseKse({ ...sample, name: { fi: '' } })).toBeNull();
    expect(parseKse({ ...sample, start_time: '' })).toBeNull();
  });
});

describe('keskisuomievents.fetch', () => {
  it('seuraa sivutusta meta.next-kentän kautta', async () => {
    const page2 = 'https://keskisuomievents.fi/api/v1/event?page=2';
    const ctx = fakeCtx({
      [KSE_FIRST_URL]: { meta: { next: page2, count: 2 }, data: [sample] },
      [page2]: { meta: { next: null, count: 2 }, data: [{ ...sample, id: 'toinen' }] },
    });
    const events = await keskisuomievents.fetch(ctx);
    expect(events.map((e) => e.sourceId)).toEqual(['0cfc5109-53f5-4502-a485-14dc0b0e320b', 'toinen']);
  });

  it('jäsentää oikean tallennetun vastauksen', async () => {
    const real = JSON.parse(readFileSync('test/fixtures/keskisuomievents/page.json', 'utf8'));
    const ctx = fakeCtx({ [KSE_FIRST_URL]: { ...real, meta: { ...real.meta, next: null } } });
    const events = await keskisuomievents.fetch(ctx);
    expect(events.length).toBeGreaterThan(10);
    for (const e of events) {
      expect(e.title).toBeTruthy();
      expect(Number.isNaN(Date.parse(e.start))).toBe(false);
    }
  });
});
