import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { applyFilters, filtersFromSearch, filtersToSearch, mainVenue, rangeBounds } from '../../src/web/logic/filters';

const ev = (p: Partial<Event> & Pick<Event, 'title' | 'start'>): Event => ({
  id: p.title, allDay: false, url: 'u', categories: ['Muut'], sources: [], ...p,
});
const TODAY = '2026-10-14'; // keskiviikko

describe('URL-tila', () => {
  it('kulkee edestakaisin', () => {
    const f = { range: 'custom' as const, from: '2026-10-20', to: '2026-10-25', category: 'Musiikki', q: 'rock' };
    expect(filtersFromSearch('?' + filtersToSearch(f))).toEqual(f);
  });
  it('tuntematon aikaväli on "all" eikä oletusarvoja kirjoiteta', () => {
    expect(filtersFromSearch('?range=xyz')).toEqual({ range: 'all' });
    expect(filtersToSearch({ range: 'all' })).toBe('');
  });
});

describe('rangeBounds', () => {
  it.each([
    ['today', TODAY, [TODAY, TODAY]],
    ['week', TODAY, [TODAY, '2026-10-20']],
    ['weekend', TODAY, ['2026-10-16', '2026-10-18']],
    ['weekend', '2026-10-17', ['2026-10-17', '2026-10-18']],
    ['weekend', '2026-10-18', ['2026-10-18', '2026-10-18']],
  ] as const)('%s @ %s', (range, today, expected) => {
    expect(rangeBounds({ range }, today)).toEqual(expected);
  });
  it('all = ei rajausta', () => {
    expect(rangeBounds({ range: 'all' }, TODAY)).toBeNull();
  });
});

describe('applyFilters', () => {
  const events = [
    ev({ title: 'Rock-ilta', start: '2026-10-14T20:00:00+03:00', categories: ['Musiikki'], venue: 'Lutakko' }),
    ev({ title: 'Näyttely', start: '2026-10-01', end: '2026-11-01', allDay: true, categories: ['Näyttelyt'] }),
    ev({ title: 'Ensi viikko', start: '2026-10-22T18:00:00+03:00' }),
    ev({ title: 'Mennyt', start: '2026-10-10T18:00:00+03:00' }),
  ];
  it('tänään sisältää käynnissä olevan näyttelyn mutta ei menneitä', () => {
    expect(applyFilters(events, { range: 'today' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta', 'Näyttely']);
  });
  it('kategoria, paikka ja haku', () => {
    expect(applyFilters(events, { range: 'all', category: 'Musiikki' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta']);
    expect(applyFilters(events, { range: 'all', venue: 'Lutakko' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta']);
    expect(applyFilters(events, { range: 'all', q: 'NÄYTT' }, TODAY).map((e) => e.title)).toEqual(['Näyttely']);
  });
});

describe('venue-suodatin', () => {
  it('päätila kattaa salit', () => {
    const events = [
      ev({ title: 'a', venue: 'Paviljonki – Encore-sali', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'b', venue: 'Paviljonki', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'c', venue: 'Peurunka', start: '2026-10-15T19:00:00+03:00' }),
    ];
    expect(applyFilters(events, { range: 'all', venue: 'Paviljonki' }, TODAY).map((e) => e.title)).toEqual(['a', 'b']);
    expect(mainVenue('Paviljonki – Encore-sali')).toBe('Paviljonki');
    expect(mainVenue(undefined)).toBeUndefined();
  });
  it('keskiyöhön päättyvä tapahtuma ei ole seuraavan päivän käynnissä', () => {
    const e = ev({ title: 'y', start: '2026-10-13T22:00:00+03:00', end: '2026-10-14T00:00:00+03:00' });
    expect(applyFilters([e], { range: 'all' }, TODAY)).toEqual([]);
  });
});
