import { describe, expect, it } from 'vitest';
import { normalizeEvent, normalizeTitle } from '../../src/dedupe/normalize';
import { venueKey } from '../../src/dedupe/venues';

describe('normalizeTitle', () => {
  it.each([
    ['Benjamin Locker Room Tour K18', 'benjamin locker room tour'],
    ['Benjamin: Locker Room Tour (K-18)', 'benjamin locker room tour'],
    ['Kotipelto & Ahola – LOPPUUNMYYTY', 'kotipelto ahola'],
    ['Haloo Helsinki! Jyväskylässä', 'haloo helsinki'],
    ['Rival Tree / KAPPAS', 'rival tree kappas'],
    ['Pikkujoulut Peurungassa', 'pikkujoulut'],
  ])('%s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });
});

describe('venueKey', () => {
  it.each([
    ['Jyväskylän Paviljonki', 'paviljonki'],
    ['Paviljonki – Encore-sali', 'paviljonki'],
    ['Peurunka – Pub', 'peurunka'],
    ['Tanssisali Lutakko', 'lutakko'],
    ['RockNeck Jyväskylä', 'rockneck'],
    ['Jyväskylän kirkkopuisto', 'kirkkopuisto'],
    ['Kirkkopuisto, Jyväskylä', 'kirkkopuisto'],
  ])('%s', (input, expected) => {
    expect(venueKey(input)).toBe(expected);
  });
  it('palauttaa undefined tyhjälle', () => {
    expect(venueKey(undefined)).toBeUndefined();
    expect(venueKey('  ')).toBeUndefined();
  });
});

describe('normalizeEvent', () => {
  it('laskee päivän ja kellonajan Helsingin ajassa', () => {
    const n = normalizeEvent({
      source: 's', sourceId: '1', title: 'Yökeikka', start: '2026-10-11T22:30:00.000Z', url: 'u',
    });
    expect(n).toMatchObject({ nTitle: 'yökeikka', day: '2026-10-12', time: '01:30' });
  });
  it('koko päivän tapahtumalla ei ole kellonaikaa', () => {
    const n = normalizeEvent({
      source: 's', sourceId: '1', title: 'Näyttely', start: '2026-10-11T10:00:00+03:00', allDay: true, url: 'u',
    });
    expect(n.time).toBeNull();
  });
});
