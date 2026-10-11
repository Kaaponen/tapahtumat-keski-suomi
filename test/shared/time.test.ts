import { describe, expect, it } from 'vitest';
import {
  addDays, dayKey, finnishWeekday, helsinkiIso, inferYear, isDateOnly, isValidDate, isoDate, localTime,
  lastDayKey, parseDurationMinutes, parseFinnishDate, parseTimes,
} from '../../src/shared/time';

describe('helsinkiIso', () => {
  it('käyttää kesäajan offsetia lokakuun alussa', () => {
    expect(helsinkiIso(2026, 10, 11, 19, 0)).toBe('2026-10-11T19:00:00+03:00');
  });
  it('käyttää talviajan offsetia joulukuussa', () => {
    expect(helsinkiIso(2026, 12, 18, 17, 5)).toBe('2026-12-18T17:05:00+02:00');
  });
});

describe('dayKey', () => {
  it('palauttaa Helsingin päivän UTC-ajasta (keskiyön yli)', () => {
    expect(dayKey('2026-10-11T22:30:00.000Z')).toBe('2026-10-12');
  });
  it('palauttaa pelkän päivämäärän sellaisenaan', () => {
    expect(dayKey('2026-10-11')).toBe('2026-10-11');
  });
});

describe('localTime', () => {
  it('palauttaa Helsingin kellonajan', () => {
    expect(localTime('2026-10-11T16:00:00.000Z')).toBe('19:00');
  });
  it('palauttaa keskiyön muodossa 00:00', () => {
    expect(localTime('2026-10-11T21:00:00.000Z')).toBe('00:00');
  });
  it('palauttaa null pelkälle päivämäärälle', () => {
    expect(localTime('2026-10-11')).toBeNull();
  });
});

describe('apufunktiot', () => {
  it('isoDate ja isDateOnly', () => {
    expect(isoDate(2026, 1, 5)).toBe('2026-01-05');
    expect(isDateOnly('2026-01-05')).toBe(true);
    expect(isDateOnly('2026-01-05T10:00:00Z')).toBe(false);
  });
  it('addDays ylittää vuodenvaihteen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('parseFinnishDate', () => {
  it('lukee päivämäärän tekstin keskeltä', () => {
    expect(parseFinnishDate('31.1.2027 klo 16.00')).toEqual({ y: 2027, m: 1, d: 31 });
    expect(parseFinnishDate('04.10.2026')).toEqual({ y: 2026, m: 10, d: 4 });
  });
  it('palauttaa null, jos vuotta ei ole', () => {
    expect(parseFinnishDate('16.10.')).toBeNull();
  });
});

describe('parseTimes', () => {
  it.each([
    ['Klo 20.00 alkaen', { start: [20, 0], end: undefined }],
    ['Ovet 19.30', { start: [19, 30], end: undefined }],
    ['21:00', { start: [21, 0], end: undefined }],
    ['18 - 20', { start: [18, 0], end: [20, 0] }],
    ['08.00-16.00', { start: [8, 0], end: [16, 0] }],
    ['', { start: undefined, end: undefined }],
  ])('%s', (input, expected) => {
    expect(parseTimes(input)).toEqual(expected);
  });
});

describe('parseDurationMinutes', () => {
  it.each([
    ['noin 2h 15 min', 135],
    ['1 h 30 min', 90],
    ['n. 90 min', 90],
    ['2 h', 120],
    ['', undefined],
  ])('%s', (input, expected) => {
    expect(parseDurationMinutes(input)).toBe(expected);
  });
});

describe('lastDayKey', () => {
  it('keskiyöhön päättyvä aikatapahtuma jää alkupäivälle', () => {
    expect(lastDayKey({ start: '2026-10-12T22:00:00+03:00', end: '2026-10-13T00:00:00+03:00' })).toBe('2026-10-12');
    expect(lastDayKey({ start: '2026-10-12T22:00:00+03:00', end: '2026-10-13T00:30:00+03:00' })).toBe('2026-10-13');
    expect(lastDayKey({ start: '2026-10-12T22:00:00+03:00' })).toBe('2026-10-12');
    expect(lastDayKey({ start: '2026-10-12T22:00:00+03:00', end: '2026-10-12T22:00:00+03:00' })).toBe('2026-10-12');
    expect(lastDayKey({ start: '2026-10-04', end: '2026-11-01', allDay: true })).toBe('2026-11-01');
  });
});

describe('inferYear', () => {
  it('tuleva päivä on kuluvaa vuotta', () => {
    expect(inferYear(10, 16, '2026-10-11')).toBe(2026);
  });
  it('lähimenneisyys pysyy kuluvana vuonna (suodatetaan myöhemmin pois)', () => {
    expect(inferYear(9, 25, '2026-10-11')).toBe(2026);
  });
  it('yli 60 päivää mennyt päivä on ensi vuotta', () => {
    expect(inferYear(1, 15, '2026-10-11')).toBe(2027);
  });
  it('raja: tasan 60 päivää sitten on kuluvaa vuotta, 61 päivää ensi vuotta', () => {
    expect(inferYear(8, 12, '2026-10-11')).toBe(2026);
    expect(inferYear(8, 11, '2026-10-11')).toBe(2027);
  });
  it('joulukuussa tammikuun päivä on ensi vuotta', () => {
    expect(inferYear(1, 5, '2026-12-20')).toBe(2027);
    expect(inferYear(12, 1, '2026-12-20')).toBe(2026);
  });
  it('tammikuussa joulukuun loppu on edellistä vuotta', () => {
    expect(inferYear(12, 28, '2027-01-10')).toBe(2026);
    expect(inferYear(1, 20, '2027-01-10')).toBe(2027);
  });
});

describe('inferYear viikonpäivällä', () => {
  it('mennyt päivä pysyy menneenä, kun viikonpäivä täsmää (ei haamuesitystä ensi vuodelle)', () => {
    expect(inferYear(9, 25, '2026-12-01', 5)).toBe(2026);
    expect(inferYear(9, 25, '2026-12-01')).toBe(2027);
  });
  it('tuleva päivä löytyy viikonpäivän avulla', () => {
    expect(inferYear(1, 15, '2026-10-11', 5)).toBe(2027);
  });
  it('ristiriitainen viikonpäivä palaa tavalliseen päättelyyn', () => {
    expect(inferYear(10, 16, '2026-10-11', 0)).toBe(2026);
  });
});

describe('finnishWeekday ja isValidDate', () => {
  it('lyhenne -> viikonpäivän numero (su = 0)', () => {
    expect(finnishWeekday('pe')).toBe(5);
    expect(finnishWeekday('Su')).toBe(0);
    expect(finnishWeekday('xx')).toBeUndefined();
  });
  it('tunnistaa mahdottomat päivämäärät', () => {
    expect(isValidDate(2027, 2, 31)).toBe(false);
    expect(isValidDate(2027, 13, 1)).toBe(false);
    expect(isValidDate(2028, 2, 29)).toBe(true);
  });
});
