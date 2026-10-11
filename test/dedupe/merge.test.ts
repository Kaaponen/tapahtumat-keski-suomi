import { describe, expect, it } from 'vitest';
import { dedupe, mergeGroup, stableId } from '../../src/dedupe/merge';
import { normalizeEvent } from '../../src/dedupe/normalize';
import { raw } from '../dedupe.cases';

describe('mergeGroup', () => {
  it('valitsee kentät parhaista lähteistä ja listaa kaikki lähteet', () => {
    const kse = raw({
      source: 'keskisuomievents', title: 'Haloo Helsinki! – Kevätkiertue', start: '2026-11-20T17:00:00.000Z',
      venue: 'Jyväskylän Paviljonki', description: 'Pitkä kuvaus kalenterista, jossa on paljon tekstiä.',
      image: 'https://kse/kuva.jpg', categories: ['Musiikki'], url: 'https://kse/1',
    });
    const kl = raw({
      source: 'keikkalista', title: 'Haloo Helsinki!', start: '2026-11-20', allDay: true,
      venue: 'Paviljonki', url: 'https://kl/1', categories: ['keikat'],
    });
    const pav = raw({
      source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00',
      end: '2026-11-20T19:00:00.000Z', venue: 'Paviljonki – Sali A', url: 'https://pav/1',
      ticketUrl: 'https://lippu.fi/1', description: 'Lyhyt.', categories: ['Konsertit'],
    });
    const merged = mergeGroup([kse, kl, pav].map(normalizeEvent));
    expect(merged).toMatchObject({
      title: 'Haloo Helsinki!',
      start: '2026-11-20T19:00:00+02:00',
      end: '2026-11-20T19:00:00.000Z',
      allDay: false,
      venue: 'Paviljonki – Sali A',
      url: 'https://pav/1',
      ticketUrl: 'https://lippu.fi/1',
      image: 'https://kse/kuva.jpg',
      description: 'Pitkä kuvaus kalenterista, jossa on paljon tekstiä.',
      categories: ['Musiikki'],
      sources: [
        { source: 'paviljonki', url: 'https://pav/1' },
        { source: 'keikkalista', url: 'https://kl/1' },
        { source: 'keskisuomievents', url: 'https://kse/1' },
      ],
    });
  });

  it('koko päivän tapahtumat yhdistyvät koko päivän tapahtumaksi', () => {
    const a = raw({ source: 'keikkalista', title: 'X', start: '2026-11-20', allDay: true });
    expect(mergeGroup([normalizeEvent(a)])).toMatchObject({ start: '2026-11-20', allDay: true });
  });
});

describe('stableId', () => {
  it('on sama joka ajolla ja eri saman päivän eri esityksille', () => {
    const e14 = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue: 'Teatteri' }));
    const e14b = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue: 'Teatteri' }));
    const e19 = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T19:00:00+02:00', venue: 'Teatteri' }));
    expect(stableId(e14)).toBe(stableId(e14b));
    expect(stableId(e14)).not.toBe(stableId(e19));
    expect(stableId(e14)).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('dedupe', () => {
  it('yhdistää tuplat ja järjestää alkuajan mukaan', () => {
    const events = dedupe([
      raw({ title: 'B', start: '2026-11-21T18:00:00+02:00', venue: 'Lutakko' }),
      raw({ source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00', venue: 'Paviljonki' }),
      raw({ title: 'Haloo Helsinki!', start: '2026-11-20T17:00:00.000Z', venue: 'Jyväskylän Paviljonki' }),
    ]);
    expect(events.map((e) => e.title)).toEqual(['Haloo Helsinki!', 'B']);
    expect(events[0].sources).toHaveLength(2);
  });
});
