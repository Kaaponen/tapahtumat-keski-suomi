import type { FetchContext } from '../shared/types';

export function userAgent(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  const contact = repo ? `https://github.com/${repo}` : 'local';
  return `TapahtumatBot/0.1 (+${contact})`;
}

export function createFetchContext(
  opts: { delayMs?: number; fetchImpl?: typeof fetch; log?: (m: string) => void } = {},
): FetchContext {
  const delayMs = opts.delayMs ?? 500;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const lastByHost = new Map<string, number>();

  async function request(url: string, accept: string): Promise<Response> {
    const host = new URL(url).host;
    const wait = (lastByHost.get(host) ?? -Infinity) + delayMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastByHost.set(host, Date.now());
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': userAgent(), Accept: accept, 'Accept-Language': 'fi' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res;
  }

  return {
    getText: async (url) => (await request(url, 'text/html')).text(),
    getJson: async <T>(url: string) => (await (await request(url, 'application/json')).json()) as T,
    log: opts.log ?? ((m) => console.log(m)),
  };
}
