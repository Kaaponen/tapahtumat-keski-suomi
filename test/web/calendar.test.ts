import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { eventLocation, eventTimes } from '../../src/web/calendar/common';
import { googleCalendarUrl } from '../../src/web/calendar/google';
import { buildIcs, escapeIcs, foldLine, icsFileName } from '../../src/web/calendar/ics';
import { outlookCalendarUrl } from '../../src/web/calendar/outlook';

const base: Event = {
  id: 'abc123def456',
  title: 'Haloo Helsinki!',
  start: '2026-11-20T19:00:00+02:00',
  end: '2026-11-20T21:30:00+02:00',
  allDay: false,
  venue: 'Paviljonki',
  address: 'Lutakonaukio 12',
  city: 'Jyväskylä',
  url: 'https://pav/1',
  ticketUrl: 'https://lippu.fi/1',
  description: 'Rock, pop; ja muuta.\nToinen rivi',
  categories: ['Musiikki'],
  sources: [{ source: 'paviljonki', url: 'https://pav/1' }],
};

describe('eventTimes', () => {
  it('käyttää 2 tunnin oletuskestoa, jos loppuaika puuttuu', () => {
    const t = eventTimes({ ...base, end: undefined });
    expect(t.allDay).toBe(false);
    if (!t.allDay) expect(t.end.getTime() - t.start.getTime()).toBe(2 * 3600_000);
  });
  it('korjaa loppuajan, joka on ennen alkua', () => {
    const t = eventTimes({ ...base, end: '2026-11-20T18:00:00+02:00' });
    if (!t.allDay) expect(t.end.getTime() - t.start.getTime()).toBe(2 * 3600_000);
  });
  it('koko päivän tapahtuma: loppupäivä on poissulkeva', () => {
    expect(eventTimes({ ...base, allDay: true, start: '2026-10-04', end: '2026-11-01' }))
      .toEqual({ allDay: true, startDay: '2026-10-04', endDayExclusive: '2026-11-02' });
  });
});

describe('eventLocation', () => {
  it('yhdistää paikan, osoitteen ja kaupungin', () => {
    expect(eventLocation(base)).toBe('Paviljonki, Lutakonaukio 12, Jyväskylä');
  });
  it('ei toista kaupunkia, jos osoite sisältää sen', () => {
    expect(eventLocation({ ...base, address: 'Asemakatu 7, 40100 Jyväskylä' })).toBe('Paviljonki, Asemakatu 7, 40100 Jyväskylä');
  });
});

describe('googleCalendarUrl', () => {
  it('muodostaa valmiin tapahtuman linkin UTC-ajoilla', () => {
    const url = new URL(googleCalendarUrl(base));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Haloo Helsinki!');
    expect(url.searchParams.get('dates')).toBe('20261120T170000Z/20261120T193000Z');
    expect(url.searchParams.get('location')).toBe('Paviljonki, Lutakonaukio 12, Jyväskylä');
    expect(url.searchParams.get('details')).toContain('https://lippu.fi/1');
  });
  it('koko päivän tapahtuma päivämäärinä', () => {
    const url = new URL(googleCalendarUrl({ ...base, allDay: true, start: '2026-11-20', end: undefined }));
    expect(url.searchParams.get('dates')).toBe('20261120/20261121');
  });
});

describe('outlookCalendarUrl', () => {
  it('muodostaa compose-linkin', () => {
    const url = new URL(outlookCalendarUrl(base));
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url.searchParams.get('subject')).toBe('Haloo Helsinki!');
    expect(url.searchParams.get('startdt')).toBe('2026-11-20T17:00:00.000Z');
    expect(url.searchParams.get('enddt')).toBe('2026-11-20T19:30:00.000Z');
  });
  it('koko päivän tapahtuma', () => {
    const url = new URL(outlookCalendarUrl({ ...base, allDay: true, start: '2026-11-20', end: undefined }));
    expect(url.searchParams.get('allday')).toBe('true');
    expect(url.searchParams.get('startdt')).toBe('2026-11-20');
    expect(url.searchParams.get('enddt')).toBe('2026-11-21');
  });
});

describe('ics', () => {
  it('escapeIcs käsittelee erikoismerkit', () => {
    expect(escapeIcs('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('foldLine pitää rivit enintään 75 tavussa myös monitavuisilla merkeillä', () => {
    const folded = foldLine('DESCRIPTION:' + 'ä'.repeat(100));
    const enc = new TextEncoder();
    for (const line of folded.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + 'ä'.repeat(100));
  });

  it('buildIcs tuottaa kelvollisen VEVENTin', () => {
    const ics = buildIcs(base, new Date('2026-10-11T06:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc123def456@tapahtumat');
    expect(ics).toContain('DTSTAMP:20261011T060000Z');
    expect(ics).toContain('DTSTART:20261120T170000Z');
    expect(ics).toContain('DTEND:20261120T193000Z');
    expect(ics).toContain('SUMMARY:Haloo Helsinki!');
    expect(ics).toContain('LOCATION:Paviljonki\\, Lutakonaukio 12\\, Jyväskylä');
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('buildIcs koko päivän tapahtumalle', () => {
    const ics = buildIcs({ ...base, allDay: true, start: '2026-11-20', end: undefined });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261120');
    expect(ics).toContain('DTEND;VALUE=DATE:20261121');
  });

  it('icsFileName', () => {
    expect(icsFileName({ ...base, title: 'Äänekäs Ilta: Rock & Pop!' })).toBe('aanekas-ilta-rock-pop.ics');
  });
});
