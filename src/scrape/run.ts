import { dedupe } from '../dedupe/merge';
import { addDays, dayKey, lastDayKey } from '../shared/time';
import type { EventsFile, FetchContext, RawEvent, Source, SourceStatus } from '../shared/types';

export const WINDOW_DAYS = 183;
const FAILURE_ALERT_THRESHOLD = 3;
const ZERO_RESULT_GUARD = 5;

export interface RunDeps {
  sources: Source[];
  ctx: FetchContext;
  now: Date;
  previous: EventsFile | null;
  readRaw(id: string): Promise<RawEvent[] | null>;
  writeRaw(id: string, events: RawEvent[]): Promise<void>;
}

export function filterWindow(events: RawEvent[], now: Date, days = WINDOW_DAYS): RawEvent[] {
  const today = dayKey(now.toISOString());
  const last = addDays(today, days);
  return events.filter((e) => lastDayKey(e) >= today && dayKey(e.start) <= last);
}

export async function runScrape(d: RunDeps): Promise<EventsFile> {
  const all: RawEvent[] = [];
  const sources: Record<string, SourceStatus> = {};

  for (const src of d.sources) {
    const prev = d.previous?.sources[src.id];
    try {
      const events = await src.fetch(d.ctx);
      if (events.length === 0 && (prev?.count ?? 0) > ZERO_RESULT_GUARD) {
        throw new Error(`Lähde palautti 0 tapahtumaa (edellisellä kerralla ${prev!.count})`);
      }
      await d.writeRaw(src.id, events);
      all.push(...events);
      sources[src.id] = {
        name: src.name, lastSuccess: d.now.toISOString(), lastError: null, consecutiveFailures: 0, count: events.length,
      };
      d.ctx.log(`${src.id}: ${events.length} tapahtumaa`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fallback = (await d.readRaw(src.id)) ?? [];
      all.push(...fallback);
      sources[src.id] = {
        name: src.name,
        lastSuccess: prev?.lastSuccess ?? null,
        lastError: message,
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
        count: prev?.count ?? fallback.length,
      };
      d.ctx.log(`${src.id}: VIRHE ${message} – käytetään ${fallback.length} tallennettua tapahtumaa`);
    }
  }

  return { generatedAt: d.now.toISOString(), sources, events: dedupe(filterWindow(all, d.now)) };
}

export function failingSources(file: EventsFile): string[] {
  return Object.entries(file.sources)
    .filter(([, s]) => s.consecutiveFailures >= FAILURE_ALERT_THRESHOLD)
    .map(([id]) => id);
}
