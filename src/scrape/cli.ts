import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SOURCES } from '../sources';
import type { EventsFile, RawEvent } from '../shared/types';
import { createFetchContext } from './http';
import { failingSources, runScrape } from './run';

const OUT = 'public/events.json';
const RAW_DIR = 'data/raw';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

const result = await runScrape({
  sources: SOURCES,
  ctx: createFetchContext(),
  now: new Date(),
  previous: await readJson<EventsFile>(OUT),
  readRaw: (id) => readJson<RawEvent[]>(`${RAW_DIR}/${id}.json`),
  writeRaw: async (id, events) => {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${id}.json`, JSON.stringify(events, null, 1));
  },
});

await mkdir('public', { recursive: true });
await writeFile(OUT, JSON.stringify(result));
console.log(`Valmis: ${result.events.length} tapahtumaa -> ${OUT}`);

const failing = failingSources(result);
if (failing.length) console.log(`Toistuvasti epäonnistuvat lähteet: ${failing.join(', ')}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failing=${failing.join(' ')}\n`);
