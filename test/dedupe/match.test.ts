import { describe, expect, it } from 'vitest';
import { groupDuplicates, isSameEvent, titleSimilarity } from '../../src/dedupe/match';
import { normalizeEvent } from '../../src/dedupe/normalize';
import { DEDUPE_CASES, raw } from '../dedupe.cases';

describe('isSameEvent', () => {
  it.each(DEDUPE_CASES)('$name → $same', ({ a, b, same }) => {
    expect(isSameEvent(normalizeEvent(a), normalizeEvent(b))).toBe(same);
    expect(isSameEvent(normalizeEvent(b), normalizeEvent(a))).toBe(same);
  });
});

describe('titleSimilarity', () => {
  it('identtiset = 1, täysin eri = 0', () => {
    expect(titleSimilarity('peter pan', 'peter pan')).toBe(1);
    expect(titleSimilarity('peter pan', 'joulukonsertti')).toBeLessThan(0.3);
  });
  it('kirjoitusvirhe pysyy korkeana', () => {
    expect(titleSimilarity('kotipelto ahola voices unleashed', 'kotipelto ahola voices unleshed')).toBeGreaterThanOrEqual(0.85);
  });
});

describe('groupDuplicates', () => {
  it('pelkän päivämäärän tapahtuma ei liimaa kahta esitystä yhteen', () => {
    const venue = 'Jyväskylän kaupunginteatteri';
    const events = [
      raw({ source: 'keikkalista', title: 'Peter Pan', start: '2026-11-14', allDay: true, venue }),
      raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue }),
      raw({ title: 'Peter Pan', start: '2026-11-14T19:00:00+02:00', venue }),
    ].map(normalizeEvent);
    const groups = groupDuplicates(events);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 2]);
  });

  it('yhdistää kolmen lähteen saman tapahtuman', () => {
    const events = [
      raw({ source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00', venue: 'Paviljonki' }),
      raw({ source: 'keikkalista', title: 'Haloo Helsinki!', start: '2026-11-20', allDay: true, venue: 'Paviljonki' }),
      raw({ title: 'Haloo Helsinki! – Kevätkiertue 2027', start: '2026-11-20T17:00:00.000Z', venue: 'Jyväskylän Paviljonki' }),
    ].map(normalizeEvent);
    expect(groupDuplicates(events)).toHaveLength(1);
  });
});

describe('tyhjät nimet', () => {
  it('nimeä ilman merkitseviä merkkejä ei yhdistetä', () => {
    const a = normalizeEvent(raw({ title: 'K18', start: '2026-11-08T12:00:00+02:00' }));
    const b = normalizeEvent(raw({ title: 'K16', start: '2026-11-08T12:00:00+02:00' }));
    expect(isSameEvent(a, b)).toBe(false);
  });
  it('yhden merkin nimet eivät yhdisty pelkän bigrammityhjyyden takia', () => {
    expect(titleSimilarity('a', 'b')).toBe(0);
  });
});
