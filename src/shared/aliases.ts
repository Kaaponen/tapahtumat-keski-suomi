const MAX_STEPS = 10;

/** Seuraa aliasketjua (vanha tunniste -> nykyinen) enintään 10 askelta; kehä ei jää jumiin. */
export function resolveId(id: string, aliases: Record<string, string>): string {
  const seen = new Set<string>();
  for (let i = 0; i < MAX_STEPS && aliases[id] && !seen.has(id); i++) {
    seen.add(id);
    id = aliases[id];
  }
  return id;
}

/** Ratkaisee tunnisteet, poistaa tuplat ja säilyttää järjestyksen. */
export function resolveIds(ids: string[], aliases: Record<string, string>): string[] {
  return [...new Set(ids.map((id) => resolveId(id, aliases)))];
}
