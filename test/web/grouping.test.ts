import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { buildDayGroups, limitGroups } from '../../src/web/logic/grouping';

const ev = (p: Partial<Event> & Pick<Event, 'title' | 'start'>): Event => ({
  id: `${p.title}-${p.start}`, allDay: false, url: 'u', categories: [], sources: [], ...p,
});
const TODAY = '2026-10-14';

describe('buildDayGroups', () => {
  it('aikarajauksessa ennen rajauksen alkua alkaneet kuuluvat ensimmäisen päivän käynnissä oleviin', () => {
    const groups = buildDayGroups([
      ev({ title: 'Näyttely', start: '2026-10-01', end: '2026-11-01', allDay: true }),
      ev({ title: 'Festivaali', start: '2026-10-15T18:00:00+03:00', end: '2026-10-17T23:00:00+03:00' }),
      ev({ title: 'Lauantai', start: '2026-10-17T20:00:00+03:00' }),
    ], TODAY, '2026-10-16');
    expect(groups.map((g) => [g.day, g.items.map((i) => i.event.title), g.ongoing.map((i) => i.event.title)])).toEqual([
      ['2026-10-16', [], ['Näyttely', 'Festivaali']],
      ['2026-10-17', ['Lauantai'], []],
    ]);
  });

  it('ryhmittelee päivittäin ja nostaa käynnissä olevan tapahtuman tähän päivään', () => {
    const groups = buildDayGroups([
      ev({ title: 'Näyttely', start: '2026-10-01', end: '2026-11-01', allDay: true }),
      ev({ title: 'Keikka', start: '2026-10-14T20:00:00+03:00' }),
      ev({ title: 'Huominen', start: '2026-10-15T18:00:00+03:00' }),
    ], TODAY);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.event.title), g.ongoing.map((i) => i.event.title)])).toEqual([
      ['Tänään', ['Keikka'], ['Näyttely']],
      ['Huomenna', ['Huominen'], []],
    ]);
  });

  it('kokoaa saman nimen ja paikan esitykset yhdeksi riviksi', () => {
    const groups = buildDayGroups([
      ev({ title: 'Peter Pan', venue: 'Teatteri', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'Peter Pan', venue: 'Teatteri', start: '2026-10-20T19:00:00+03:00' }),
      ev({ title: 'Peter Pan', venue: 'Muu', start: '2026-10-21T19:00:00+03:00' }),
    ], TODAY);
    expect(groups).toHaveLength(2);
    expect(groups[0].items[0].series).toHaveLength(2);
  });
});

describe('limitGroups', () => {
  it('katkaisee tapahtumamäärän ja kertoo, onko lisää', () => {
    const groups = buildDayGroups([
      ev({ title: 'A', start: '2026-10-14T18:00:00+03:00' }),
      ev({ title: 'B', start: '2026-10-14T19:00:00+03:00' }),
      ev({ title: 'C', start: '2026-10-15T19:00:00+03:00' }),
    ], TODAY);
    const limited = limitGroups(groups, 2);
    expect(limited.groups.flatMap((g) => g.items).length).toBe(2);
    expect(limited.hasMore).toBe(true);
    expect(limitGroups(groups, 10).hasMore).toBe(false);
  });

  it('ei laske käynnissä olevia sivurajaan', () => {
    const groups = buildDayGroups([
      ev({ title: 'N1', start: '2026-10-01', allDay: true }),
      ev({ title: 'N2', start: '2026-10-02', allDay: true }),
      ev({ title: 'A', start: '2026-10-14T18:00:00+03:00' }),
      ev({ title: 'B', start: '2026-10-15T19:00:00+03:00' }),
    ], TODAY);
    const limited = limitGroups(groups, 1);
    expect(limited.groups[0].ongoing).toHaveLength(2);
    expect(limited.groups[0].items.map((i) => i.event.title)).toEqual(['A']);
    expect(limited.hasMore).toBe(true);
    expect(limitGroups(groups, 2).hasMore).toBe(false);
  });
});

describe('sarja-avain', () => {
  it('eri kaupungit eivät yhdisty, saman paikan kirjainkoko ei erota', () => {
    const g = (events: Event[]) => buildDayGroups(events, TODAY).flatMap((x) => x.items);
    expect(g([
      ev({ title: 'Konsertti', city: 'Jyväskylä', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'Konsertti', city: 'Äänekoski', start: '2026-10-16T19:00:00+03:00' }),
    ])).toHaveLength(2);
    expect(g([
      ev({ title: 'Peter Pan', venue: 'Teatteri', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'Peter Pan', venue: 'TEATTERI', start: '2026-10-16T19:00:00+03:00' }),
    ])).toHaveLength(1);
  });
});
