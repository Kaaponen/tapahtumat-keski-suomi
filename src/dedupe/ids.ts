import { PAST_DAYS } from '../shared/retention';
import { addDays, dayKey, lastDayKey } from '../shared/time';
import type { Normalized } from './normalize';

/**
 * Pysyvien tunnisteiden rekisteri. `keys` yhdistää lähdeavaimen (`lähde:sourceId@päivä`, ja
 * yksipäiväiselle myös `lähde:sourceId`) tunnisteeseen,
 * `aliases` ohjaa yhdistymisessä hävinneen tunnisteen elossa olevaan.
 */
export interface IdRegistry {
  keys: Record<string, { id: string; lastDay: string }>;
  aliases: Record<string, string>;
}

export function emptyRegistry(): IdRegistry {
  return { keys: {}, aliases: {} };
}

interface AssignOptions {
  groups: Normalized[][];
  /** Nykyinen sisältöpohjainen tunniste (`stableId`) kullekin ryhmälle. */
  fallbackIds: string[];
  registry: IdRegistry;
  today: string;
  /** Lähteen etusijaisuus, pienin ensin (annetaan ulkoa, ettei merge.ts:ää tarvitse tuoda tänne). */
  rank: (source: string) => number;
}

export function assignIds(opts: AssignOptions): { ids: string[]; registry: IdRegistry } {
  const { groups, fallbackIds, registry, today, rank } = opts;

  // Avain on aina `lähde:sourceId@päivä`, jotta toistuvan esityksen päivät pitävät tunnisteensa
  // vaikka päivien määrä muuttuu. Pelkkä `lähde:sourceId` on varahaku: sitä käytetään, kun lähteellä
  // on tällä ajolla vain yksi päivä (siirretty tapahtuma säilyttää tunnisteensa) tai kun vanhan
  // muotoisen rekisterin avain päättyy samana päivänä kuin tapahtuma.
  const days = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const e of g) {
      const base = `${e.source}:${e.sourceId}`;
      if (!days.has(base)) days.set(base, new Set());
      days.get(base)!.add(dayKey(e.start));
    }
  }

  const info = groups.map((g) => {
    const sorted = [...g].sort((a, b) => rank(a.source) - rank(b.source));
    const keys = sorted.map((e) => {
      const base = `${e.source}:${e.sourceId}`;
      return { base, key: `${base}@${dayKey(e.start)}`, single: days.get(base)!.size === 1, lastDay: lastDayKey(e) };
    });
    const exact = keys.map((k) => registry.keys[k.key]?.id);
    const plain = keys.map((k) => {
      const hit = registry.keys[k.base];
      return hit && (k.single || hit.lastDay === k.lastDay) ? hit.id : undefined;
    });
    // Varahakua käytetään vain, jos yksikään päiväavain ei osu: muuten varahaun (esim. jo menneen
    // esityksen) tunniste päätyisi aliakseksi tälle tapahtumalle.
    const hits = (ids: (string | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))];
    const candidates = hits(exact).length ? hits(exact) : hits(plain);
    return { keys, candidates, best: sorted.length ? rank(sorted[0].source) : Infinity };
  });
  const order = groups.map((_, i) => i).sort((a, b) => info[a].best - info[b].best || a - b);

  const ids: string[] = new Array(groups.length);
  const taken = new Set<string>();
  const merged: [string, string][] = []; // [hävinnyt, valittu]

  // Ensin rekisteristä löytyvät, jotta fallback ei vie niiden tunnistetta.
  for (const i of order) {
    const { candidates } = info[i];
    const chosen = candidates.find((c) => !taken.has(c));
    if (chosen === undefined) continue;
    ids[i] = chosen;
    taken.add(chosen);
    for (const c of candidates) if (c !== chosen) merged.push([c, chosen]);
  }
  for (const i of order) {
    if (ids[i] !== undefined) continue;
    let id = fallbackIds[i];
    for (let n = 2; taken.has(id); n++) id = `${fallbackIds[i]}-${n}`;
    ids[i] = id;
    taken.add(id);
  }

  const keys: IdRegistry['keys'] = { ...registry.keys };
  info.forEach((g, i) => {
    for (const k of g.keys) {
      keys[k.key] = { id: ids[i], lastDay: k.lastDay };
      if (k.single) keys[k.base] = { id: ids[i], lastDay: k.lastDay };
    }
  });

  // Karsinta
  const cutoff = addDays(today, -PAST_DAYS);
  for (const k of Object.keys(keys)) if (keys[k].lastDay < cutoff) delete keys[k];
  const live = new Set(Object.values(keys).map((v) => v.id));

  // Aliakset: vain ne, joita kukaan ei ottanut; ketjut litistetään ja kuolleet poistetaan.
  const raw: Record<string, string> = { ...registry.aliases };
  for (const [from, to] of merged) if (!taken.has(from)) raw[from] = to;
  const aliases: Record<string, string> = {};
  for (const from of Object.keys(raw)) {
    let to = raw[from];
    for (let hops = 0; raw[to] !== undefined && hops < 100; hops++) to = raw[to];
    if (to !== from && live.has(to) && !live.has(from)) aliases[from] = to;
  }

  return { ids, registry: { keys, aliases } };
}
