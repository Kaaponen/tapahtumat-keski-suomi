import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SOURCES } from '../sources';
import type { IdRegistry } from '../dedupe/ids';
import type { EventsFile, RawEvent, RecentPastFile } from '../shared/types';
import { createFetchContext } from './http';
import { failingSources, runScrape } from './run';

const OUT = 'public/events.json';
const IDS = 'data/ids.json';
const PAST = 'public/recent-past.json';
const RAW_DIR = 'data/raw';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

const { file: result, ids, recentPast } = await runScrape({
  sources: SOURCES,
  ctx: createFetchContext(),
  now: new Date(),
  previous: await readJson<EventsFile>(OUT),
  previousIds: await readJson<IdRegistry>(IDS),
  previousPast: await readJson<RecentPastFile>(PAST),
  readRaw: (id) => readJson<RawEvent[]>(`${RAW_DIR}/${id}.json`),
  writeRaw: async (id, events) => {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${id}.json`, JSON.stringify(events, null, 1));
  },
});

await mkdir('public', { recursive: true });
await mkdir('data', { recursive: true });
await writeFile(OUT, JSON.stringify(result));
await writeFile(PAST, JSON.stringify(recentPast));
await writeFile(IDS, JSON.stringify(ids, null, 1));
console.log(`Valmis: ${result.events.length} tapahtumaa -> ${OUT}`);

const failing = failingSources(result);
if (failing.length) console.log(`Toistuvasti epäonnistuvat lähteet: ${failing.join(', ')}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failing=${failing.join(' ')}\n`);
