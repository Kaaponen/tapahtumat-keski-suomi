import { resolveIds } from '../shared/aliases';
import type { Event } from '../shared/types';
import { mainVenue } from '../shared/venue';

export interface FeedPrefs {
  starred: string[];
  venues: string[];
}

export interface EventsBundle {
  upcoming: Event[];
  past: Event[];
  aliases: Record<string, string>;
}

/** Tähdellä merkityt tai seurattujen paikkojen tapahtumat (tulevat + menneet), uniikit ja alkuajan mukaan. */
export function selectFeedEvents(bundle: EventsBundle, prefs: FeedPrefs): Event[] {
  const starred = new Set(resolveIds(prefs.starred, bundle.aliases));
  const venues = new Set(prefs.venues);
  const byId = new Map<string, Event>();
  // Menneet ensin, jotta saman tunnisteen tuleva kopio korvaa menneen.
  for (const e of [...bundle.past, ...bundle.upcoming]) {
    const venue = mainVenue(e.venue);
    if (starred.has(e.id) || (venue !== undefined && venues.has(venue))) byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => a.start.localeCompare(b.start));
}
