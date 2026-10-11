import { addDays, dayKey, isDateOnly } from '../../shared/time';
import type { Event } from '../../shared/types';

export const DEFAULT_DURATION_MS = 2 * 3600_000;
const MAX_DETAILS = 1500;

export type EventTimes =
  | { allDay: true; startDay: string; endDayExclusive: string }
  | { allDay: false; start: Date; end: Date };

export function eventTimes(e: Event): EventTimes {
  if (e.allDay) {
    const startDay = dayKey(e.start);
    const lastDay = e.end ? dayKey(e.end) : startDay;
    return { allDay: true, startDay, endDayExclusive: addDays(lastDay < startDay ? startDay : lastDay, 1) };
  }
  const start = new Date(e.start);
  let end = e.end && !isDateOnly(e.end) ? new Date(e.end) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { allDay: false, start, end };
}

export function eventDetails(e: Event): string {
  return [e.description, e.ticketUrl ? `Liput: ${e.ticketUrl}` : '', e.url]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_DETAILS);
}

export function eventLocation(e: Event): string {
  const parts = [e.venue, e.address];
  if (e.city && !(e.address ?? '').includes(e.city)) parts.push(e.city);
  return parts.filter(Boolean).join(', ');
}

/** 2026-11-20T17:00:00.000Z -> 20261120T170000Z */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export const compactDay = (day: string) => day.replace(/-/g, '');
