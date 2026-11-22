import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createFeedHandler } from '../../src/feed/server';
import type { EventsBundle, FeedPrefs } from '../../src/feed/select';
import type { Event } from '../../src/shared/types';

const TOKEN = 'a'.repeat(48);
const ev: Event = { id: 'e1', title: 'Tähtitapahtuma', start: '2026-12-01T18:00', allDay: false, url: 'https://x', categories: [], sources: [] };
const bundle: EventsBundle = { upcoming: [ev], past: [], aliases: {} };

let server: http.Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function start(over: { getPrefs?: (t: string) => Promise<FeedPrefs | null>; getEvents?: () => Promise<EventsBundle> } = {}) {
  const calls = { prefs: 0 };
  const getPrefs = over.getPrefs ?? (async () => ({ starred: ['e1'], venues: [] }));
  server = http.createServer(createFeedHandler({
    getPrefs: async (t) => { calls.prefs++; return getPrefs(t); },
    getEvents: over.getEvents ?? (async () => bundle),
    now: () => new Date('2026-11-22T00:00:00Z'),
  }));
  await new Promise<void>((r) => server!.listen(0, r));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}

describe('feed server', () => {
  it('palauttaa kalenterin tunnetulle tokenille', async () => {
    const { base } = await start();
    const r = await fetch(`${base}/${TOKEN}.ics`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(r.headers.get('cache-control')).toBe('public, max-age=900');
    const body = await r.text();
    expect(body).toContain('SUMMARY:Tähtitapahtuma');
    expect(body).toContain('Tapahtumat – omat');
  });
  it('HEAD palauttaa otsakkeet ilman runkoa', async () => {
    const { base } = await start();
    const r = await fetch(`${base}/${TOKEN}.ics`, { method: 'HEAD' });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(await r.text()).toBe('');
  });
  it('väärän muotoinen token → 404 eikä Supabasea kutsuta', async () => {
    const { base, calls } = await start();
    for (const p of ['/abc.ics', `/${'A'.repeat(48)}.ics`, `/${TOKEN}`, '/']) {
      expect((await fetch(base + p)).status).toBe(404);
    }
    expect(calls.prefs).toBe(0);
  });
  it('tuntematon token → 404', async () => {
    const { base } = await start({ getPrefs: async () => null });
    expect((await fetch(`${base}/${TOKEN}.ics`)).status).toBe(404);
  });
  it('Supabase-virhe → 503 eikä tyhjää kalenteria', async () => {
    const { base } = await start({ getPrefs: async () => { throw new Error('down'); } });
    const r = await fetch(`${base}/${TOKEN}.ics`);
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('300');
    expect(await r.text()).not.toContain('BEGIN:VCALENDAR');
  });
  it('tapahtumadatan virhe ilman välimuistia → 503', async () => {
    const { base } = await start({ getEvents: async () => { throw new Error('down'); } });
    const r = await fetch(`${base}/${TOKEN}.ics`);
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('300');
  });
  it('POST → 405 ja GET /health → 200', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/${TOKEN}.ics`, { method: 'POST' })).status).toBe(405);
    const h = await fetch(`${base}/health`);
    expect(h.status).toBe(200);
    expect(await h.text()).toBe('ok');
  });
  it('virheellinen pyyntöpolku (//) → 404 eikä palvelin kaadu', async () => {
    const { base } = await start();
    const port = Number(new URL(base).port);
    const status = await new Promise<number>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '//' }, (r) => { r.resume(); resolve(r.statusCode ?? 0); }).on('error', reject);
    });
    expect(status).toBe(404);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
});
