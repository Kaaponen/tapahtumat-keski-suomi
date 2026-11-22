import { describe, expect, it } from 'vitest';
import { failingSources, filterWindow, runScrape, type RunDeps } from '../../src/scrape/run';
import type { IdRegistry } from '../../src/dedupe/ids';
import type { Event, EventsFile, RawEvent, RecentPastFile, Source } from '../../src/shared/types';
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

function deps(
  sources: Source[],
  previous: EventsFile | null = null,
  stored: Record<string, RawEvent[]> = {},
  previousIds: IdRegistry | null = null,
  previousPast: RecentPastFile | null = null,
) {
  const written: Record<string, RawEvent[]> = {};
  const d: RunDeps = {
    sources,
    ctx: fakeCtx({}),
    now: NOW,
    previous,
    previousIds,
    previousPast,
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
    const { file } = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Keikka']);
    expect(written.a).toEqual([ev]);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: NOW.toISOString(), lastError: null, consecutiveFailures: 0, count: 1,
    });
  });

  it('käyttää varmuuskopiota, kun lähde epäonnistuu, ja kasvattaa virhelaskuria', async () => {
    const old = raw({ source: 'a', title: 'Vanha', start: '2026-10-12T19:00:00+03:00' });
    const previous: EventsFile = {
      generatedAt: '', events: [], aliases: {},
      sources: { a: { name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: null, consecutiveFailures: 2, count: 7 } },
    };
    const { d } = deps([source('a', new Error('HTTP 500'))], previous, { a: [old] });
    const { file } = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Vanha']);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: 'HTTP 500', consecutiveFailures: 3, count: 7,
    });
    expect(failingSources(file)).toEqual(['a']);
  });

  it('nolla tapahtumaa, kun edellisellä kerralla oli > 5, on virhe', async () => {
    const previous: EventsFile = {
      generatedAt: '', events: [], aliases: {},
      sources: { a: { name: 'A', lastSuccess: 'x', lastError: null, consecutiveFailures: 0, count: 40 } },
    };
    const { d, written } = deps([source('a', [])], previous, { a: [] });
    const { file } = await runScrape(d);
    expect(file.sources.a.lastError).toMatch(/0 tapahtumaa/);
    expect(written.a).toBeUndefined();
  });

  it('yksi rikkinäinen lähde ei estä muita', async () => {
    const ok = raw({ source: 'b', title: 'Toimii', start: '2026-10-12T19:00:00+03:00' });
    const { d } = deps([source('a', new Error('kaatui')), source('b', [ok])]);
    const { file } = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Toimii']);
    expect(file.sources.a.consecutiveFailures).toBe(1);
  });

  describe('menneet tapahtumat ja rekisteri', () => {
    const ev = (id: string, title: string, start: string): Event => ({
      id, title, start, url: 'https://example.fi/' + id, sources: [{ source: 'a', url: 'https://example.fi/' + id }],
    } as Event);
    const prevFile = (events: Event[]): EventsFile => ({ generatedAt: '', sources: {}, events, aliases: {} });

    it('siirtää eilen päättyneen tapahtuman menneisiin', async () => {
      const yesterday = ev('e1', 'Eilinen', '2026-10-10T18:00:00+03:00');
      const { d } = deps([source('a', [])], prevFile([yesterday]));
      const { file, recentPast } = await runScrape(d);
      expect(recentPast.events.map((e) => e.id)).toEqual(['e1']);
      expect(file.events).toEqual([]);
    });

    it('pudottaa yli 30 päivää sitten päättyneet menneet', async () => {
      const old = ev('old', 'Vanha', '2026-09-01T18:00:00+03:00');
      const recent = ev('rec', 'Tuore', '2026-09-20T18:00:00+03:00');
      const { d } = deps([source('a', [])], null, {}, null, { generatedAt: '', events: [old, recent] });
      const { recentPast } = await runScrape(d);
      expect(recentPast.events.map((e) => e.id)).toEqual(['rec']);
    });

    it('siirtää menneisiin tänään alkaneen tapahtuman, jonka lähde pudotti', async () => {
      const morning = ev('m1', 'Aamun tapahtuma', '2026-10-11T07:00:00+03:00');
      const { d } = deps([source('a', [])], prevFile([morning]));
      const { file, recentPast } = await runScrape(d);
      expect(recentPast.events.map((e) => e.id)).toEqual(['m1']);
      expect(file.events).toEqual([]);
    });

    it('ei siirrä menneisiin tänään alkanutta tapahtumaa, joka on yhä lähteessä', async () => {
      const r = raw({ source: 'a', title: 'Käynnissä', start: '2026-10-11T07:00:00+03:00', end: '2026-10-11T20:00:00+03:00' });
      const first = await runScrape(deps([source('a', [r])]).d);
      const second = await runScrape(deps([source('a', [r])], first.file, {}, first.ids).d);
      expect(second.file.events).toHaveLength(1);
      expect(second.recentPast.events).toEqual([]);
    });

    it('ei siirrä menneisiin myöhemmin tänään alkavaa kadonnutta tapahtumaa', async () => {
      const evening = ev('i1', 'Illan tapahtuma', '2026-10-11T19:00:00+03:00');
      const { d } = deps([source('a', [])], prevFile([evening]));
      const { recentPast } = await runScrape(d);
      expect(recentPast.events).toEqual([]);
    });

    it('ei siirrä ennen alkuaan kadonnutta tapahtumaa menneisiin', async () => {
      const tomorrow = ev('t1', 'Huominen', '2026-10-12T18:00:00+03:00');
      const { d } = deps([source('a', [])], prevFile([tomorrow]));
      const { file, recentPast } = await runScrape(d);
      expect(recentPast.events).toEqual([]);
      expect(file.events).toEqual([]);
    });

    it('events.json sisältää aliakset ja rekisteri palautetaan', async () => {
      const a = raw({ source: 'a', title: 'Yhteinen Keikka', start: '2026-10-20T19:00:00+03:00', venue: 'Paviljonki' });
      const b1 = raw({ source: 'b', title: 'Aivan Eri Tapahtuma', start: '2026-10-20T19:00:00+03:00', venue: 'Paviljonki' });
      const first = await runScrape(deps([source('a', [a]), source('b', [b1])]).d);
      expect(first.file.events).toHaveLength(2);
      const b2 = { ...b1, title: 'Yhteinen Keikka' };
      const second = await runScrape(deps([source('a', [a]), source('b', [b2])], first.file, {}, first.ids).d);
      expect(second.file.events).toHaveLength(1);
      expect(Object.keys(second.file.aliases)).not.toHaveLength(0);
      expect(second.ids.aliases).toEqual(second.file.aliases);
    });
  });
});
