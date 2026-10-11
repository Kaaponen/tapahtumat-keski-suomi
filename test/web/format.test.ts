import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { dayLabel, formatAge, formatTime, seriesSummary, shortDate } from '../../src/web/logic/format';

const ev = (p: Partial<Event> & Pick<Event, 'start'>): Event => ({
  id: 'x', title: 'x', allDay: false, url: 'u', categories: [], sources: [], ...p,
});

describe('format', () => {
  it('shortDate ja dayLabel', () => {
    expect(shortDate('2026-10-04')).toBe('4.10.');
    expect(dayLabel('2026-10-14', '2026-10-14')).toBe('Tänään');
    expect(dayLabel('2026-10-15', '2026-10-14')).toBe('Huomenna');
    expect(dayLabel('2026-10-17', '2026-10-14')).toBe('La 17.10.');
  });
  it('formatTime', () => {
    expect(formatTime(ev({ start: '2026-10-14T19:00:00+03:00' }))).toBe('19.00');
    expect(formatTime(ev({ start: '2026-10-14T19:00:00+03:00', end: '2026-10-14T21:30:00+03:00' }))).toBe('19.00–21.30');
    expect(formatTime(ev({ start: '2026-10-14T10:00:00+03:00', end: '2026-10-16T18:00:00+03:00' }))).toBe('10.00 (päättyy 16.10.)');
    expect(formatTime(ev({ start: '2026-10-14', allDay: true }))).toBe('Koko päivä');
    expect(formatTime(ev({ start: '2026-10-04', end: '2026-11-01', allDay: true }))).toBe('4.10.–1.11.');
  });
  it('seriesSummary', () => {
    expect(seriesSummary([ev({ start: '2026-10-15T19:00:00+03:00' }), ev({ start: '2026-11-30T19:00:00+02:00' })]))
      .toBe('2 esitystä 15.10.–30.11.');
  });
  it('formatAge', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(formatAge('2026-10-14T11:30:00Z', now)).toBe('juuri äsken');
    expect(formatAge('2026-10-14T07:00:00Z', now)).toBe('5 t sitten');
    expect(formatAge('2026-10-12T07:00:00Z', now)).toBe('2 pv sitten');
  });
});

describe('formatTime keskiyö', () => {
  it('päättyminen klo 00.00 pysyy samana päivänä', () => {
    expect(formatTime(ev({ start: '2026-10-12T22:00:00+03:00', end: '2026-10-13T00:00:00+03:00' }))).toBe('22.00–00.00');
  });
});
