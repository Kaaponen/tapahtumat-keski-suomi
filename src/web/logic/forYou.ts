import type { Event } from '../../shared/types';
import { mainVenue } from '../../shared/venue';
import type { UserData } from '../account/types';

/** "Sinulle"-näkymän tapahtumat: tähdet ja seuratut paikat kaikilta paikkakunnilta, suosikkikategoriat valitulta paikkakunnalta. */
export function forYou(
  events: Event[],
  prefs: Pick<UserData, 'homeCity' | 'favoriteCategories' | 'followedVenues'>,
  stars: Set<string>,
  city?: string,
): Event[] {
  const followed = new Set(prefs.followedVenues.map((v) => v.venue));
  const categories = new Set(prefs.favoriteCategories);
  const cityScope = city ?? prefs.homeCity ?? undefined;
  return events.filter((e) => {
    if (stars.has(e.id)) return true;
    const venue = mainVenue(e.venue);
    if (venue && followed.has(venue)) return true;
    return e.categories.some((c) => categories.has(c)) && (!cityScope || e.city === cityScope);
  });
}
