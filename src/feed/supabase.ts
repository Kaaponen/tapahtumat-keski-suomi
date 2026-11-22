import type { FeedPrefs } from './select';

/** Jumiin jäänyt yhteys katkaistaan, jotta pyyntö päätyy 503-vastaukseen eikä jää roikkumaan. */
export const FETCH_TIMEOUT_MS = 10_000;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Hakee tokenin tähdet ja seuratut paikat; null = tuntematon token. Muu kuin 2xx heittää. */
export async function fetchFeedPrefs(
  token: string,
  cfg: SupabaseConfig,
  fetchFn: typeof fetch = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<FeedPrefs | null> {
  const res = await fetchFn(`${cfg.url}/rest/v1/rpc/feed_for_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
    },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`feed_for_token: HTTP ${res.status}`);
  const data = (await res.json()) as Partial<FeedPrefs> | null;
  if (data === null) return null;
  return { starred: data.starred ?? [], venues: data.venues ?? [] };
}
