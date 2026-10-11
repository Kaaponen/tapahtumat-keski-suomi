import type { Event } from '../../shared/types';
import { compactDay, eventDetails, eventLocation, eventTimes, utcStamp } from './common';

export function googleCalendarUrl(e: Event): string {
  const t = eventTimes(e);
  const dates = t.allDay
    ? `${compactDay(t.startDay)}/${compactDay(t.endDayExclusive)}`
    : `${utcStamp(t.start)}/${utcStamp(t.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    details: eventDetails(e),
    location: eventLocation(e),
    ctz: 'Europe/Helsinki',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
