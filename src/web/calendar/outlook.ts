import type { Event } from '../../shared/types';
import { eventDetails, eventLocation, eventTimes } from './common';

export function outlookCalendarUrl(e: Event): string {
  const t = eventTimes(e);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    body: eventDetails(e),
    location: eventLocation(e),
  });
  if (t.allDay) {
    params.set('startdt', t.startDay);
    params.set('enddt', t.endDayExclusive);
    params.set('allday', 'true');
  } else {
    params.set('startdt', t.start.toISOString());
    params.set('enddt', t.end.toISOString());
  }
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
