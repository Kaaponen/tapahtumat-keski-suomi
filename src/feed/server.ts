import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { buildCalendar } from '../web/calendar/ics';
import { createEventsCache } from './events';
import { selectFeedEvents, type EventsBundle, type FeedPrefs } from './select';
import { fetchFeedPrefs } from './supabase';

export interface FeedDeps {
  getPrefs: (token: string) => Promise<FeedPrefs | null>;
  getEvents: () => Promise<EventsBundle>;
  now?: () => Date;
}

const TOKEN_PATH = /^\/([0-9a-f]{48})\.ics$/;
const CALENDAR_NAME = 'Tapahtumat – omat';

export function createFeedHandler(deps: FeedDeps) {
  const now = deps.now ?? (() => new Date());

  function send(req: IncomingMessage, res: ServerResponse, status: number, headers: Record<string, string>, body: string) {
    res.writeHead(status, { ...headers, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const text = { 'Content-Type': 'text/plain; charset=utf-8' };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(req, res, 405, { ...text, Allow: 'GET, HEAD' }, 'Method Not Allowed');
    }
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/health') return send(req, res, 200, text, 'ok');
    const m = TOKEN_PATH.exec(path);
    if (!m) return send(req, res, 404, text, 'Not Found');
    try {
      const prefs = await deps.getPrefs(m[1]);
      if (!prefs) return send(req, res, 404, text, 'Not Found');
      const bundle = await deps.getEvents();
      const ics = buildCalendar(selectFeedEvents(bundle, prefs), { now: now(), name: CALENDAR_NAME });
      return send(req, res, 200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' }, ics);
    } catch (err) {
      console.error('feed error:', err instanceof Error ? err.message : err);
      return send(req, res, 503, { ...text, 'Retry-After': '300' }, 'Service Unavailable');
    }
  };
}

function main(): void {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const baseUrl = process.env.EVENTS_BASE_URL;
  if (!url || !anonKey || !baseUrl) {
    console.error('SUPABASE_URL, SUPABASE_ANON_KEY ja EVENTS_BASE_URL vaaditaan');
    process.exit(1);
  }
  const handler = createFeedHandler({
    getPrefs: (token) => fetchFeedPrefs(token, { url, anonKey }),
    getEvents: createEventsCache({ baseUrl, ttlMs: 5 * 60 * 1000 }),
  });
  const port = Number(process.env.PORT ?? 8787);
  http.createServer(handler).listen(port, () => console.log(`feed listening on ${port}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
