import { emptyRegistry, type IdRegistry } from '../dedupe/ids';
import { dedupeWithIds } from '../dedupe/merge';
import { PAST_DAYS } from '../shared/retention';
import { addDays, dayKey, lastDayKey } from '../shared/time';
import type { Event, EventsFile, FetchContext, RawEvent, RecentPastFile, Source, SourceStatus } from '../shared/types';

export const WINDOW_DAYS = 183;
const FAILURE_ALERT_THRESHOLD = 3;
const ZERO_RESULT_GUARD = 5;

export interface RunDeps {
  sources: Source[];
  ctx: FetchContext;
  now: Date;
  previous: EventsFile | null;
  previousIds: IdRegistry | null;
  previousPast: RecentPastFile | null;
  readRaw(id: string): Promise<RawEvent[] | null>;
  writeRaw(id: string, events: RawEvent[]): Promise<void>;
}

export function filterWindow(events: RawEvent[], now: Date, days = WINDOW_DAYS): RawEvent[] {
  const today = dayKey(now.toISOString());
  const last = addDays(today, days);
  return events.filter((e) => lastDayKey(e) >= today && dayKey(e.start) <= last);
}

function resolveAlias(aliases: Record<string, string>, id: string): string {
  const seen = new Set<string>();
  while (aliases[id] && !seen.has(id)) {
    seen.add(id);
    id = aliases[id];
  }
  return id;
}

function buildRecentPast(d: RunDeps, today: string, aliases: Record<string, string>): RecentPastFile {
  const cutoff = addDays(today, -PAST_DAYS);
  const ended = (d.previous?.events ?? []).filter((e) => lastDayKey(e) < today);
  const byId = new Map<string, Event>();
  // Myöhempi korvaa aiemman: tuoreimmat (edellisestä events.json:sta) voittavat.
  for (const e of [...(d.previousPast?.events ?? []), ...ended]) {
    const id = resolveAlias(aliases, e.id);
    byId.set(id, { ...e, id });
  }
  const events = [...byId.values()]
    .filter((e) => lastDayKey(e) >= cutoff)
    .sort((a, b) => a.start.localeCompare(b.start));
  return { generatedAt: d.now.toISOString(), events };
}

export async function runScrape(
  d: RunDeps,
): Promise<{ file: EventsFile; ids: IdRegistry; recentPast: RecentPastFile }> {
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

  const today = dayKey(d.now.toISOString());
  const { events, registry } = dedupeWithIds(filterWindow(all, d.now), d.previousIds ?? emptyRegistry(), today);
  const file: EventsFile = { generatedAt: d.now.toISOString(), sources, events, aliases: registry.aliases };
  return { file, ids: registry, recentPast: buildRecentPast(d, today, registry.aliases) };
}

export function failingSources(file: EventsFile): string[] {
  return Object.entries(file.sources)
    .filter(([, s]) => s.consecutiveFailures >= FAILURE_ALERT_THRESHOLD)
    .map(([id]) => id);
}
