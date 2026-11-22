import { describe, expect, it } from 'vitest';
import { assignIds, emptyRegistry, type IdRegistry } from '../../src/dedupe/ids';
import { dedupe, dedupeWithIds, SOURCE_PRIORITY } from '../../src/dedupe/merge';
import { normalizeEvent } from '../../src/dedupe/normalize';
import type { RawEvent } from '../../src/shared/types';
import { raw } from '../dedupe.cases';

const rank = (s: string) => {
  const i = SOURCE_PRIORITY.indexOf(s);
  return i === -1 ? SOURCE_PRIORITY.length : i;
};
const n = (p: Parameters<typeof raw>[0]) => normalizeEvent(raw(p));
const run = (events: RawEvent[], registry: IdRegistry, today = '2026-12-01') =>
  dedupeWithIds(events, registry, today);

describe('dedupeWithIds', () => {
  it('tyhjä rekisteri tuottaa samat tunnisteet kuin dedupe', () => {
    const evs = [
      raw({ source: 'paviljonki', sourceId: 'p1', title: 'Haloo Helsinki!', start: '2026-12-05T19:00:00+02:00', venue: 'Paviljonki' }),
      raw({ source: 'keskisuomievents', sourceId: 'k1', title: 'Joulukonsertti', start: '2026-12-10T18:00:00+02:00', venue: 'Paviljonki' }),
      raw({ source: 'jelmu', sourceId: 'j1', title: 'Rock', start: '2026-12-11T18:00:00+02:00', venue: 'Jelmu' }),
    ];
    expect(run(evs, emptyRegistry()).events.map((e) => e.id)).toEqual(dedupe(evs).map((e) => e.id));
  });

  it('säilyttää tunnisteen kun kellonaika muuttuu', () => {
    const a = raw({ source: 'paviljonki', sourceId: 'p1', title: 'Keikka', start: '2026-12-05T19:00:00+02:00' });
    const r1 = run([a], emptyRegistry());
    const r2 = run([{ ...a, start: '2026-12-05T20:00:00+02:00' }], r1.registry);
    expect(r2.events[0].id).toBe(r1.events[0].id);
  });

  it('säilyttää tunnisteen kun nimi ja paikka muuttuvat', () => {
    const a = raw({ source: 'paviljonki', sourceId: 'p1', title: 'Keikka', start: '2026-12-05T19:00:00+02:00', venue: 'Paviljonki' });
    const r1 = run([a], emptyRegistry());
    const r2 = run([{ ...a, title: 'Aivan eri nimi', venue: 'Jelmu' }], r1.registry);
    expect(r2.events[0].id).toBe(r1.events[0].id);
  });

  it('toistuva tapahtuma saa eri tunnisteen joka päivälle', () => {
    const evs = [
      raw({ source: 'jklteatteri', sourceId: 'x', title: 'Näytelmä', start: '2026-12-05T19:00:00+02:00' }),
      raw({ source: 'jklteatteri', sourceId: 'x', title: 'Näytelmä', start: '2026-12-06T19:00:00+02:00' }),
    ];
    const r1 = run(evs, emptyRegistry());
    const ids = r1.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(run(evs, r1.registry).events.map((e) => e.id)).toEqual(ids);
  });
});

describe('assignIds', () => {
  const assign = (groups: ReturnType<typeof n>[][], registry: IdRegistry, today = '2026-12-01', fallbackIds?: string[]) =>
    assignIds({ groups, fallbackIds: fallbackIds ?? groups.map((_, i) => `f${i}`), registry, today, rank });

  const K = n({ source: 'keskisuomievents', sourceId: 'k1', title: 'A', start: '2026-12-05T19:00:00+02:00' });
  const P = n({ source: 'paviljonki', sourceId: 'p1', title: 'A', start: '2026-12-05T19:00:00+02:00' });

  it('yhdistyminen jättää aliaksen', () => {
    const r1 = assign([[K], [P]], emptyRegistry());
    const [x, y] = r1.ids;
    // ryhmät käsitellään rank-järjestyksessä, mutta ids vastaa syötejärjestystä
    expect(x).not.toBe(y);
    const r2 = assign([[K, P]], r1.registry, '2026-12-01', ['f9']);
    expect(r2.ids[0]).toBe(y);
    expect(r2.registry.aliases[x]).toBe(y);
  });

  it('jakautuminen: vanha tunniste jää ensisijaisimmalle lähteelle', () => {
    const r1 = assign([[K, P]], emptyRegistry());
    const y = r1.ids[0];
    const r2 = assign([[K], [P]], r1.registry);
    expect(r2.ids[1]).toBe(y);
    expect(r2.ids[0]).not.toBe(y);
  });

  it('karsii yli 30 päivää sitten päättyneet avaimet ja niiden aliakset', () => {
    const old = n({ source: 'paviljonki', sourceId: 'old', title: 'V', start: '2026-11-30T19:00:00+02:00' });
    const fresh = n({ source: 'paviljonki', sourceId: 'new', title: 'U', start: '2026-12-01T19:00:00+02:00' });
    const r1 = assign([[old], [fresh]], emptyRegistry(), '2026-12-02');
    r1.registry.aliases['kuollut'] = r1.ids[0];
    const r2 = assign([], r1.registry, '2026-12-31');
    expect(Object.keys(r2.registry.keys)).toEqual(['paviljonki:new']);
    expect(r2.registry.aliases).toEqual({});
  });

  it('tunnisteet ovat uniikkeja vaikka fallback törmää', () => {
    const a = n({ source: 'paviljonki', sourceId: 'a', title: 'A', start: '2026-12-05T19:00:00+02:00' });
    const b = n({ source: 'paviljonki', sourceId: 'b', title: 'B', start: '2026-12-05T19:00:00+02:00' });
    const r = assign([[a], [b]], emptyRegistry(), '2026-12-01', ['same', 'same']);
    expect(r.ids).toEqual(['same', 'same-2']);
  });
});
