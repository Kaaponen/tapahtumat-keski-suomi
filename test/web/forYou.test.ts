import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { forYou } from '../../src/web/logic/forYou';

const ev = (p: Partial<Event> & Pick<Event, 'id'>): Event => ({
  title: p.id, start: '2026-10-15T19:00:00+03:00', allDay: false, url: 'u', categories: ['Muut'], sources: [], ...p,
});
const prefs = (p: Partial<{ homeCity: string | null; favoriteCategories: string[]; followedVenues: { venue: string; inCalendar: boolean }[] }> = {}) => ({
  homeCity: 'Jyväskylä', favoriteCategories: [] as string[], followedVenues: [] as { venue: string; inCalendar: boolean }[], ...p,
});
const ids = (l: Event[]) => l.map((e) => e.id);

describe('forYou', () => {
  it('ottaa tähdellä merkityn toiselta paikkakunnalta', () => {
    const e = ev({ id: 'a', city: 'Tampere' });
    expect(ids(forYou([e], prefs(), new Set(['a'])))).toEqual(['a']);
    expect(forYou([e], prefs(), new Set())).toEqual([]);
  });
  it('ottaa seuratun paikan toiselta paikkakunnalta', () => {
    const e = ev({ id: 'a', city: 'Tampere', venue: 'Tampere-talo – Sali' });
    const p = prefs({ followedVenues: [{ venue: 'Tampere-talo', inCalendar: false }] });
    expect(ids(forYou([e], p, new Set()))).toEqual(['a']);
  });
  it('ottaa suosikkikategorian vain kotipaikkakunnalta', () => {
    const home = ev({ id: 'h', city: 'Jyväskylä', categories: ['Musiikki'] });
    const away = ev({ id: 'x', city: 'Tampere', categories: ['Musiikki'] });
    const other = ev({ id: 'o', city: 'Jyväskylä', categories: ['Urheilu'] });
    expect(ids(forYou([home, away, other], prefs({ favoriteCategories: ['Musiikki'] }), new Set()))).toEqual(['h']);
  });
  it('väliaikainen paikkakunta korvaa kotipaikkakunnan', () => {
    const home = ev({ id: 'h', city: 'Jyväskylä', categories: ['Musiikki'] });
    const away = ev({ id: 'x', city: 'Tampere', categories: ['Musiikki'] });
    expect(ids(forYou([home, away], prefs({ favoriteCategories: ['Musiikki'] }), new Set(), 'Tampere'))).toEqual(['x']);
  });
  it('ilman kotipaikkakuntaa kategoria koskee kaikkia', () => {
    const a = ev({ id: 'a', city: 'Jyväskylä', categories: ['Musiikki'] });
    const b = ev({ id: 'b', city: 'Tampere', categories: ['Musiikki'] });
    expect(ids(forYou([a, b], prefs({ homeCity: null, favoriteCategories: ['Musiikki'] }), new Set()))).toEqual(['a', 'b']);
  });
});
