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

  it('teatterin oma lähde voittaa kokoavan kalenterin, osoite täydentyy kalenterista', () => {
    const kse = raw({
      source: 'keskisuomievents', title: 'Aino A. -näytelmä Jyväskylän kaupunginteatterissa',
      start: '2026-10-17T10:00:00.000Z', venue: 'Jyväskylän kaupunginteatteri',
      address: 'Vapaudenkatu 36, Jyväskylä, Suomi', url: 'https://kse/2',
    });
    const th = raw({
      source: 'jklteatteri', title: 'Aino A.', start: '2026-10-17T13:00:00+03:00',
      venue: 'Jyväskylän kaupunginteatteri', url: 'https://th/1', ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
    });
    expect(mergeGroup([kse, th].map(normalizeEvent))).toMatchObject({
      title: 'Aino A.',
      url: 'https://th/1',
      ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
      address: 'Vapaudenkatu 36, Jyväskylä, Suomi',
      sources: [
        { source: 'jklteatteri', url: 'https://th/1' },
        { source: 'keskisuomievents', url: 'https://kse/2' },
      ],
    });
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

describe('mergeGroup: URL-validointi', () => {
  it('virheellinen ylemmän prioriteetin ticketUrl ei peitä kelvollista', () => {
    const pav = raw({ source: 'paviljonki', title: 'X', start: '2026-11-20T19:00:00+02:00', url: 'javascript:alert(1)', ticketUrl: 'Ovelta 30min ennen' });
    const kse = raw({ source: 'keskisuomievents', title: 'X', start: '2026-11-20T19:00:00+02:00', url: 'https://kse/1', ticketUrl: 'https://lippu.fi/1' });
    const merged = mergeGroup([pav, kse].map(normalizeEvent));
    expect(merged.ticketUrl).toBe('https://lippu.fi/1');
    expect(merged.url).toBe('https://kse/1');
    expect(merged.sources).toEqual([{ source: 'keskisuomievents', url: 'https://kse/1' }]);
  });
});

describe('dedupe: uniikit id:t', () => {
  it('samalla tiivisteellä olevat yhdistymättömät tapahtumat saavat eri id:t', () => {
    const a = raw({ source: 'keskisuomievents', title: 'Sama', start: '2026-11-20T19:00:00+02:00', url: 'https://a/1', address: 'Kauppakatu 1' });
    const b = raw({ source: 'keskisuomievents', title: 'Sama', start: '2026-11-20T19:00:00+02:00', url: 'https://a/2', address: 'Torikatu 2' });
    const out = dedupe([a, b]);
    const ids = out.map((e) => e.id);
    expect(out).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
