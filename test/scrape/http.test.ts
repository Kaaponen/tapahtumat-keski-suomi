import { describe, expect, it } from 'vitest';
import { createFetchContext } from '../../src/scrape/http';

function mockFetch(status = 200, body = '{"ok":true}') {
  const calls: { url: string; init: RequestInit; at: number }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, at: Date.now() });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe('createFetchContext', () => {
  it('lähettää oman User-Agentin ja palauttaa JSONin', async () => {
    const { calls, impl } = mockFetch();
    const ctx = createFetchContext({ fetchImpl: impl, delayMs: 0 });
    expect(await ctx.getJson('https://a.example/x')).toEqual({ ok: true });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^TapahtumatBot\//);
  });

  it('heittää virheen, kun vastaus ei ole OK', async () => {
    const { impl } = mockFetch(404, 'nope');
    const ctx = createFetchContext({ fetchImpl: impl, delayMs: 0 });
    await expect(ctx.getText('https://a.example/x')).rejects.toThrow('HTTP 404');
  });

  it('pitää tauon saman palvelimen pyyntöjen välillä', async () => {
    const { calls, impl } = mockFetch();
    const ctx = createFetchContext({ fetchImpl: impl, delayMs: 80 });
    await ctx.getText('https://a.example/1');
    await ctx.getText('https://a.example/2');
    await ctx.getText('https://b.example/1');
    expect(calls[1].at - calls[0].at).toBeGreaterThanOrEqual(75);
    expect(calls[2].at - calls[1].at).toBeLessThan(75);
  });
});
