import { resolveIds } from '../../shared/aliases';

/** Paikalliset (aliaksilla ratkaistut) tähdet, joita ei vielä ole tilillä. */
export function starsToUpload(local: string[], remote: string[], aliases: Record<string, string>): string[] {
  const have = new Set(resolveIds(remote, aliases));
  return resolveIds(local, aliases).filter((id) => !have.has(id));
}
