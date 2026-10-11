import type { Event } from '../../shared/types';
import { googleCalendarUrl } from '../calendar/google';
import { downloadIcs } from '../calendar/ics';
import { outlookCalendarUrl } from '../calendar/outlook';

export type CalendarKind = 'google' | 'outlook' | 'ics';

export const CALENDAR_LABELS: Record<CalendarKind, string> = {
  google: 'Google-kalenteri',
  outlook: 'Outlook',
  ics: 'Apple / muu (.ics)',
};

const KEY = 'tapahtumat.calendar';

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getCalendarPref(storage: Storage | null = defaultStorage()): CalendarKind | null {
  try {
    const v = storage?.getItem(KEY);
    return v && v in CALENDAR_LABELS ? (v as CalendarKind) : null;
  } catch {
    return null;
  }
}

export function setCalendarPref(kind: CalendarKind | null, storage: Storage | null = defaultStorage()): void {
  try {
    if (kind) storage?.setItem(KEY, kind);
    else storage?.removeItem(KEY);
  } catch {
    // Yksityinen selaustila tms. – valintaa ei muisteta, mutta mikään ei kaadu.
  }
}

export function addToCalendar(e: Event, kind: CalendarKind): void {
  if (kind === 'google') window.open(googleCalendarUrl(e), '_blank', 'noopener');
  else if (kind === 'outlook') window.open(outlookCalendarUrl(e), '_blank', 'noopener');
  else downloadIcs(e);
}
