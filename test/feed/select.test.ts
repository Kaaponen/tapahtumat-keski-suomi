import { describe, expect, it } from 'vitest';
import { selectFeedEvents, type EventsBundle } from '../../src/feed/select';
import type { Event } from '../../src/shared/types';

const ev = (id: string, start: string, venue?: string): Event => ({
  id, title: id, start, allDay: false, venue, url: 'https://x', categories: [], sources: [],
});

const bundle = (over: Partial<EventsBundle> = {}): EventsBundle => ({
  upcoming: [], past: [], aliases: {}, ...over,
});

describe('selectFeedEvents', () => {
  it('ottaa tähdellä merkityt', () => {
    const b = bundle({ upcoming: [ev('a', '2026-12-01T10:00'), ev('b', '2026-12-02T10:00')] });
    expect(selectFeedEvents(b, { starred: ['b'], venues: [] }).map((e) => e.id)).toEqual(['b']);
  });
  it('ratkaisee vanhan tunnisteen aliaksen kautta', () => {
    const b = bundle({ upcoming: [ev('new', '2026-12-01T10:00')], aliases: { old: 'new' } });
    expect(selectFeedEvents(b, { starred: ['old'], venues: [] }).map((e) => e.id)).toEqual(['new']);
  });
  it('ottaa kalenteriin valitun paikan kaikki tapahtumat', () => {
    const b = bundle({ upcoming: [ev('a', '2026-12-01T10:00', 'Lutakko – Iso sali'), ev('b', '2026-12-02T10:00', 'Paviljonki')] });
    expect(selectFeedEvents(b, { starred: [], venues: ['Lutakko'] }).map((e) => e.id)).toEqual(['a']);
  });
  it('tähti ja seurattu paikka samassa tapahtumassa → kerran', () => {
    const b = bundle({ upcoming: [ev('a', '2026-12-01T10:00', 'Lutakko')] });
    expect(selectFeedEvents(b, { starred: ['a'], venues: ['Lutakko'] })).toHaveLength(1);
  });
  it('ottaa menneet tapahtumat mukaan', () => {
    const b = bundle({ upcoming: [ev('b', '2026-12-01T10:00')], past: [ev('a', '2026-11-01T10:00')] });
    expect(selectFeedEvents(b, { starred: ['a', 'b'], venues: [] }).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('sama tunniste menneissä ja tulevissa → tuleva kopio voittaa', () => {
    const b = bundle({ upcoming: [ev('a', '2026-12-09T10:00')], past: [ev('a', '2026-11-01T10:00')] });
    expect(selectFeedEvents(b, { starred: ['a'], venues: [] }).map((e) => e.start)).toEqual(['2026-12-09T10:00']);
  });
  it('ei ota muita tapahtumia', () => {
    const b = bundle({ upcoming: [ev('a', '2026-12-01T10:00', 'Muu')], past: [ev('c', '2026-11-01T10:00')] });
    expect(selectFeedEvents(b, { starred: ['x'], venues: ['Lutakko'] })).toEqual([]);
  });
});
