import { addDays, dayKey, isDateOnly, localTime } from '../../shared/time';
import type { Event } from '../../shared/types';

const WEEKDAYS = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];

export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d}.${m}.`;
}

export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Tänään';
  if (day === addDays(today, 1)) return 'Huomenna';
  return `${WEEKDAYS[weekday(day)]} ${shortDate(day)}`;
}

const hm = (iso: string) => localTime(iso)!.replace(':', '.');

export function formatTime(e: Event): string {
  const startDay = dayKey(e.start);
  const endDay = e.end ? dayKey(e.end) : startDay;
  if (e.allDay) return startDay === endDay ? 'Koko päivä' : `${shortDate(startDay)}–${shortDate(endDay)}`;
  if (!e.end || isDateOnly(e.end)) return hm(e.start);
  if (endDay === startDay) return `${hm(e.start)}–${hm(e.end)}`;
  return `${hm(e.start)} (päättyy ${shortDate(endDay)})`;
}

export function seriesSummary(series: Event[]): string {
  const first = dayKey(series[0].start);
  const last = dayKey(series[series.length - 1].start);
  return `${series.length} esitystä ${shortDate(first)}–${shortDate(last)}`;
}

export function formatAge(iso: string, now: Date): string {
  const minutes = (now.getTime() - Date.parse(iso)) / 60_000;
  if (minutes < 60) return 'juuri äsken';
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} t sitten`;
  return `${Math.floor(minutes / (24 * 60))} pv sitten`;
}
