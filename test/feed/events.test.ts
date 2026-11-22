import { describe, expect, it } from 'vitest';
import { createEventsCache } from '../../src/feed/events';
import { fetchFeedPrefs } from '../../src/feed/supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(opts: { fail?: () => boolean } = {}) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(String(url));
    if (opts.fail?.()) throw new Error('down');
    if (String(url).endsWith('/events.json')) return json({ generatedAt: 'x', sources: [], events: [{ id: 'a' }], aliases: { o: 'a' } });
    return json({ generatedAt: 'x', events: [{ id: 'p' }] });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('createEventsCache', () => {
  it('events.json haetaan kerran TTL:n sisällä', async () => {
    let t = 0;
    const f = fakeFetch();
    const get = createEventsCache({ baseUrl: 'https://b', ttlMs: 1000, fetchFn: f.fn, now: () => t });
    const first = await get();
    t = 999;
    await get();
    expect(f.calls).toEqual(['https://b/events.json', 'https://b/recent-past.json']);
    expect(first.upcoming).toHaveLength(1);
    expect(first.past).toHaveLength(1);
    expect(first.aliases).toEqual({ o: 'a' });
    t = 1001;
    await get();
    expect(f.calls).toHaveLength(4);
  });
  it('haun epäonnistuessa palautetaan vanha data', async () => {
    let t = 0;
    let down = false;
    const f = fakeFetch({ fail: () => down });
    const get = createEventsCache({ baseUrl: 'https://b', ttlMs: 1000, fetchFn: f.fn, now: () => t });
    const first = await get();
    down = true;
    t = 5000;
    expect(await get()).toEqual(first);
  });
  it('heittää kun haku epäonnistuu eikä vanhaa dataa ole', async () => {
    const f = fakeFetch({ fail: () => true });
    const get = createEventsCache({ baseUrl: 'https://b', ttlMs: 1000, fetchFn: f.fn });
    await expect(get()).rejects.toThrow();
  });
  it('puuttuva recent-past.json (404) ja aliakset tulkitaan tyhjiksi', async () => {
    const fn = (async (url: string) =>
      String(url).endsWith('/events.json') ? json({ generatedAt: 'x', sources: [], events: [{ id: 'a' }] }) : new Response('nf', { status: 404 })) as unknown as typeof fetch;
    const b = await createEventsCache({ baseUrl: 'https://b', ttlMs: 1000, fetchFn: fn })();
    expect(b.past).toEqual([]);
    expect(b.aliases).toEqual({});
  });
});

describe('fetchFeedPrefs', () => {
  it('lähettää tokenin ja anon-avaimen', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fn = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return json({ starred: ['a'], venues: ['V'] });
    }) as unknown as typeof fetch;
    const r = await fetchFeedPrefs('tok', { url: 'https://s.example', anonKey: 'KEY' }, fn);
    expect(r).toEqual({ starred: ['a'], venues: ['V'] });
    expect(seen!.url).toBe('https://s.example/rest/v1/rpc/feed_for_token');
    expect(seen!.init.method).toBe('POST');
    expect(JSON.parse(seen!.init.body as string)).toEqual({ token: 'tok' });
    const h = seen!.init.headers as Record<string, string>;
    expect(h.apikey).toBe('KEY');
    expect(h.Authorization).toBe('Bearer KEY');
  });
  it('null-vastaus → null', async () => {
    const fn = (async () => json(null)) as unknown as typeof fetch;
    expect(await fetchFeedPrefs('t', { url: 'https://s', anonKey: 'k' }, fn)).toBeNull();
  });
  it('heittää 5xx-vastauksesta', async () => {
    const fn = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(fetchFeedPrefs('t', { url: 'https://s', anonKey: 'k' }, fn)).rejects.toThrow();
  });
});
