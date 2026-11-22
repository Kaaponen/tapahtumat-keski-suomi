import { resolveId, resolveIds } from '../../shared/aliases';

/** Paikalliset (aliaksilla ratkaistut) tähdet, joita ei vielä ole tilillä. */
export function starsToUpload(local: string[], remote: string[], aliases: Record<string, string>): string[] {
  const have = new Set(resolveIds(remote, aliases));
  return resolveIds(local, aliases).filter((id) => !have.has(id));
}

/**
 * Tilin tähtirivit, jotka ratkeavat tunnisteeseen `id` (myös vanhat, aliasoidut tunnisteet).
 * Tähteä poistettaessa ne kaikki on poistettava, muuten tähti palaisi seuraavalla latauksella.
 */
export function remoteStarIds(id: string, remote: string[], aliases: Record<string, string>): string[] {
  return [...new Set([id, ...remote.filter((r) => resolveId(r, aliases) === id)])];
}
