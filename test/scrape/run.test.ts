import { describe, expect, it } from 'vitest';
import { failingSources, filterWindow, runScrape, type RunDeps } from '../../src/scrape/run';
import type { EventsFile, RawEvent, Source } from '../../src/shared/types';
import { raw } from '../dedupe.cases';
import { fakeCtx } from '../helpers';

const NOW = new Date('2026-10-11T09:00:00+03:00');

function source(id: string, result: RawEvent[] | Error): Source {
  return {
    id,
    name: id.toUpperCase(),
    fetch: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function deps(sources: Source[], previous: EventsFile | null = null, stored: Record<string, RawEvent[]> = {}) {
  const written: Record<string, RawEvent[]> = {};
  const d: RunDeps = {
    sources,
    ctx: fakeCtx({}),
    now: NOW,
    previous,
    readRaw: async (id) => stored[id] ?? null,
    writeRaw: async (id, events) => {
      written[id] = events;
    },
  };
  return { d, written };
}

describe('filterWindow', () => {
  it('poistaa menneet, pitää käynnissä olevat ja rajaa 183 päivään', () => {
    const events = [
      raw({ title: 'eilen', start: '2026-10-10T18:00:00+03:00' }),
      raw({ title: 'tänään', start: '2026-10-11T18:00:00+03:00' }),
      raw({ title: 'käynnissä', start: '2026-10-04', end: '2026-11-01', allDay: true }),
      raw({ title: 'kaukana', start: '2027-06-01T18:00:00+03:00' }),
    ];
    expect(filterWindow(events, NOW).map((e) => e.title)).toEqual(['tänään', 'käynnissä']);
  });
});

describe('runScrape', () => {
  it('kerää onnistuneet lähteet ja tallentaa varmuuskopion', async () => {
    const ev = raw({ source: 'a', title: 'Keikka', start: '2026-10-12T19:00:00+03:00' });
    const { d, written } = deps([source('a', [ev])]);
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Keikka']);
    expect(written.a).toEqual([ev]);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: NOW.toISOString(), lastError: null, consecutiveFailures: 0, count: 1,
    });
  });

  it('käyttää varmuuskopiota, kun lähde epäonnistuu, ja kasvattaa virhelaskuria', async () => {
    const old = raw({ source: 'a', title: 'Vanha', start: '2026-10-12T19:00:00+03:00' });
    const previous: EventsFile = {
      generatedAt: '', events: [],
      sources: { a: { name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: null, consecutiveFailures: 2, count: 7 } },
    };
    const { d } = deps([source('a', new Error('HTTP 500'))], previous, { a: [old] });
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Vanha']);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: 'HTTP 500', consecutiveFailures: 3, count: 7,
    });
    expect(failingSources(file)).toEqual(['a']);
  });

  it('nolla tapahtumaa, kun edellisellä kerralla oli > 5, on virhe', async () => {
    const previous: EventsFile = {
      generatedAt: '', events: [],
      sources: { a: { name: 'A', lastSuccess: 'x', lastError: null, consecutiveFailures: 0, count: 40 } },
    };
    const { d, written } = deps([source('a', [])], previous, { a: [] });
    const file = await runScrape(d);
    expect(file.sources.a.lastError).toMatch(/0 tapahtumaa/);
    expect(written.a).toBeUndefined();
  });

  it('yksi rikkinäinen lähde ei estä muita', async () => {
    const ok = raw({ source: 'b', title: 'Toimii', start: '2026-10-12T19:00:00+03:00' });
    const { d } = deps([source('a', new Error('kaatui')), source('b', [ok])]);
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Toimii']);
    expect(file.sources.a.consecutiveFailures).toBe(1);
  });
});
