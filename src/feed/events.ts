import type { EventsFile, RecentPastFile } from '../shared/types';
import type { EventsBundle } from './select';

export interface EventsCacheOptions {
  baseUrl: string;
  ttlMs: number;
  fetchFn?: typeof fetch;
  now?: () => number;
}

/** Hakee events.json + recent-past.json TTL-välimuistilla; virhetilanteessa palauttaa vanhan datan. */
export function createEventsCache(opts: EventsCacheOptions): () => Promise<EventsBundle> {
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  let cached: { bundle: EventsBundle; at: number } | undefined;

  async function load(): Promise<EventsBundle> {
    const evRes = await fetchFn(`${opts.baseUrl}/events.json`);
    if (!evRes.ok) throw new Error(`events.json: HTTP ${evRes.status}`);
    const file = (await evRes.json()) as EventsFile;
    // recent-past.json puuttuu ennen keruun ensimmäistä ajoa → tyhjä menneisyys
    let past: RecentPastFile['events'] = [];
    const pastRes = await fetchFn(`${opts.baseUrl}/recent-past.json`);
    if (pastRes.ok) past = ((await pastRes.json()) as RecentPastFile).events ?? [];
    else if (pastRes.status !== 404) throw new Error(`recent-past.json: HTTP ${pastRes.status}`);
    return { upcoming: file.events, past, aliases: file.aliases ?? {} };
  }

  return async () => {
    if (cached && now() - cached.at < opts.ttlMs) return cached.bundle;
    try {
      cached = { bundle: await load(), at: now() };
    } catch (err) {
      if (!cached) throw err;
    }
    return cached.bundle;
  };
}
