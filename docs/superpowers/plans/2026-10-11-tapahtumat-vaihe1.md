# Tapahtumat (vaihe 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web-sovellus, joka kerää Jyväskylän seudun tapahtumat neljästä lähteestä, yhdistää tuplat ja näyttää ne listana, josta tapahtuman voi lisätä Google-, Outlook- tai Apple-kalenteriin.

**Architecture:** Node/TypeScript-keruuskripti (ajetaan GitHub Actionsissa 3×/vrk) hakee lähteet, normalisoi ja yhdistää tapahtumat ja kirjoittaa `public/events.json`-tiedoston repoon. Vite + Preact -sivu lukee tiedoston selaimessa ja julkaistaan GitHub Pagesissa samassa workflow-ajossa. Kalenterilinkit ja .ics-tiedostot tehdään selaimessa.

**Tech Stack:** Node 22, TypeScript (strict), cheerio, tsx, vitest, Vite, Preact, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-11-tapahtumat-design.md`

## Global Constraints

- Kaikki koodi TypeScriptiä, `strict: true`. Käyttöliittymän tekstit suomeksi.
- Aikavyöhyke kaikessa päivä- ja kellonaikalogiikassa: `Europe/Helsinki`.
- Keruu: oma User-Agent, vähintään 500 ms tauko pyyntöjen välillä samaan palvelimeen, enintään 3 ajoa vuorokaudessa.
- Tuplien raja-arvot: nimien samankaltaisuus ≥ 0,85 tai kokonaisena sanana sisältyminen (lyhyempi ≥ 4 merkkiä), alkamisajat enintään 90 min erossa, kun molemmilla on kellonaika.
- Oletuskesto, jos loppuaikaa ei ole: 2 tuntia.
- Tapahtumaikkuna: tänään (tai yhä käynnissä) – tänään + 183 päivää.
- Lähde, joka palauttaa 0 tapahtumaa, kun edellisellä kerralla niitä oli > 5, tulkitaan epäonnistuneeksi.
- GitHub-ilmoitus (issue), kun lähteen `consecutiveFailures` ≥ 3 eikä avointa ilmoitusta samalla otsikolla ole.
- Lähteiden etusijajärjestys yhdistämisessä: `paviljonki`, `peurunka`, `keikkalista`, `keskisuomievents`.
- Ei kirjautumista, ei tietokantaa, ei palvelinta vaiheessa 1.

## Review Focus

1. **Keskiyön lähellä alkavat tapahtumat:** UTC-aikaleima `2026-10-11T22:30:00Z` on Helsingissä 12.10. Tapahtuman pitää näkyä 12.10. alla ja verrautua 12.10. tapahtumiin. → Testi Task 1:ssä (`dayKey`).
2. **Käynnissä oleva monipäiväinen tapahtuma** (esim. näyttely 4.10.–1.11., tänään 11.10.) ei saa pudota pois menneenä, ja listassa sen pitää näkyä "Tänään"-ryhmässä. → Testit Task 9:ssä (`filterWindow`) ja Task 11:ssä (`buildDayGroups`).
3. **Saman päivän kaksi esitystä samassa paikassa** (klo 14 ja klo 19) eivät saa yhdistyä, vaikka kolmannessa lähteessä olisi sama nimi pelkällä päivämäärällä. → Testi Task 7:ssä.
4. **Erikoismerkit ja pitkät tekstit .ics-tiedostossa** (pilkut, puolipisteet, rivinvaihdot, ä/ö, yli 75 tavun rivit) eivät saa rikkoa tiedostoa. → Testit Task 10:ssä.
5. **Estetty `localStorage`** (yksityinen selaustila) ei saa kaataa kalenteripainiketta. Painikkeen pitää silloin avata valikko joka kerta. → Testi Task 11:ssä (`prefs`).

---

## Tiedostorakenne

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore
src/shared/types.ts          yhteiset tyypit (RawEvent, Event, EventsFile, Source, FetchContext)
src/shared/time.ts           Helsingin aika: helsinkiIso, isoDate, dayKey, localTime, addDays, parseFinnishDate, parseTimes, parseDurationMinutes, isDateOnly
src/scrape/http.ts           createFetchContext (kohtelias fetch)
src/scrape/text.ts           htmlToText, decodeEntities
src/scrape/run.ts            runScrape, filterWindow
src/scrape/cli.ts            tiedostojen luku/kirjoitus, GITHUB_OUTPUT
src/sources/keskisuomievents.ts, peurunka.ts, paviljonki.ts, keikkalista.ts, index.ts
src/dedupe/normalize.ts      normalizeTitle, normalizeEvent
src/dedupe/venues.ts         venueKey
src/dedupe/categories.ts     categorize
src/dedupe/match.ts          titleSimilarity, isSameEvent, groupDuplicates
src/dedupe/merge.ts          mergeGroup, stableId, dedupe
src/web/index.html, main.tsx, App.tsx, styles.css
src/web/calendar/common.ts, google.ts, outlook.ts, ics.ts
src/web/logic/filters.ts, grouping.ts, format.ts, prefs.ts
src/web/components/EventCard.tsx, EventDetail.tsx, FiltersBar.tsx, CalendarMenu.tsx, SourceStatusFooter.tsx
test/...                     peilaa src-rakennetta; test/fixtures/<lähde>/ oikeat vastaukset
.github/workflows/ci.yml, update.yml
public/events.json, data/raw/<lähde>.json   (keruun tuottamia)
```

---

### Task 1: Projektipohja, yhteiset tyypit ja aikafunktiot

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/shared/types.ts`, `src/shared/time.ts`
- Test: `test/shared/time.test.ts`

**Interfaces:**
- Produces: kaikki tyypit tiedostossa `src/shared/types.ts`; `helsinkiIso(y,m,d,hh?,mm?): string`, `isoDate(y,m,d): string`, `isDateOnly(s): boolean`, `dayKey(iso): string`, `localTime(iso): string | null`, `addDays(day, n): string`, `parseFinnishDate(s): {y,m,d} | null`, `parseTimes(s): {start?: [number,number]; end?: [number,number]}`, `parseDurationMinutes(s): number | undefined`, vakio `TZ`.

- [ ] **Step 1: Luo projektipohja**

```bash
cd "/Users/kallelahtinen/Omat sovellukset/Tapahtumat"
npm init -y
npm pkg set type=module private=true name=tapahtumat
npm pkg delete main
npm pkg set scripts.scrape="tsx src/scrape/cli.ts" scripts.dev="vite" scripts.build="tsc --noEmit && vite build" scripts.test="vitest run" scripts.typecheck="tsc --noEmit"
npm install cheerio preact
npm install -D typescript tsx vitest vite @preact/preset-vite @types/node
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["node", "vite/client"],
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

`.gitignore`:

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 2: Kirjoita yhteiset tyypit**

`src/shared/types.ts`:

```ts
/** Yhden lähteen palauttama tapahtuma ennen yhdistämistä. */
export interface RawEvent {
  source: string;
  sourceId: string;
  title: string;
  /** ISO 8601 aikavyöhykkeen kanssa, tai pelkkä päivämäärä YYYY-MM-DD kun allDay. */
  start: string;
  end?: string;
  allDay?: boolean;
  venue?: string;
  address?: string;
  city?: string;
  url: string;
  ticketUrl?: string;
  image?: string;
  description?: string;
  categories?: string[];
}

export interface SourceLink {
  source: string;
  url: string;
}

/** Yhdistetty tapahtuma, joka päätyy events.json-tiedostoon. */
export interface Event {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  venue?: string;
  address?: string;
  city?: string;
  url: string;
  ticketUrl?: string;
  image?: string;
  description?: string;
  categories: string[];
  sources: SourceLink[];
}

export interface SourceStatus {
  name: string;
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  count: number;
}

export interface EventsFile {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  events: Event[];
}

export interface FetchContext {
  getText(url: string): Promise<string>;
  getJson<T = unknown>(url: string): Promise<T>;
  log(message: string): void;
}

export interface Source {
  id: string;
  name: string;
  fetch(ctx: FetchContext): Promise<RawEvent[]>;
}
```

- [ ] **Step 3: Kirjoita aikafunktioiden testit**

`test/shared/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addDays, dayKey, helsinkiIso, isDateOnly, isoDate, localTime,
  parseDurationMinutes, parseFinnishDate, parseTimes,
} from '../../src/shared/time';

describe('helsinkiIso', () => {
  it('käyttää kesäajan offsetia lokakuun alussa', () => {
    expect(helsinkiIso(2026, 10, 11, 19, 0)).toBe('2026-10-11T19:00:00+03:00');
  });
  it('käyttää talviajan offsetia joulukuussa', () => {
    expect(helsinkiIso(2026, 12, 18, 17, 5)).toBe('2026-12-18T17:05:00+02:00');
  });
});

describe('dayKey', () => {
  it('palauttaa Helsingin päivän UTC-ajasta (keskiyön yli)', () => {
    expect(dayKey('2026-10-11T22:30:00.000Z')).toBe('2026-10-12');
  });
  it('palauttaa pelkän päivämäärän sellaisenaan', () => {
    expect(dayKey('2026-10-11')).toBe('2026-10-11');
  });
});

describe('localTime', () => {
  it('palauttaa Helsingin kellonajan', () => {
    expect(localTime('2026-10-11T16:00:00.000Z')).toBe('19:00');
  });
  it('palauttaa keskiyön muodossa 00:00', () => {
    expect(localTime('2026-10-11T21:00:00.000Z')).toBe('00:00');
  });
  it('palauttaa null pelkälle päivämäärälle', () => {
    expect(localTime('2026-10-11')).toBeNull();
  });
});

describe('apufunktiot', () => {
  it('isoDate ja isDateOnly', () => {
    expect(isoDate(2026, 1, 5)).toBe('2026-01-05');
    expect(isDateOnly('2026-01-05')).toBe(true);
    expect(isDateOnly('2026-01-05T10:00:00Z')).toBe(false);
  });
  it('addDays ylittää vuodenvaihteen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('parseFinnishDate', () => {
  it('lukee päivämäärän tekstin keskeltä', () => {
    expect(parseFinnishDate('31.1.2027 klo 16.00')).toEqual({ y: 2027, m: 1, d: 31 });
    expect(parseFinnishDate('04.10.2026')).toEqual({ y: 2026, m: 10, d: 4 });
  });
  it('palauttaa null, jos vuotta ei ole', () => {
    expect(parseFinnishDate('16.10.')).toBeNull();
  });
});

describe('parseTimes', () => {
  it.each([
    ['Klo 20.00 alkaen', { start: [20, 0], end: undefined }],
    ['Ovet 19.30', { start: [19, 30], end: undefined }],
    ['21:00', { start: [21, 0], end: undefined }],
    ['18 - 20', { start: [18, 0], end: [20, 0] }],
    ['08.00-16.00', { start: [8, 0], end: [16, 0] }],
    ['', { start: undefined, end: undefined }],
  ])('%s', (input, expected) => {
    expect(parseTimes(input)).toEqual(expected);
  });
});

describe('parseDurationMinutes', () => {
  it.each([
    ['noin 2h 15 min', 135],
    ['1 h 30 min', 90],
    ['n. 90 min', 90],
    ['2 h', 120],
    ['', undefined],
  ])('%s', (input, expected) => {
    expect(parseDurationMinutes(input)).toBe(expected);
  });
});
```

- [ ] **Step 4: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/shared/time.test.ts`
Expected: FAIL, koska `src/shared/time` puuttuu.

- [ ] **Step 5: Toteuta aikafunktiot**

`src/shared/time.ts`:

```ts
export const TZ = 'Europe/Helsinki';

const pad = (n: number) => String(n).padStart(2, '0');

function offsetFor(date: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')!.value; // "GMT+03:00"
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

/** Helsingin seinäkelloaika -> ISO 8601 oikealla offsetilla. */
export function helsinkiIso(y: number, m: number, d: number, hh = 0, mm = 0): string {
  // Arvioidaan UTC-hetki (Helsinki on +2/+3), jotta offset valitaan oikealta puolelta kesäajan vaihdetta.
  const approx = new Date(Date.UTC(y, m - 1, d, hh, mm) - 2 * 3600_000);
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${offsetFor(approx)}`;
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Paikallinen päivä (YYYY-MM-DD) Helsingin ajassa. */
export function dayKey(iso: string): string {
  if (isDateOnly(iso)) return iso;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

/** Kellonaika "HH:MM" Helsingin ajassa, null jos pelkkä päivämäärä. */
export function localTime(iso: string): string | null {
  if (isDateOnly(iso)) return null;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function parseFinnishDate(s: string): { y: number; m: number; d: number } | null {
  const match = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  return { y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) };
}

/** Kaksi ensimmäistä kellonaikaa vapaasta tekstistä ("Ovet 19.30", "18 - 20"). */
export function parseTimes(s: string): { start?: [number, number]; end?: [number, number] } {
  const found: [number, number][] = [];
  for (const m of s.matchAll(/\b(\d{1,2})(?:[.:](\d{2}))?\b/g)) {
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h <= 23 && min <= 59) found.push([h, min]);
    if (found.length === 2) break;
  }
  return { start: found[0], end: found[1] };
}

/** "noin 2h 15 min" -> 135 */
export function parseDurationMinutes(s: string): number | undefined {
  const h = s.match(/(\d+)\s*h/i);
  const min = s.match(/(\d+)\s*min/i);
  if (!h && !min) return undefined;
  return (h ? Number(h[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
}
```

- [ ] **Step 6: Aja testit ja tyyppitarkistus**

Run: `npx vitest run test/shared/time.test.ts && npx tsc --noEmit`
Expected: kaikki testit PASS, ei tyyppivirheitä.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/shared test/shared
git commit -m "feat: projektipohja, yhteiset tyypit ja Helsingin aikafunktiot"
```

---

### Task 2: Kohtelias HTTP-asiakas ja tekstiapurit

**Files:**
- Create: `src/scrape/http.ts`, `src/scrape/text.ts`
- Create: `test/helpers.ts`
- Test: `test/scrape/http.test.ts`, `test/scrape/text.test.ts`

**Interfaces:**
- Consumes: `FetchContext` (Task 1)
- Produces: `createFetchContext(opts?: { delayMs?: number; fetchImpl?: typeof fetch; log?: (m: string) => void }): FetchContext`, `userAgent(): string`, `htmlToText(html?: string | null, max?: number): string | undefined`, `decodeEntities(s: string): string`, testiapuri `fakeCtx(responses: Record<string, unknown>): FetchContext & { requested: string[] }`.

- [ ] **Step 1: Kirjoita testiapuri ja testit**

`test/helpers.ts`:

```ts
import type { FetchContext } from '../src/shared/types';

export function fakeCtx(responses: Record<string, unknown>): FetchContext & { requested: string[] } {
  const requested: string[] = [];
  const lookup = (url: string) => {
    requested.push(url);
    if (!(url in responses)) throw new Error(`Odottamaton URL ${url}`);
    return responses[url];
  };
  return {
    requested,
    getJson: async <T>(url: string) => lookup(url) as T,
    getText: async (url: string) => lookup(url) as string,
    log: () => {},
  };
}
```

`test/scrape/http.test.ts`:

```ts
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
```

`test/scrape/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText } from '../../src/scrape/text';

describe('htmlToText', () => {
  it('poistaa tagit ja yhdistää välilyönnit', () => {
    expect(htmlToText('<p>Hei <b>maailma</b></p><p>Toinen</p>')).toBe('Hei maailma Toinen');
  });
  it('erottaa <br>-rivit välilyönnillä', () => {
    expect(htmlToText('Rivi1<br />Rivi2')).toBe('Rivi1 Rivi2');
  });
  it('lyhentää pitkän tekstin', () => {
    const out = htmlToText('a'.repeat(700), 600)!;
    expect(out.length).toBe(600);
    expect(out.endsWith('…')).toBe(true);
  });
  it('palauttaa undefined tyhjälle', () => {
    expect(htmlToText('')).toBeUndefined();
    expect(htmlToText('<p> </p>')).toBeUndefined();
    expect(htmlToText(null)).toBeUndefined();
  });
});

describe('decodeEntities', () => {
  it('purkaa HTML-entiteetit', () => {
    expect(decodeEntities('Timo &#038; Jarkko &#8211; Voices')).toBe('Timo & Jarkko – Voices');
  });
});
```

- [ ] **Step 2: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/scrape`
Expected: FAIL, koska moduulit puuttuvat.

- [ ] **Step 3: Toteuta**

`src/scrape/http.ts`:

```ts
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
```

`src/scrape/text.ts`:

```ts
import * as cheerio from 'cheerio';

export function htmlToText(html?: string | null, max = 600): string | undefined {
  if (!html) return undefined;
  const spaced = html.replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ' $&');
  const text = cheerio.load(spaced).root().text().replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

export function decodeEntities(s: string): string {
  return cheerio.load(`<p>${s}</p>`)('p').text();
}
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run test/scrape && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scrape test/helpers.ts test/scrape
git commit -m "feat: kohtelias HTTP-asiakas ja HTML-tekstiapurit"
```

---

### Task 3: Lähde keskisuomievents

**Files:**
- Create: `src/sources/keskisuomievents.ts`
- Create: `test/fixtures/keskisuomievents/page.json` (oikea vastaus)
- Test: `test/sources/keskisuomievents.test.ts`

**Interfaces:**
- Consumes: `Source`, `RawEvent`, `FetchContext` (Task 1); `htmlToText` (Task 2); `fakeCtx` (Task 2)
- Produces: `keskisuomievents: Source` (id `'keskisuomievents'`), `parseKse(e: LeEvent): RawEvent | null`, `KSE_FIRST_URL: string`.

- [ ] **Step 1: Tallenna oikea esimerkkivastaus**

```bash
mkdir -p test/fixtures/keskisuomievents
curl -sL -A "TapahtumatBot/0.1" "https://keskisuomievents.fi/api/v1/event?page=1&page_size=20&include=location,keywords,area&start=today&super_event_type=umbrella,none" -o test/fixtures/keskisuomievents/page.json
node -e "const d=require('./test/fixtures/keskisuomievents/page.json'); console.log(d.data.length, d.meta.count, d.data[0].name.fi)"
```

Expected: tulostaa `20 <kokonaismäärä> <ensimmäisen tapahtuman nimi>`. Jos vastaus on 403, kokeile `-A "Mozilla/5.0"` ja kirjaa havainto tiedostoon `docs/superpowers/notes.md`, sillä se vaikuttaa myös `userAgent()`-arvoon.

- [ ] **Step 2: Kirjoita testit**

`test/sources/keskisuomievents.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KSE_FIRST_URL, keskisuomievents, parseKse } from '../../src/sources/keskisuomievents';
import { fakeCtx } from '../helpers';

const sample = {
  id: '0cfc5109-53f5-4502-a485-14dc0b0e320b',
  name: { fi: 'Flanels salibandy', en: 'Flanels floorball', sv: '' },
  start_time: '2026-10-11T07:00:00.000Z',
  end_time: '2026-10-11T11:00:00.000Z',
  location: { name: { fi: 'Joutsan liikuntahalli', sv: null, en: null }, street_address: { fi: 'Tapiontie 3, Joutsa' } },
  area: { name: { fi: 'Joutsa' } },
  keywords: [{ name: { fi: 'Urheilu' } }, { name: { fi: '' } }],
  images: [{ url: 'https://keskisuomievents.fi/api/assets/x.jpg' }],
  offers: [{ info_url: { fi: 'https://liput.example/1' }, is_free: false }],
  short_description: { fi: 'Lyhyt.' },
  description: { fi: '<p>Flanels <b>salibandyä</b>.</p>' },
  info_url: null,
};

describe('parseKse', () => {
  it('muuntaa rajapinnan tapahtuman', () => {
    expect(parseKse(sample)).toEqual({
      source: 'keskisuomievents',
      sourceId: '0cfc5109-53f5-4502-a485-14dc0b0e320b',
      title: 'Flanels salibandy',
      start: '2026-10-11T07:00:00.000Z',
      end: '2026-10-11T11:00:00.000Z',
      allDay: false,
      venue: 'Joutsan liikuntahalli',
      address: 'Tapiontie 3, Joutsa',
      city: 'Joutsa',
      url: 'https://kalenteri.jyvaskyla.fi/tapahtuma/0cfc5109-53f5-4502-a485-14dc0b0e320b',
      ticketUrl: 'https://liput.example/1',
      image: 'https://keskisuomievents.fi/api/assets/x.jpg',
      description: 'Flanels salibandyä.',
      categories: ['Urheilu'],
    });
  });

  it('käyttää englantia, jos suomenkielinen nimi puuttuu', () => {
    expect(parseKse({ ...sample, name: { fi: '', en: 'Only English' } })?.title).toBe('Only English');
  });

  it('ohittaa tapahtuman ilman nimeä tai alkuaikaa', () => {
    expect(parseKse({ ...sample, name: { fi: '' } })).toBeNull();
    expect(parseKse({ ...sample, start_time: '' })).toBeNull();
  });
});

describe('keskisuomievents.fetch', () => {
  it('seuraa sivutusta meta.next-kentän kautta', async () => {
    const page2 = 'https://keskisuomievents.fi/api/v1/event?page=2';
    const ctx = fakeCtx({
      [KSE_FIRST_URL]: { meta: { next: page2, count: 2 }, data: [sample] },
      [page2]: { meta: { next: null, count: 2 }, data: [{ ...sample, id: 'toinen' }] },
    });
    const events = await keskisuomievents.fetch(ctx);
    expect(events.map((e) => e.sourceId)).toEqual(['0cfc5109-53f5-4502-a485-14dc0b0e320b', 'toinen']);
  });

  it('jäsentää oikean tallennetun vastauksen', async () => {
    const real = JSON.parse(readFileSync('test/fixtures/keskisuomievents/page.json', 'utf8'));
    const ctx = fakeCtx({ [KSE_FIRST_URL]: { ...real, meta: { ...real.meta, next: null } } });
    const events = await keskisuomievents.fetch(ctx);
    expect(events.length).toBeGreaterThan(10);
    for (const e of events) {
      expect(e.title).toBeTruthy();
      expect(Number.isNaN(Date.parse(e.start))).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/keskisuomievents.test.ts`
Expected: FAIL, koska moduuli puuttuu.

- [ ] **Step 4: Toteuta**

`src/sources/keskisuomievents.ts`:

```ts
import { htmlToText } from '../scrape/text';
import type { RawEvent, Source } from '../shared/types';

interface LeText { fi?: string | null; en?: string | null; sv?: string | null }
export interface LeEvent {
  id: string;
  name: LeText;
  start_time: string;
  end_time?: string | null;
  location?: { name?: LeText | null; street_address?: LeText | null; address_locality?: LeText | null } | null;
  area?: { name?: LeText | null } | null;
  keywords?: { name?: LeText | null }[];
  images?: { url?: string | null }[];
  offers?: { info_url?: LeText | null }[];
  short_description?: LeText | null;
  description?: LeText | null;
  info_url?: LeText | null;
}
interface LePage { meta: { next: string | null; count: number }; data: LeEvent[] }

export const KSE_FIRST_URL =
  'https://keskisuomievents.fi/api/v1/event?page=1&page_size=100&include=location,keywords,area&start=today&super_event_type=umbrella,none';
const MAX_PAGES = 60;

const text = (t?: LeText | null): string | undefined =>
  (t?.fi || t?.en || t?.sv || '').trim() || undefined;

export function parseKse(e: LeEvent): RawEvent | null {
  const title = text(e.name);
  if (!title || !e.start_time) return null;
  const categories = (e.keywords ?? []).map((k) => text(k.name)).filter((k): k is string => !!k);
  return {
    source: 'keskisuomievents',
    sourceId: e.id,
    title,
    start: e.start_time,
    end: e.end_time || undefined,
    allDay: false,
    venue: text(e.location?.name),
    address: text(e.location?.street_address),
    city: text(e.area?.name) ?? text(e.location?.address_locality),
    url: `https://kalenteri.jyvaskyla.fi/tapahtuma/${e.id}`,
    ticketUrl: text(e.offers?.[0]?.info_url) ?? text(e.info_url),
    image: e.images?.[0]?.url || undefined,
    description: htmlToText(text(e.description) ?? text(e.short_description)),
    categories,
  };
}

export const keskisuomievents: Source = {
  id: 'keskisuomievents',
  name: 'Keski-Suomen tapahtumakalenteri',
  async fetch(ctx) {
    const out: RawEvent[] = [];
    let skipped = 0;
    let url: string | null = KSE_FIRST_URL;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res: LePage = await ctx.getJson<LePage>(url);
      for (const e of res.data) {
        const parsed = parseKse(e);
        if (parsed) out.push(parsed);
        else skipped++;
      }
      url = res.meta.next;
    }
    if (skipped) ctx.log(`keskisuomievents: ohitettiin ${skipped} puutteellista tapahtumaa`);
    return out;
  },
};
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources/keskisuomievents.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sources/keskisuomievents.ts test/sources/keskisuomievents.test.ts test/fixtures/keskisuomievents
git commit -m "feat: lähde keskisuomievents (Linked Events -rajapinta)"
```

---

### Task 4: Lähde Peurunka

**Files:**
- Create: `src/sources/peurunka.ts`
- Create: `test/fixtures/peurunka/upcoming.json`
- Test: `test/sources/peurunka.test.ts`

**Interfaces:**
- Consumes: `helsinkiIso`, `isoDate`, `parseFinnishDate`, `parseTimes` (Task 1); `htmlToText`, `decodeEntities` (Task 2)
- Produces: `peurunka: Source` (id `'peurunka'`), `parsePeurunka(e: PeurunkaEvent): RawEvent | null`, `PEURUNKA_URL`.

- [ ] **Step 1: Tallenna oikea esimerkkivastaus**

```bash
mkdir -p test/fixtures/peurunka
curl -sL -A "TapahtumatBot/0.1" "https://peurunka.fi/wp-json/events/v2/upcoming" -o test/fixtures/peurunka/upcoming.json
node -e "const d=require('./test/fixtures/peurunka/upcoming.json'); console.log(d.length, d[0].event_title)"
```

Expected: tulostaa tapahtumien määrän (noin 50) ja ensimmäisen nimen.

- [ ] **Step 2: Kirjoita testit**

`test/sources/peurunka.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PEURUNKA_URL, parsePeurunka, peurunka, type PeurunkaEvent } from '../../src/sources/peurunka';
import { fakeCtx } from '../helpers';

const base: PeurunkaEvent = {
  event_id: 1,
  event_title: 'Keikka &#8211; Bändi',
  event_link: 'https://peurunka.fi/kaikki-tapahtumat/keikka/',
  event_category: ['Keikat'],
  event_start_date: '24.10.2026',
  event_end_date: '24.10.2026',
  event_time: 'Ovet 20:00',
  event_place: 'Pub',
  event_ticket_link: { title: 'Varaa', url: 'https://www.ticketmaster.fi/event/1' },
  event_content: '<p>Kuvaus</p>',
  event_image: 'https://peurunka.fi/kuva.jpg',
};

describe('parsePeurunka', () => {
  it('yhden illan keikka kellonajalla', () => {
    expect(parsePeurunka(base)).toEqual({
      source: 'peurunka',
      sourceId: '1',
      title: 'Keikka – Bändi',
      start: '2026-10-24T20:00:00+03:00',
      end: undefined,
      allDay: false,
      venue: 'Peurunka – Pub',
      address: 'Peurungantie 85',
      city: 'Laukaa',
      url: 'https://peurunka.fi/kaikki-tapahtumat/keikka/',
      ticketUrl: 'https://www.ticketmaster.fi/event/1',
      image: 'https://peurunka.fi/kuva.jpg',
      description: 'Kuvaus',
      categories: ['Keikat'],
    });
  });

  it('aikaväli "18 - 20" antaa myös loppuajan', () => {
    const e = parsePeurunka({ ...base, event_time: '18 - 20' })!;
    expect(e.start).toBe('2026-10-24T18:00:00+03:00');
    expect(e.end).toBe('2026-10-24T20:00:00+03:00');
  });

  it('ilman kellonaikaa tapahtuma on koko päivän', () => {
    const e = parsePeurunka({ ...base, event_time: '' })!;
    expect(e).toMatchObject({ start: '2026-10-24', allDay: true });
  });

  it('monipäiväinen näyttely on koko päivän tapahtuma loppupäivällä', () => {
    const e = parsePeurunka({ ...base, event_start_date: '04.10.2026', event_end_date: '01.11.2026', event_time: '' })!;
    expect(e).toMatchObject({ start: '2026-10-04', end: '2026-11-01', allDay: true });
  });

  it('paikka "Peurunka" ei toistu', () => {
    expect(parsePeurunka({ ...base, event_place: 'Peurunka' })!.venue).toBe('Peurunka');
    expect(parsePeurunka({ ...base, event_place: '' })!.venue).toBe('Peurunka');
  });

  it('puuttuva lippulinkki ja kuva', () => {
    const e = parsePeurunka({ ...base, event_ticket_link: '', event_image: false })!;
    expect(e.ticketUrl).toBeUndefined();
    expect(e.image).toBeUndefined();
  });

  it('virheellinen päivämäärä ohitetaan', () => {
    expect(parsePeurunka({ ...base, event_start_date: '' })).toBeNull();
  });
});

describe('peurunka.fetch', () => {
  it('jäsentää oikean tallennetun vastauksen', async () => {
    const real = JSON.parse(readFileSync('test/fixtures/peurunka/upcoming.json', 'utf8'));
    const events = await peurunka.fetch(fakeCtx({ [PEURUNKA_URL]: real }));
    expect(events.length).toBeGreaterThan(5);
    for (const e of events) expect(Number.isNaN(Date.parse(e.start))).toBe(false);
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/peurunka.test.ts`
Expected: FAIL.

- [ ] **Step 4: Toteuta**

`src/sources/peurunka.ts`:

```ts
import { decodeEntities, htmlToText } from '../scrape/text';
import { helsinkiIso, isoDate, parseFinnishDate, parseTimes } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export interface PeurunkaEvent {
  event_id: number;
  event_title: string;
  event_link: string;
  event_category?: string[];
  event_start_date: string;
  event_end_date?: string;
  event_time?: string;
  event_place?: string;
  event_ticket_link?: { url?: string; title?: string } | '' | null;
  event_content?: string;
  event_image?: string | false | null;
}

export const PEURUNKA_URL = 'https://peurunka.fi/wp-json/events/v2/upcoming';

export function parsePeurunka(e: PeurunkaEvent): RawEvent | null {
  const d = parseFinnishDate(e.event_start_date ?? '');
  if (!d || !e.event_title) return null;
  const endDate = parseFinnishDate(e.event_end_date ?? '');
  const multiDay = !!endDate && (endDate.y !== d.y || endDate.m !== d.m || endDate.d !== d.d);
  const times = parseTimes(e.event_time ?? '');
  const timed = !multiDay && !!times.start;

  const start = timed ? helsinkiIso(d.y, d.m, d.d, ...times.start!) : isoDate(d.y, d.m, d.d);
  let end: string | undefined;
  if (multiDay) end = isoDate(endDate!.y, endDate!.m, endDate!.d);
  else if (timed && times.end) end = helsinkiIso(d.y, d.m, d.d, ...times.end);

  const place = (e.event_place ?? '').trim();
  const ticket = e.event_ticket_link && typeof e.event_ticket_link === 'object' ? e.event_ticket_link.url : undefined;

  return {
    source: 'peurunka',
    sourceId: String(e.event_id),
    title: decodeEntities(e.event_title).trim(),
    start,
    end,
    allDay: !timed,
    venue: place && !/^peurunka$/i.test(place) ? `Peurunka – ${place}` : 'Peurunka',
    address: 'Peurungantie 85',
    city: 'Laukaa',
    url: e.event_link,
    ticketUrl: ticket || undefined,
    image: e.event_image || undefined,
    description: htmlToText(e.event_content),
    categories: e.event_category ?? [],
  };
}

export const peurunka: Source = {
  id: 'peurunka',
  name: 'Peurunka',
  async fetch(ctx) {
    const list = await ctx.getJson<PeurunkaEvent[]>(PEURUNKA_URL);
    const out = list.map(parsePeurunka).filter((e): e is RawEvent => e !== null);
    if (out.length < list.length) ctx.log(`peurunka: ohitettiin ${list.length - out.length} tapahtumaa`);
    return out;
  },
};
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources/peurunka.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sources/peurunka.ts test/sources/peurunka.test.ts test/fixtures/peurunka
git commit -m "feat: lähde Peurunka"
```

---

### Task 5: Lähde Paviljonki

**Files:**
- Create: `src/sources/paviljonki.ts`
- Create: `test/fixtures/paviljonki/list.html`, `test/fixtures/paviljonki/detail.html`
- Test: `test/sources/paviljonki.test.ts`

**Interfaces:**
- Consumes: `helsinkiIso`, `isoDate`, `parseFinnishDate`, `parseTimes`, `parseDurationMinutes` (Task 1); `htmlToText` (Task 2)
- Produces: `paviljonki: Source` (id `'paviljonki'`), `parsePaviljonkiList(html): PavListItem[]`, `parsePaviljonkiDetail(html): PavDetail`, `PAVILJONKI_LIST_URL`.

- [ ] **Step 1: Tallenna oikeat sivut**

```bash
mkdir -p test/fixtures/paviljonki
curl -sL -A "TapahtumatBot/0.1" "https://www.paviljonki.fi/tapahtumat-liput/" -o test/fixtures/paviljonki/list.html
DETAIL=$(grep -o 'https://www.paviljonki.fi/tapahtuma/[^"]*' test/fixtures/paviljonki/list.html | head -1)
curl -sL -A "TapahtumatBot/0.1" "$DETAIL" -o test/fixtures/paviljonki/detail.html
grep -c 'event-list-item"' test/fixtures/paviljonki/list.html; grep -o 'icon-link--calender' test/fixtures/paviljonki/detail.html | head -1
```

Expected: tapahtumien määrä (noin 60–70) ja `icon-link--calender`.

- [ ] **Step 2: Kirjoita testit**

`test/sources/paviljonki.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PAVILJONKI_LIST_URL, paviljonki, parsePaviljonkiDetail, parsePaviljonkiList,
} from '../../src/sources/paviljonki';
import { fakeCtx } from '../helpers';

const LIST = `
<div class="event-list">
  <h2 class="month_year">lokakuu 2026</h2>
  <div class="event-list-item">
    <div class="event-list-item__image"><img src="https://www.paviljonki.fi/kuva.jpg"></div>
    <div class="event-list-item__details">
      <h2 class="event-details__title"><a href="https://www.paviljonki.fi/tapahtuma/benjamin/"> Benjamin Locker Room Tour K18 </a></h2>
      <div class="event-details__meta"><div class="tag-list"><span class="tag-list-item">Konsertit</span><span class="tag-list-item">Paviljonki Klubi</span></div> 16.10.2026 </div>
    </div>
    <div class="event-list-item__tickets"><a href="https://www.lippu.fi/event/1/">Osta liput</a></div>
  </div>
  <div class="event-list-item">
    <div class="event-list-item__details">
      <h2 class="event-details__title"><a href="https://www.paviljonki.fi/tapahtuma/rikki/">Ei päivämäärää</a></h2>
      <div class="event-details__meta"></div>
    </div>
  </div>
</div>`;

const DETAIL = `
<main><article><div class="event"><div class="event__main"><h1>Benjamin</h1><p>Kuvausteksti.</p></div>
<div class="event__sidebar">
  <div class="icon-link icon-link--calender"><p> 16.10.2026 klo 19.30 </p></div>
  <div class="icon-link icon-link--clock"><p>noin 2h 15 min</p></div>
  <div class="icon-link icon-link--location"><p>Paikka: <a href="https://www.paviljonki.fi/tilat/klubi/">Paviljonki Klubi</a></p></div>
</div></div></article></main>`;

describe('parsePaviljonkiList', () => {
  it('lukee tapahtumat ja ohittaa rivit ilman päivämäärää', () => {
    expect(parsePaviljonkiList(LIST)).toEqual([{
      url: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      title: 'Benjamin Locker Room Tour K18',
      date: { y: 2026, m: 10, d: 16 },
      categories: ['Konsertit', 'Paviljonki Klubi'],
      ticketUrl: 'https://www.lippu.fi/event/1/',
      image: 'https://www.paviljonki.fi/kuva.jpg',
    }]);
  });
});

describe('parsePaviljonkiDetail', () => {
  it('lukee kellonajan, keston, salin ja kuvauksen', () => {
    expect(parsePaviljonkiDetail(DETAIL)).toEqual({
      start: [19, 30], durationMin: 135, hall: 'Paviljonki Klubi', description: 'Kuvausteksti.',
    });
  });
});

describe('paviljonki.fetch', () => {
  it('yhdistää listan ja tapahtumasivun tiedot', async () => {
    const ctx = fakeCtx({
      [PAVILJONKI_LIST_URL]: LIST,
      'https://www.paviljonki.fi/tapahtuma/benjamin/': DETAIL,
    });
    const [e] = await paviljonki.fetch(ctx);
    expect(e).toEqual({
      source: 'paviljonki',
      sourceId: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      title: 'Benjamin Locker Room Tour K18',
      start: '2026-10-16T19:30:00+03:00',
      end: '2026-10-16T18:45:00.000Z',
      allDay: false,
      venue: 'Paviljonki – Paviljonki Klubi',
      address: 'Lutakonaukio 12',
      city: 'Jyväskylä',
      url: 'https://www.paviljonki.fi/tapahtuma/benjamin/',
      ticketUrl: 'https://www.lippu.fi/event/1/',
      image: 'https://www.paviljonki.fi/kuva.jpg',
      description: 'Kuvausteksti.',
      categories: ['Konsertit', 'Paviljonki Klubi'],
    });
  });

  it('käyttää pelkkää päivämäärää, jos tapahtumasivun haku epäonnistuu', async () => {
    const ctx = fakeCtx({ [PAVILJONKI_LIST_URL]: LIST });
    const [e] = await paviljonki.fetch(ctx);
    expect(e).toMatchObject({ start: '2026-10-16', allDay: true, venue: 'Paviljonki' });
  });

  it('jäsentää oikean tallennetun listan ja tapahtumasivun', () => {
    const items = parsePaviljonkiList(readFileSync('test/fixtures/paviljonki/list.html', 'utf8'));
    expect(items.length).toBeGreaterThan(10);
    const detail = parsePaviljonkiDetail(readFileSync('test/fixtures/paviljonki/detail.html', 'utf8'));
    expect(detail.start).toBeDefined();
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/paviljonki.test.ts`
Expected: FAIL.

- [ ] **Step 4: Toteuta**

`src/sources/paviljonki.ts`:

```ts
import * as cheerio from 'cheerio';
import { htmlToText } from '../scrape/text';
import { helsinkiIso, isoDate, parseDurationMinutes, parseFinnishDate, parseTimes } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const PAVILJONKI_LIST_URL = 'https://www.paviljonki.fi/tapahtumat-liput/';

export interface PavListItem {
  url: string;
  title: string;
  date: { y: number; m: number; d: number };
  categories: string[];
  ticketUrl?: string;
  image?: string;
}

export interface PavDetail {
  start?: [number, number];
  durationMin?: number;
  hall?: string;
  description?: string;
}

export function parsePaviljonkiList(html: string): PavListItem[] {
  const $ = cheerio.load(html);
  const items: PavListItem[] = [];
  $('.event-list-item').each((_, el) => {
    const item = $(el);
    const link = item.find('.event-details__title a').first();
    const url = link.attr('href');
    const title = link.text().replace(/\s+/g, ' ').trim();
    const date = parseFinnishDate(item.find('.event-details__meta').text());
    if (!url || !title || !date) return;
    items.push({
      url,
      title,
      date,
      categories: item.find('.tag-list-item').map((_, t) => $(t).text().trim()).get().filter(Boolean),
      ticketUrl: item.find('.event-list-item__tickets a').first().attr('href') || undefined,
      image: item.find('.event-list-item__image img').first().attr('src') || undefined,
    });
  });
  return items;
}

export function parsePaviljonkiDetail(html: string): PavDetail {
  const $ = cheerio.load(html);
  const when = $('.icon-link--calender p').first().text();
  const afterKlo = when.split(/klo/i)[1] ?? '';
  const main = $('.event__main').clone();
  main.find('h1').remove();
  return {
    start: parseTimes(afterKlo).start,
    durationMin: parseDurationMinutes($('.icon-link--clock p').first().text()),
    hall: $('.icon-link--location a').first().text().trim() || undefined,
    description: htmlToText(main.html()),
  };
}

export const paviljonki: Source = {
  id: 'paviljonki',
  name: 'Paviljonki',
  async fetch(ctx) {
    const items = parsePaviljonkiList(await ctx.getText(PAVILJONKI_LIST_URL));
    const out: RawEvent[] = [];
    for (const item of items) {
      let detail: PavDetail = {};
      try {
        detail = parsePaviljonkiDetail(await ctx.getText(item.url));
      } catch (err) {
        ctx.log(`paviljonki: tapahtumasivu epäonnistui ${item.url}: ${(err as Error).message}`);
      }
      const { y, m, d } = item.date;
      const start = detail.start ? helsinkiIso(y, m, d, ...detail.start) : isoDate(y, m, d);
      const end = detail.start && detail.durationMin
        ? new Date(Date.parse(start) + detail.durationMin * 60_000).toISOString()
        : undefined;
      out.push({
        source: 'paviljonki',
        sourceId: item.url,
        title: item.title,
        start,
        end,
        allDay: !detail.start,
        venue: detail.hall ? `Paviljonki – ${detail.hall}` : 'Paviljonki',
        address: 'Lutakonaukio 12',
        city: 'Jyväskylä',
        url: item.url,
        ticketUrl: item.ticketUrl,
        image: item.image,
        description: detail.description,
        categories: item.categories,
      });
    }
    return out;
  },
};
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources/paviljonki.test.ts && npx tsc --noEmit`
Expected: PASS. Jos oikea tallennettu tapahtumasivu ei anna `start`-arvoa, tarkista sivun rakenne (`grep -A3 icon-link--calender test/fixtures/paviljonki/detail.html`) ja korjaa valitsin.

- [ ] **Step 6: Commit**

```bash
git add src/sources/paviljonki.ts test/sources/paviljonki.test.ts test/fixtures/paviljonki
git commit -m "feat: lähde Paviljonki (listasivu + tapahtumasivu)"
```

---

### Task 6: Lähde Keikkalista ja lähdeluettelo

**Files:**
- Create: `src/sources/keikkalista.ts`, `src/sources/index.ts`
- Create: `test/fixtures/keikkalista/jyvaskyla.html`
- Test: `test/sources/keikkalista.test.ts`

**Interfaces:**
- Consumes: `isDateOnly` (Task 1)
- Produces: `keikkalista: Source` (id `'keikkalista'`), `parseKeikkalista(html): RawEvent[]`, `KEIKKALISTA_URL`; `SOURCES: Source[]` tiedostossa `src/sources/index.ts`.

- [ ] **Step 1: Tallenna oikea sivu**

```bash
mkdir -p test/fixtures/keikkalista
curl -sL -A "TapahtumatBot/0.1" "https://www.keikkalista.fi/jyvaskyla" -o test/fixtures/keikkalista/jyvaskyla.html
grep -c 'application/ld+json' test/fixtures/keikkalista/jyvaskyla.html
```

Expected: vähintään 1.

- [ ] **Step 2: Kirjoita testit**

`test/sources/keikkalista.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKeikkalista } from '../../src/sources/keikkalista';

const event = {
  '@type': 'MusicEvent',
  name: 'Rival Tree / KAPPAS',
  startDate: '2026-10-11',
  url: 'https://www.keikkalista.fi/keikat/rival-tree-kappas-rockneck-jyvaskyla-2026-10-11',
  image: ['https://www.keikkalista.fi/logo.png'],
  location: {
    '@type': 'MusicVenue',
    name: 'RockNeck Jyväskylä',
    address: { '@type': 'PostalAddress', streetAddress: 'Asemakatu 7 (Forum), 40100 Jyväskylä', addressLocality: 'Jyväskylä' },
  },
};
const timed = { ...event, name: 'Myöhäisshow', url: 'https://www.keikkalista.fi/keikat/x', startDate: '2026-10-12T21:00:00+03:00' };
const html = `
<script type="application/ld+json">[{"@type":"WebSite","name":"Keikkalista"}]</script>
<script type="application/ld+json">[{"@type":"ItemList","itemListElement":[{"item":${JSON.stringify(event)}}]}, ${JSON.stringify(event)}, ${JSON.stringify(timed)}]</script>
<script type="application/ld+json">{ rikki json</script>`;

describe('parseKeikkalista', () => {
  it('lukee tapahtumat sisäkkäisistäkin rakenteista, poistaa toistot ja ohittaa rikkinäisen JSONin', () => {
    const events = parseKeikkalista(html);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      source: 'keikkalista',
      sourceId: event.url,
      title: 'Rival Tree / KAPPAS',
      start: '2026-10-11',
      end: undefined,
      allDay: true,
      venue: 'RockNeck Jyväskylä',
      address: 'Asemakatu 7 (Forum), 40100 Jyväskylä',
      city: 'Jyväskylä',
      url: event.url,
      ticketUrl: undefined,
      image: 'https://www.keikkalista.fi/logo.png',
      description: undefined,
      categories: ['keikat'],
    });
    expect(events[1]).toMatchObject({ start: '2026-10-12T21:00:00+03:00', allDay: false });
  });

  it('jäsentää oikean tallennetun sivun', () => {
    const events = parseKeikkalista(readFileSync('test/fixtures/keikkalista/jyvaskyla.html', 'utf8'));
    expect(events.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/keikkalista.test.ts`
Expected: FAIL.

- [ ] **Step 4: Toteuta**

`src/sources/keikkalista.ts`:

```ts
import * as cheerio from 'cheerio';
import { isDateOnly } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const KEIKKALISTA_URL = 'https://www.keikkalista.fi/jyvaskyla';

interface LdEvent {
  '@type'?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  image?: string | string[];
  description?: string;
  location?: { name?: string; address?: { streetAddress?: string; addressLocality?: string } | string };
  offers?: { url?: string } | { url?: string }[];
}

function* findEvents(node: unknown): Generator<LdEvent> {
  if (Array.isArray(node)) {
    for (const child of node) yield* findEvents(child);
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (/Event$/.test(String(obj['@type'] ?? ''))) yield obj as LdEvent;
    for (const value of Object.values(obj)) yield* findEvents(value);
  }
}

function toRaw(e: LdEvent): RawEvent | null {
  if (!e.name || !e.startDate || !e.url) return null;
  const address = typeof e.location?.address === 'object' ? e.location.address : undefined;
  const image = Array.isArray(e.image) ? e.image[0] : e.image;
  const offer = Array.isArray(e.offers) ? e.offers[0] : e.offers;
  return {
    source: 'keikkalista',
    sourceId: e.url,
    title: e.name.trim(),
    start: e.startDate,
    end: e.endDate,
    allDay: isDateOnly(e.startDate),
    venue: e.location?.name,
    address: address?.streetAddress,
    city: address?.addressLocality,
    url: e.url,
    ticketUrl: offer?.url,
    image,
    description: e.description,
    categories: ['keikat'],
  };
}

export function parseKeikkalista(html: string): RawEvent[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, RawEvent>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    for (const e of findEvents(data)) {
      const raw = toRaw(e);
      if (raw && !byUrl.has(raw.url)) byUrl.set(raw.url, raw);
    }
  });
  return [...byUrl.values()];
}

export const keikkalista: Source = {
  id: 'keikkalista',
  name: 'Keikkalista',
  async fetch(ctx) {
    return parseKeikkalista(await ctx.getText(KEIKKALISTA_URL));
  },
};
```

`src/sources/index.ts`:

```ts
import type { Source } from '../shared/types';
import { keikkalista } from './keikkalista';
import { keskisuomievents } from './keskisuomievents';
import { paviljonki } from './paviljonki';
import { peurunka } from './peurunka';

export const SOURCES: Source[] = [paviljonki, peurunka, keikkalista, keskisuomievents];
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sources test/sources/keikkalista.test.ts test/fixtures/keikkalista
git commit -m "feat: lähde Keikkalista (JSON-LD) ja lähdeluettelo"
```

---

### Task 7: Normalisointi ja tuplien tunnistus

**Files:**
- Create: `src/dedupe/normalize.ts`, `src/dedupe/venues.ts`, `src/dedupe/match.ts`
- Test: `test/dedupe/normalize.test.ts`, `test/dedupe/match.test.ts`, `test/dedupe.cases.ts`

**Interfaces:**
- Consumes: `RawEvent` (Task 1), `dayKey`, `localTime` (Task 1)
- Produces: `normalizeTitle(title): string`, `venueKey(venue?): string | undefined`, `interface Normalized extends RawEvent { nTitle: string; vKey?: string; day: string; time: string | null }`, `normalizeEvent(e: RawEvent): Normalized`, `titleSimilarity(a, b): number`, `isSameEvent(a, b): boolean`, `groupDuplicates(events: Normalized[]): Normalized[][]`.

- [ ] **Step 1: Kirjoita normalisoinnin testit**

`test/dedupe/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeEvent, normalizeTitle } from '../../src/dedupe/normalize';
import { venueKey } from '../../src/dedupe/venues';

describe('normalizeTitle', () => {
  it.each([
    ['Benjamin Locker Room Tour K18', 'benjamin locker room tour'],
    ['Benjamin: Locker Room Tour (K-18)', 'benjamin locker room tour'],
    ['Kotipelto & Ahola – LOPPUUNMYYTY', 'kotipelto ahola'],
    ['Haloo Helsinki! Jyväskylässä', 'haloo helsinki'],
    ['Rival Tree / KAPPAS', 'rival tree kappas'],
    ['Pikkujoulut Peurungassa', 'pikkujoulut'],
  ])('%s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });
});

describe('venueKey', () => {
  it.each([
    ['Jyväskylän Paviljonki', 'paviljonki'],
    ['Paviljonki – Encore-sali', 'paviljonki'],
    ['Peurunka – Pub', 'peurunka'],
    ['Tanssisali Lutakko', 'lutakko'],
    ['RockNeck Jyväskylä', 'rockneck'],
    ['Jyväskylän kirkkopuisto', 'kirkkopuisto'],
    ['Kirkkopuisto, Jyväskylä', 'kirkkopuisto'],
  ])('%s', (input, expected) => {
    expect(venueKey(input)).toBe(expected);
  });
  it('palauttaa undefined tyhjälle', () => {
    expect(venueKey(undefined)).toBeUndefined();
    expect(venueKey('  ')).toBeUndefined();
  });
});

describe('normalizeEvent', () => {
  it('laskee päivän ja kellonajan Helsingin ajassa', () => {
    const n = normalizeEvent({
      source: 's', sourceId: '1', title: 'Yökeikka', start: '2026-10-11T22:30:00.000Z', url: 'u',
    });
    expect(n).toMatchObject({ nTitle: 'yökeikka', day: '2026-10-12', time: '01:30' });
  });
  it('koko päivän tapahtumalla ei ole kellonaikaa', () => {
    const n = normalizeEvent({
      source: 's', sourceId: '1', title: 'Näyttely', start: '2026-10-11T10:00:00+03:00', allDay: true, url: 'u',
    });
    expect(n.time).toBeNull();
  });
});
```

- [ ] **Step 2: Kirjoita tuplatapaukset ja tunnistuksen testit**

`test/dedupe.cases.ts`:

```ts
import type { RawEvent } from '../src/shared/types';

let seq = 0;
export function raw(p: Partial<RawEvent> & Pick<RawEvent, 'title' | 'start'>): RawEvent {
  seq++;
  return { source: p.source ?? 'keskisuomievents', sourceId: String(seq), url: `https://example.fi/${seq}`, ...p };
}

export interface DedupeCase { name: string; a: RawEvent; b: RawEvent; same: boolean }

export const DEDUPE_CASES: DedupeCase[] = [
  {
    name: 'Paviljonki vs. kalenteri: K18-merkintä ja kaksoispiste',
    a: raw({ source: 'paviljonki', title: 'Benjamin Locker Room Tour K18', start: '2026-10-16T19:00:00+03:00', venue: 'Paviljonki – Paviljonki Klubi' }),
    b: raw({ title: 'Benjamin: Locker Room Tour', start: '2026-10-16T16:00:00.000Z', venue: 'Jyväskylän Paviljonki' }),
    same: true,
  },
  {
    name: 'Keikkalista ilman kellonaikaa vs. kalenteri: nimi sisältyy',
    a: raw({ source: 'keikkalista', title: 'Rival Tree / KAPPAS', start: '2026-10-11', allDay: true, venue: 'RockNeck Jyväskylä' }),
    b: raw({ title: 'Rival Tree', start: '2026-10-11T17:00:00.000Z', venue: 'RockNeck' }),
    same: true,
  },
  {
    name: 'Toisesta puuttuu paikka, nimessä lisäosa',
    a: raw({ source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00', venue: 'Paviljonki' }),
    b: raw({ title: 'Haloo Helsinki! – Kevätkiertue 2027', start: '2026-11-20T19:00:00+02:00' }),
    same: true,
  },
  {
    name: 'Loppuunmyyty-merkintä',
    a: raw({ source: 'paviljonki', title: 'Kotipelto & Ahola – LOPPUUNMYYTY', start: '2027-01-31T16:00:00+02:00', venue: 'Paviljonki' }),
    b: raw({ title: 'Kotipelto & Ahola', start: '2027-01-31T16:00:00+02:00', venue: 'Jyväskylän Paviljonki' }),
    same: true,
  },
  {
    name: 'Sama nimi eri päivänä',
    a: raw({ title: 'Joulukonsertti', start: '2026-12-10T18:00:00+02:00', venue: 'Paviljonki' }),
    b: raw({ title: 'Joulukonsertti', start: '2026-12-11T18:00:00+02:00', venue: 'Paviljonki' }),
    same: false,
  },
  {
    name: 'Sama päivä ja paikka, eri tapahtuma',
    a: raw({ title: 'Joulukonsertti', start: '2026-12-10T18:00:00+02:00', venue: 'Paviljonki' }),
    b: raw({ title: 'Lasten satutunti', start: '2026-12-10T18:00:00+02:00', venue: 'Paviljonki' }),
    same: false,
  },
  {
    name: 'Sama nimi ja päivä, eri paikka',
    a: raw({ title: 'Klubi-ilta', start: '2026-11-07T21:00:00+02:00', venue: 'Tanssisali Lutakko' }),
    b: raw({ title: 'Klubi-ilta', start: '2026-11-07T21:00:00+02:00', venue: 'Ilokivi' }),
    same: false,
  },
  {
    name: 'Saman päivän kaksi esitystä (klo 14 ja 19)',
    a: raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue: 'Jyväskylän kaupunginteatteri' }),
    b: raw({ title: 'Peter Pan', start: '2026-11-14T19:00:00+02:00', venue: 'Jyväskylän kaupunginteatteri' }),
    same: false,
  },
];
```

`test/dedupe/match.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupDuplicates, isSameEvent, titleSimilarity } from '../../src/dedupe/match';
import { normalizeEvent } from '../../src/dedupe/normalize';
import { DEDUPE_CASES, raw } from '../dedupe.cases';

describe('isSameEvent', () => {
  it.each(DEDUPE_CASES)('$name → $same', ({ a, b, same }) => {
    expect(isSameEvent(normalizeEvent(a), normalizeEvent(b))).toBe(same);
    expect(isSameEvent(normalizeEvent(b), normalizeEvent(a))).toBe(same);
  });
});

describe('titleSimilarity', () => {
  it('identtiset = 1, täysin eri = 0', () => {
    expect(titleSimilarity('peter pan', 'peter pan')).toBe(1);
    expect(titleSimilarity('peter pan', 'joulukonsertti')).toBeLessThan(0.3);
  });
  it('kirjoitusvirhe pysyy korkeana', () => {
    expect(titleSimilarity('kotipelto ahola voices unleashed', 'kotipelto ahola voices unleshed')).toBeGreaterThanOrEqual(0.85);
  });
});

describe('groupDuplicates', () => {
  it('pelkän päivämäärän tapahtuma ei liimaa kahta esitystä yhteen', () => {
    const venue = 'Jyväskylän kaupunginteatteri';
    const events = [
      raw({ source: 'keikkalista', title: 'Peter Pan', start: '2026-11-14', allDay: true, venue }),
      raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue }),
      raw({ title: 'Peter Pan', start: '2026-11-14T19:00:00+02:00', venue }),
    ].map(normalizeEvent);
    const groups = groupDuplicates(events);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 2]);
  });

  it('yhdistää kolmen lähteen saman tapahtuman', () => {
    const events = [
      raw({ source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00', venue: 'Paviljonki' }),
      raw({ source: 'keikkalista', title: 'Haloo Helsinki!', start: '2026-11-20', allDay: true, venue: 'Paviljonki' }),
      raw({ title: 'Haloo Helsinki! – Kevätkiertue 2027', start: '2026-11-20T17:00:00.000Z', venue: 'Jyväskylän Paviljonki' }),
    ].map(normalizeEvent);
    expect(groupDuplicates(events)).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/dedupe`
Expected: FAIL.

- [ ] **Step 4: Toteuta**

`src/dedupe/venues.ts`:

```ts
/** Tunnetut paikat: eri kirjoitusasut -> sama avain. Täydennä tarvittaessa. */
const KNOWN: [string, RegExp][] = [
  ['paviljonki', /paviljonk/],
  ['peurunka', /peurunk/],
  ['kaupunginteatteri', /kaupunginteatteri/],
  ['lutakko', /lutakko/],
  ['rockneck', /rockneck/],
  ['ilokivi', /ilokivi/],
  ['vakiopaine', /vakiopaine/],
  ['poppari', /poppari/],
];

const NOISE = new Set(['jyväskylä', 'jyväskylän', 'jyväskylässä']);

export function venueKey(venue?: string): string | undefined {
  if (!venue?.trim()) return undefined;
  const s = venue.toLowerCase();
  for (const [key, re] of KNOWN) if (re.test(s)) return key;
  const words = s
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !NOISE.has(w));
  return words.join(' ') || undefined;
}
```

`src/dedupe/normalize.ts`:

```ts
import { dayKey, localTime } from '../shared/time';
import type { RawEvent } from '../shared/types';
import { venueKey } from './venues';

const NOISE_TOKENS = new Set([
  'loppuunmyyty', 'k18', 'k16', 'k15', 'k13', 'k12', 'k7',
  'jyväskylä', 'jyväskylässä', 'jyväskylän', 'paviljongissa', 'peurungassa',
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFC')
    .replace(/\bk-(\d{1,2})\b/g, 'k$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !NOISE_TOKENS.has(t))
    .join(' ');
}

export interface Normalized extends RawEvent {
  nTitle: string;
  vKey?: string;
  day: string;
  time: string | null;
}

export function normalizeEvent(e: RawEvent): Normalized {
  return {
    ...e,
    nTitle: normalizeTitle(e.title),
    vKey: venueKey(e.venue),
    day: dayKey(e.start),
    time: e.allDay ? null : localTime(e.start),
  };
}
```

`src/dedupe/match.ts`:

```ts
import type { Normalized } from './normalize';

const SIMILARITY_THRESHOLD = 0.85;
const MAX_TIME_DIFF_MIN = 90;
const MIN_CONTAINED_LENGTH = 4;

function dice<T>(a: T[], b: T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const counts = new Map<T, number>();
  for (const x of a) counts.set(x, (counts.get(x) ?? 0) + 1);
  let overlap = 0;
  for (const x of b) {
    const c = counts.get(x) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(x, c - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

export function titleSimilarity(a: string, b: string): number {
  return Math.max(dice(a.split(' '), b.split(' ')), dice(bigrams(a), bigrams(b)));
}

function containsWhole(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_CONTAINED_LENGTH && ` ${long} `.includes(` ${short} `);
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function venueCompatible(a: Normalized, b: Normalized): boolean {
  return !a.vKey || !b.vKey || a.vKey === b.vKey;
}

function timeCompatible(a: Normalized, b: Normalized): boolean {
  return !a.time || !b.time || Math.abs(minutes(a.time) - minutes(b.time)) <= MAX_TIME_DIFF_MIN;
}

export function isSameEvent(a: Normalized, b: Normalized): boolean {
  if (a.day !== b.day || !venueCompatible(a, b) || !timeCompatible(a, b)) return false;
  return titleSimilarity(a.nTitle, b.nTitle) >= SIMILARITY_THRESHOLD || containsWhole(a.nTitle, b.nTitle);
}

/**
 * Ryhmittelee tuplat. Kellonajalliset käsitellään ensin, ja tapahtuma liitetään vain ryhmään,
 * jonka kaikki jäsenet sopivat siihen paikan ja kellonajan osalta.
 */
export function groupDuplicates(events: Normalized[]): Normalized[][] {
  const ordered = [...events].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (!!a.time !== !!b.time) return a.time ? -1 : 1;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });
  const groups: Normalized[][] = [];
  for (const e of ordered) {
    const target = groups.find(
      (g) =>
        g[0].day === e.day &&
        g.every((m) => venueCompatible(m, e) && timeCompatible(m, e)) &&
        g.some((m) => isSameEvent(m, e)),
    );
    if (target) target.push(e);
    else groups.push([e]);
  }
  return groups;
}
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/dedupe && npx tsc --noEmit`
Expected: PASS. Jos jokin `DEDUPE_CASES`-tapaus epäonnistuu, korjaa normalisointia tai sääntöjä. Älä muuta odotettua tulosta, ellei tapaus ole selvästi väärin.

- [ ] **Step 6: Commit**

```bash
git add src/dedupe test/dedupe test/dedupe.cases.ts
git commit -m "feat: tapahtumien normalisointi ja tuplien tunnistus"
```

---

### Task 8: Kategoriat, yhdistäminen ja pysyvä tunniste

**Files:**
- Create: `src/dedupe/categories.ts`, `src/dedupe/merge.ts`
- Test: `test/dedupe/categories.test.ts`, `test/dedupe/merge.test.ts`

**Interfaces:**
- Consumes: `Normalized`, `normalizeEvent`, `groupDuplicates` (Task 7); `Event`, `RawEvent` (Task 1)
- Produces: `CATEGORY_ORDER: string[]`, `categorize(raw: string[]): string[]`, `SOURCE_PRIORITY: string[]`, `stableId(e: Normalized): string`, `mergeGroup(group: Normalized[]): Event`, `dedupe(events: RawEvent[]): Event[]` (järjestetty alkuajan mukaan).

- [ ] **Step 1: Kirjoita testit**

`test/dedupe/categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { categorize } from '../../src/dedupe/categories';

describe('categorize', () => {
  it.each([
    [['Konsertit', 'Paviljonki Klubi'], ['Musiikki']],
    [['keikat'], ['Musiikki']],
    [['Pikkujoulut'], ['Ruoka ja juoma']],
    [['Taide'], ['Näyttelyt']],
    [['Urheilu', 'lapsille'], ['Urheilu', 'Lapset ja perheet']],
    [['Stand up'], ['Stand up']],
    [[], ['Muut']],
    [['jotain outoa'], ['Muut']],
  ])('%j → %j', (input, expected) => {
    expect(categorize(input)).toEqual(expected);
  });
});
```

`test/dedupe/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dedupe, mergeGroup, stableId } from '../../src/dedupe/merge';
import { normalizeEvent } from '../../src/dedupe/normalize';
import { raw } from '../dedupe.cases';

describe('mergeGroup', () => {
  it('valitsee kentät parhaista lähteistä ja listaa kaikki lähteet', () => {
    const kse = raw({
      source: 'keskisuomievents', title: 'Haloo Helsinki! – Kevätkiertue', start: '2026-11-20T17:00:00.000Z',
      venue: 'Jyväskylän Paviljonki', description: 'Pitkä kuvaus kalenterista, jossa on paljon tekstiä.',
      image: 'https://kse/kuva.jpg', categories: ['Musiikki'], url: 'https://kse/1',
    });
    const kl = raw({
      source: 'keikkalista', title: 'Haloo Helsinki!', start: '2026-11-20', allDay: true,
      venue: 'Paviljonki', url: 'https://kl/1', categories: ['keikat'],
    });
    const pav = raw({
      source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00',
      end: '2026-11-20T19:00:00.000Z', venue: 'Paviljonki – Sali A', url: 'https://pav/1',
      ticketUrl: 'https://lippu.fi/1', description: 'Lyhyt.', categories: ['Konsertit'],
    });
    const merged = mergeGroup([kse, kl, pav].map(normalizeEvent));
    expect(merged).toMatchObject({
      title: 'Haloo Helsinki!',
      start: '2026-11-20T19:00:00+02:00',
      end: '2026-11-20T19:00:00.000Z',
      allDay: false,
      venue: 'Paviljonki – Sali A',
      url: 'https://pav/1',
      ticketUrl: 'https://lippu.fi/1',
      image: 'https://kse/kuva.jpg',
      description: 'Pitkä kuvaus kalenterista, jossa on paljon tekstiä.',
      categories: ['Musiikki'],
      sources: [
        { source: 'paviljonki', url: 'https://pav/1' },
        { source: 'keikkalista', url: 'https://kl/1' },
        { source: 'keskisuomievents', url: 'https://kse/1' },
      ],
    });
  });

  it('koko päivän tapahtumat yhdistyvät koko päivän tapahtumaksi', () => {
    const a = raw({ source: 'keikkalista', title: 'X', start: '2026-11-20', allDay: true });
    expect(mergeGroup([normalizeEvent(a)])).toMatchObject({ start: '2026-11-20', allDay: true });
  });
});

describe('stableId', () => {
  it('on sama joka ajolla ja eri saman päivän eri esityksille', () => {
    const e14 = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue: 'Teatteri' }));
    const e14b = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T14:00:00+02:00', venue: 'Teatteri' }));
    const e19 = normalizeEvent(raw({ title: 'Peter Pan', start: '2026-11-14T19:00:00+02:00', venue: 'Teatteri' }));
    expect(stableId(e14)).toBe(stableId(e14b));
    expect(stableId(e14)).not.toBe(stableId(e19));
    expect(stableId(e14)).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('dedupe', () => {
  it('yhdistää tuplat ja järjestää alkuajan mukaan', () => {
    const events = dedupe([
      raw({ title: 'B', start: '2026-11-21T18:00:00+02:00', venue: 'Lutakko' }),
      raw({ source: 'paviljonki', title: 'Haloo Helsinki!', start: '2026-11-20T19:00:00+02:00', venue: 'Paviljonki' }),
      raw({ title: 'Haloo Helsinki!', start: '2026-11-20T17:00:00.000Z', venue: 'Jyväskylän Paviljonki' }),
    ]);
    expect(events.map((e) => e.title)).toEqual(['Haloo Helsinki!', 'B']);
    expect(events[0].sources).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/dedupe/categories.test.ts test/dedupe/merge.test.ts`
Expected: FAIL.

- [ ] **Step 3: Toteuta**

`src/dedupe/categories.ts`:

```ts
const RULES: [string, RegExp][] = [
  ['Musiikki', /musiik|konsert|keikk|music|kuoro|ooppera|jazz|rock|orkester/],
  ['Teatteri', /teatter|näytelm|musikaal|theat/],
  ['Stand up', /stand ?up|komiik/],
  ['Tanssi', /tanssi|baletti/],
  ['Näyttelyt', /näyttely|taide|galleria|museo/],
  ['Urheilu', /urheilu|liikunta|salibandy|jääkiekko|jalkapallo|ottelu|juoks|sport/],
  ['Lapset ja perheet', /lapsi|lapset|lapsille|perhe|nuoret|kids/],
  ['Ruoka ja juoma', /ruoka|viini|olut|food|pikkujoulu/],
  ['Messut', /messu|markkina/],
  ['Kurssit ja luennot', /kurssi|luento|työpaja|koulutus/],
];

export const CATEGORY_ORDER = [...RULES.map(([name]) => name), 'Muut'];

export function categorize(raw: string[]): string[] {
  const text = raw.join(' | ').toLowerCase();
  const found = RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
  return found.length ? found : ['Muut'];
}
```

`src/dedupe/merge.ts`:

```ts
import { createHash } from 'node:crypto';
import type { Event, RawEvent, SourceLink } from '../shared/types';
import { categorize } from './categories';
import { groupDuplicates } from './match';
import { normalizeEvent, type Normalized } from './normalize';

/** Tapahtumapaikkojen omat sivut ensin, kokoavat kalenterit viimeisenä. */
export const SOURCE_PRIORITY = ['paviljonki', 'peurunka', 'keikkalista', 'keskisuomievents'];

const rank = (source: string) => {
  const i = SOURCE_PRIORITY.indexOf(source);
  return i === -1 ? SOURCE_PRIORITY.length : i;
};

export function stableId(e: Normalized): string {
  return createHash('sha1')
    .update(`${e.nTitle}|${e.day}|${e.time ?? ''}|${e.vKey ?? ''}`)
    .digest('hex')
    .slice(0, 12);
}

export function mergeGroup(group: Normalized[]): Event {
  const sorted = [...group].sort((a, b) => rank(a.source) - rank(b.source));
  const primary = sorted[0];
  const timing = sorted.find((e) => e.time !== null) ?? primary;
  const pick = <K extends 'venue' | 'address' | 'city' | 'ticketUrl' | 'image'>(key: K) =>
    sorted.find((e) => e[key])?.[key];
  const description = sorted
    .map((e) => e.description)
    .filter((d): d is string => !!d)
    .sort((a, b) => b.length - a.length)[0];

  const sources: SourceLink[] = [];
  for (const e of sorted) {
    if (!sources.some((s) => s.source === e.source && s.url === e.url)) sources.push({ source: e.source, url: e.url });
  }

  return {
    id: stableId({ ...primary, time: timing.time }),
    title: primary.title,
    start: timing.start,
    end: timing.end,
    allDay: timing.time === null,
    venue: pick('venue'),
    address: pick('address'),
    city: pick('city'),
    url: primary.url,
    ticketUrl: pick('ticketUrl'),
    image: pick('image'),
    description,
    categories: categorize(sorted.flatMap((e) => e.categories ?? [])),
    sources,
  };
}

export function dedupe(events: RawEvent[]): Event[] {
  return groupDuplicates(events.map(normalizeEvent))
    .map(mergeGroup)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title, 'fi'));
}
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run test/dedupe && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dedupe test/dedupe
git commit -m "feat: kategoriat, tapahtumien yhdistäminen ja pysyvä tunniste"
```

---

### Task 9: Keruun ajo, varmuuskopiot ja tila

**Files:**
- Create: `src/scrape/run.ts`, `src/scrape/cli.ts`
- Test: `test/scrape/run.test.ts`
- Generated: `public/events.json`, `data/raw/*.json`

**Interfaces:**
- Consumes: `Source`, `FetchContext`, `EventsFile`, `SourceStatus`, `RawEvent` (Task 1); `dayKey`, `addDays` (Task 1); `createFetchContext` (Task 2); `SOURCES` (Task 6); `dedupe` (Task 8)
- Produces: `filterWindow(events: RawEvent[], now: Date, days?: number): RawEvent[]`, `runScrape(deps: RunDeps): Promise<EventsFile>`, `interface RunDeps { sources; ctx; now; previous: EventsFile | null; readRaw(id): Promise<RawEvent[] | null>; writeRaw(id, events): Promise<void> }`, `failingSources(file: EventsFile): string[]`.

- [ ] **Step 1: Kirjoita testit**

`test/scrape/run.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { failingSources, filterWindow, runScrape, type RunDeps } from '../../src/scrape/run';
import type { EventsFile, RawEvent, Source } from '../../src/shared/types';
import { raw } from '../dedupe.cases';
import { fakeCtx } from '../helpers';

const NOW = new Date('2026-10-11T09:00:00+03:00');

function source(id: string, result: RawEvent[] | Error): Source {
  return {
    id,
    name: id.toUpperCase(),
    fetch: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

function deps(sources: Source[], previous: EventsFile | null = null, stored: Record<string, RawEvent[]> = {}) {
  const written: Record<string, RawEvent[]> = {};
  const d: RunDeps = {
    sources,
    ctx: fakeCtx({}),
    now: NOW,
    previous,
    readRaw: async (id) => stored[id] ?? null,
    writeRaw: async (id, events) => {
      written[id] = events;
    },
  };
  return { d, written };
}

describe('filterWindow', () => {
  it('poistaa menneet, pitää käynnissä olevat ja rajaa 183 päivään', () => {
    const events = [
      raw({ title: 'eilen', start: '2026-10-10T18:00:00+03:00' }),
      raw({ title: 'tänään', start: '2026-10-11T18:00:00+03:00' }),
      raw({ title: 'käynnissä', start: '2026-10-04', end: '2026-11-01', allDay: true }),
      raw({ title: 'kaukana', start: '2027-06-01T18:00:00+03:00' }),
    ];
    expect(filterWindow(events, NOW).map((e) => e.title)).toEqual(['tänään', 'käynnissä']);
  });
});

describe('runScrape', () => {
  it('kerää onnistuneet lähteet ja tallentaa varmuuskopion', async () => {
    const ev = raw({ source: 'a', title: 'Keikka', start: '2026-10-12T19:00:00+03:00' });
    const { d, written } = deps([source('a', [ev])]);
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Keikka']);
    expect(written.a).toEqual([ev]);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: NOW.toISOString(), lastError: null, consecutiveFailures: 0, count: 1,
    });
  });

  it('käyttää varmuuskopiota, kun lähde epäonnistuu, ja kasvattaa virhelaskuria', async () => {
    const old = raw({ source: 'a', title: 'Vanha', start: '2026-10-12T19:00:00+03:00' });
    const previous: EventsFile = {
      generatedAt: '', events: [],
      sources: { a: { name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: null, consecutiveFailures: 2, count: 7 } },
    };
    const { d } = deps([source('a', new Error('HTTP 500'))], previous, { a: [old] });
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Vanha']);
    expect(file.sources.a).toEqual({
      name: 'A', lastSuccess: '2026-10-10T06:00:00.000Z', lastError: 'HTTP 500', consecutiveFailures: 3, count: 7,
    });
    expect(failingSources(file)).toEqual(['a']);
  });

  it('nolla tapahtumaa, kun edellisellä kerralla oli > 5, on virhe', async () => {
    const previous: EventsFile = {
      generatedAt: '', events: [],
      sources: { a: { name: 'A', lastSuccess: 'x', lastError: null, consecutiveFailures: 0, count: 40 } },
    };
    const { d, written } = deps([source('a', [])], previous, { a: [] });
    const file = await runScrape(d);
    expect(file.sources.a.lastError).toMatch(/0 tapahtumaa/);
    expect(written.a).toBeUndefined();
  });

  it('yksi rikkinäinen lähde ei estä muita', async () => {
    const ok = raw({ source: 'b', title: 'Toimii', start: '2026-10-12T19:00:00+03:00' });
    const { d } = deps([source('a', new Error('kaatui')), source('b', [ok])]);
    const file = await runScrape(d);
    expect(file.events.map((e) => e.title)).toEqual(['Toimii']);
    expect(file.sources.a.consecutiveFailures).toBe(1);
  });
});
```

- [ ] **Step 2: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/scrape/run.test.ts`
Expected: FAIL.

- [ ] **Step 3: Toteuta**

`src/scrape/run.ts`:

```ts
import { dedupe } from '../dedupe/merge';
import { addDays, dayKey } from '../shared/time';
import type { EventsFile, FetchContext, RawEvent, Source, SourceStatus } from '../shared/types';

export const WINDOW_DAYS = 183;
const FAILURE_ALERT_THRESHOLD = 3;
const ZERO_RESULT_GUARD = 5;

export interface RunDeps {
  sources: Source[];
  ctx: FetchContext;
  now: Date;
  previous: EventsFile | null;
  readRaw(id: string): Promise<RawEvent[] | null>;
  writeRaw(id: string, events: RawEvent[]): Promise<void>;
}

export function filterWindow(events: RawEvent[], now: Date, days = WINDOW_DAYS): RawEvent[] {
  const today = dayKey(now.toISOString());
  const last = addDays(today, days);
  return events.filter((e) => dayKey(e.end ?? e.start) >= today && dayKey(e.start) <= last);
}

export async function runScrape(d: RunDeps): Promise<EventsFile> {
  const all: RawEvent[] = [];
  const sources: Record<string, SourceStatus> = {};

  for (const src of d.sources) {
    const prev = d.previous?.sources[src.id];
    try {
      const events = await src.fetch(d.ctx);
      if (events.length === 0 && (prev?.count ?? 0) > ZERO_RESULT_GUARD) {
        throw new Error(`Lähde palautti 0 tapahtumaa (edellisellä kerralla ${prev!.count})`);
      }
      await d.writeRaw(src.id, events);
      all.push(...events);
      sources[src.id] = {
        name: src.name, lastSuccess: d.now.toISOString(), lastError: null, consecutiveFailures: 0, count: events.length,
      };
      d.ctx.log(`${src.id}: ${events.length} tapahtumaa`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fallback = (await d.readRaw(src.id)) ?? [];
      all.push(...fallback);
      sources[src.id] = {
        name: src.name,
        lastSuccess: prev?.lastSuccess ?? null,
        lastError: message,
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
        count: prev?.count ?? fallback.length,
      };
      d.ctx.log(`${src.id}: VIRHE ${message} – käytetään ${fallback.length} tallennettua tapahtumaa`);
    }
  }

  return { generatedAt: d.now.toISOString(), sources, events: dedupe(filterWindow(all, d.now)) };
}

export function failingSources(file: EventsFile): string[] {
  return Object.entries(file.sources)
    .filter(([, s]) => s.consecutiveFailures >= FAILURE_ALERT_THRESHOLD)
    .map(([id]) => id);
}
```

`src/scrape/cli.ts`:

```ts
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { SOURCES } from '../sources';
import type { EventsFile, RawEvent } from '../shared/types';
import { createFetchContext } from './http';
import { failingSources, runScrape } from './run';

const OUT = 'public/events.json';
const RAW_DIR = 'data/raw';

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

const result = await runScrape({
  sources: SOURCES,
  ctx: createFetchContext(),
  now: new Date(),
  previous: await readJson<EventsFile>(OUT),
  readRaw: (id) => readJson<RawEvent[]>(`${RAW_DIR}/${id}.json`),
  writeRaw: async (id, events) => {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(`${RAW_DIR}/${id}.json`, JSON.stringify(events, null, 1));
  },
});

await mkdir('public', { recursive: true });
await writeFile(OUT, JSON.stringify(result));
console.log(`Valmis: ${result.events.length} tapahtumaa -> ${OUT}`);

const failing = failingSources(result);
if (failing.length) console.log(`Toistuvasti epäonnistuvat lähteet: ${failing.join(', ')}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `failing=${failing.join(' ')}\n`);
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: kaikki testit PASS.

- [ ] **Step 5: Aja oikea keruu**

Run: `npm run scrape`
Expected: jokaiselle lähteelle rivi `<id>: N tapahtumaa` (keskisuomievents noin 2 000, paviljonki noin 60–70, peurunka noin 50, keikkalista noin 30) ja lopuksi `Valmis: N tapahtumaa`. Keruu kestää noin 1–2 minuuttia.

Tarkista tuplien yhdistyminen:

```bash
node -e "const d=require('./public/events.json'); const multi=d.events.filter(e=>e.sources.length>1); console.log('yhdistettyjä:', multi.length); multi.slice(0,10).forEach(e=>console.log(e.start, e.title, e.sources.map(s=>s.source).join('+')))"
```

Expected: ainakin muutama yhdistetty tapahtuma (esim. Paviljongin konsertit, jotka ovat myös kalenterissa). Jos jokin lähde palauttaa `HTTP 403`, kirjaa se tiedostoon `docs/superpowers/notes.md` ja kokeile `userAgent()`-funktiossa selainmaista merkkijonoa `Mozilla/5.0 (compatible; TapahtumatBot/0.1; +<repo>)`. Jos havaitset selviä tuplia, joita ei yhdistetty, tai vääriä yhdistämisiä, lisää ne tapauksiksi tiedostoon `test/dedupe.cases.ts` ja korjaa Task 7:n logiikkaa.

- [ ] **Step 6: Commit**

```bash
git add src/scrape test/scrape public/events.json data/raw
git commit -m "feat: keruun ajo, varmuuskopiot ja lähteiden tila"
```

---

### Task 10: Kalenterilinkit ja .ics-tiedosto

**Files:**
- Create: `src/web/calendar/common.ts`, `src/web/calendar/google.ts`, `src/web/calendar/outlook.ts`, `src/web/calendar/ics.ts`
- Test: `test/web/calendar.test.ts`

**Interfaces:**
- Consumes: `Event` (Task 1); `dayKey`, `addDays`, `isDateOnly` (Task 1)
- Produces: `eventTimes(e)`, `eventDetails(e)`, `eventLocation(e)`, `utcStamp(d: Date)`, `googleCalendarUrl(e): string`, `outlookCalendarUrl(e): string`, `escapeIcs(s)`, `foldLine(line)`, `buildIcs(e, now?): string`, `icsFileName(e): string`, `downloadIcs(e): void`.

- [ ] **Step 1: Kirjoita testit**

`test/web/calendar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { eventLocation, eventTimes } from '../../src/web/calendar/common';
import { googleCalendarUrl } from '../../src/web/calendar/google';
import { buildIcs, escapeIcs, foldLine, icsFileName } from '../../src/web/calendar/ics';
import { outlookCalendarUrl } from '../../src/web/calendar/outlook';

const base: Event = {
  id: 'abc123def456',
  title: 'Haloo Helsinki!',
  start: '2026-11-20T19:00:00+02:00',
  end: '2026-11-20T21:30:00+02:00',
  allDay: false,
  venue: 'Paviljonki',
  address: 'Lutakonaukio 12',
  city: 'Jyväskylä',
  url: 'https://pav/1',
  ticketUrl: 'https://lippu.fi/1',
  description: 'Rock, pop; ja muuta.\nToinen rivi',
  categories: ['Musiikki'],
  sources: [{ source: 'paviljonki', url: 'https://pav/1' }],
};

describe('eventTimes', () => {
  it('käyttää 2 tunnin oletuskestoa, jos loppuaika puuttuu', () => {
    const t = eventTimes({ ...base, end: undefined });
    expect(t.allDay).toBe(false);
    if (!t.allDay) expect(t.end.getTime() - t.start.getTime()).toBe(2 * 3600_000);
  });
  it('korjaa loppuajan, joka on ennen alkua', () => {
    const t = eventTimes({ ...base, end: '2026-11-20T18:00:00+02:00' });
    if (!t.allDay) expect(t.end.getTime() - t.start.getTime()).toBe(2 * 3600_000);
  });
  it('koko päivän tapahtuma: loppupäivä on poissulkeva', () => {
    expect(eventTimes({ ...base, allDay: true, start: '2026-10-04', end: '2026-11-01' }))
      .toEqual({ allDay: true, startDay: '2026-10-04', endDayExclusive: '2026-11-02' });
  });
});

describe('eventLocation', () => {
  it('yhdistää paikan, osoitteen ja kaupungin', () => {
    expect(eventLocation(base)).toBe('Paviljonki, Lutakonaukio 12, Jyväskylä');
  });
  it('ei toista kaupunkia, jos osoite sisältää sen', () => {
    expect(eventLocation({ ...base, address: 'Asemakatu 7, 40100 Jyväskylä' })).toBe('Paviljonki, Asemakatu 7, 40100 Jyväskylä');
  });
});

describe('googleCalendarUrl', () => {
  it('muodostaa valmiin tapahtuman linkin UTC-ajoilla', () => {
    const url = new URL(googleCalendarUrl(base));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Haloo Helsinki!');
    expect(url.searchParams.get('dates')).toBe('20261120T170000Z/20261120T193000Z');
    expect(url.searchParams.get('location')).toBe('Paviljonki, Lutakonaukio 12, Jyväskylä');
    expect(url.searchParams.get('details')).toContain('https://lippu.fi/1');
  });
  it('koko päivän tapahtuma päivämäärinä', () => {
    const url = new URL(googleCalendarUrl({ ...base, allDay: true, start: '2026-11-20', end: undefined }));
    expect(url.searchParams.get('dates')).toBe('20261120/20261121');
  });
});

describe('outlookCalendarUrl', () => {
  it('muodostaa compose-linkin', () => {
    const url = new URL(outlookCalendarUrl(base));
    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose');
    expect(url.searchParams.get('subject')).toBe('Haloo Helsinki!');
    expect(url.searchParams.get('startdt')).toBe('2026-11-20T17:00:00.000Z');
    expect(url.searchParams.get('enddt')).toBe('2026-11-20T19:30:00.000Z');
  });
  it('koko päivän tapahtuma', () => {
    const url = new URL(outlookCalendarUrl({ ...base, allDay: true, start: '2026-11-20', end: undefined }));
    expect(url.searchParams.get('allday')).toBe('true');
    expect(url.searchParams.get('startdt')).toBe('2026-11-20');
    expect(url.searchParams.get('enddt')).toBe('2026-11-21');
  });
});

describe('ics', () => {
  it('escapeIcs käsittelee erikoismerkit', () => {
    expect(escapeIcs('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('foldLine pitää rivit enintään 75 tavussa myös monitavuisilla merkeillä', () => {
    const folded = foldLine('DESCRIPTION:' + 'ä'.repeat(100));
    const enc = new TextEncoder();
    for (const line of folded.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + 'ä'.repeat(100));
  });

  it('buildIcs tuottaa kelvollisen VEVENTin', () => {
    const ics = buildIcs(base, new Date('2026-10-11T06:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc123def456@tapahtumat');
    expect(ics).toContain('DTSTAMP:20261011T060000Z');
    expect(ics).toContain('DTSTART:20261120T170000Z');
    expect(ics).toContain('DTEND:20261120T193000Z');
    expect(ics).toContain('SUMMARY:Haloo Helsinki!');
    expect(ics).toContain('LOCATION:Paviljonki\\, Lutakonaukio 12\\, Jyväskylä');
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('buildIcs koko päivän tapahtumalle', () => {
    const ics = buildIcs({ ...base, allDay: true, start: '2026-11-20', end: undefined });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261120');
    expect(ics).toContain('DTEND;VALUE=DATE:20261121');
  });

  it('icsFileName', () => {
    expect(icsFileName({ ...base, title: 'Äänekäs Ilta: Rock & Pop!' })).toBe('aanekas-ilta-rock-pop.ics');
  });
});
```

- [ ] **Step 2: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/web/calendar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Toteuta**

`src/web/calendar/common.ts`:

```ts
import { addDays, dayKey, isDateOnly } from '../../shared/time';
import type { Event } from '../../shared/types';

export const DEFAULT_DURATION_MS = 2 * 3600_000;
const MAX_DETAILS = 1500;

export type EventTimes =
  | { allDay: true; startDay: string; endDayExclusive: string }
  | { allDay: false; start: Date; end: Date };

export function eventTimes(e: Event): EventTimes {
  if (e.allDay) {
    const startDay = dayKey(e.start);
    const lastDay = e.end ? dayKey(e.end) : startDay;
    return { allDay: true, startDay, endDayExclusive: addDays(lastDay < startDay ? startDay : lastDay, 1) };
  }
  const start = new Date(e.start);
  let end = e.end && !isDateOnly(e.end) ? new Date(e.end) : new Date(start.getTime() + DEFAULT_DURATION_MS);
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { allDay: false, start, end };
}

export function eventDetails(e: Event): string {
  return [e.description, e.ticketUrl ? `Liput: ${e.ticketUrl}` : '', e.url]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_DETAILS);
}

export function eventLocation(e: Event): string {
  const parts = [e.venue, e.address];
  if (e.city && !(e.address ?? '').includes(e.city)) parts.push(e.city);
  return parts.filter(Boolean).join(', ');
}

/** 2026-11-20T17:00:00.000Z -> 20261120T170000Z */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export const compactDay = (day: string) => day.replace(/-/g, '');
```

`src/web/calendar/google.ts`:

```ts
import type { Event } from '../../shared/types';
import { compactDay, eventDetails, eventLocation, eventTimes, utcStamp } from './common';

export function googleCalendarUrl(e: Event): string {
  const t = eventTimes(e);
  const dates = t.allDay
    ? `${compactDay(t.startDay)}/${compactDay(t.endDayExclusive)}`
    : `${utcStamp(t.start)}/${utcStamp(t.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates,
    details: eventDetails(e),
    location: eventLocation(e),
    ctz: 'Europe/Helsinki',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
```

`src/web/calendar/outlook.ts`:

```ts
import type { Event } from '../../shared/types';
import { eventDetails, eventLocation, eventTimes } from './common';

export function outlookCalendarUrl(e: Event): string {
  const t = eventTimes(e);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    body: eventDetails(e),
    location: eventLocation(e),
  });
  if (t.allDay) {
    params.set('startdt', t.startDay);
    params.set('enddt', t.endDayExclusive);
    params.set('allday', 'true');
  } else {
    params.set('startdt', t.start.toISOString());
    params.set('enddt', t.end.toISOString());
  }
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
```

`src/web/calendar/ics.ts`:

```ts
import type { Event } from '../../shared/types';
import { compactDay, eventDetails, eventLocation, eventTimes, utcStamp } from './common';

export function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545: rivit enintään 75 tavua, jatkorivit alkavat välilyönnillä. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(e: Event, now = new Date()): string {
  const t = eventTimes(e);
  const when = t.allDay
    ? [`DTSTART;VALUE=DATE:${compactDay(t.startDay)}`, `DTEND;VALUE=DATE:${compactDay(t.endDayExclusive)}`]
    : [`DTSTART:${utcStamp(t.start)}`, `DTEND:${utcStamp(t.end)}`];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tapahtumat//FI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@tapahtumat`,
    `DTSTAMP:${utcStamp(now)}`,
    ...when,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(eventDetails(e))}`,
    `LOCATION:${escapeIcs(eventLocation(e))}`,
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function icsFileName(e: Event): string {
  const slug = e.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${slug || 'tapahtuma'}.ics`;
}

export function downloadIcs(e: Event): void {
  const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(e);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run test/web/calendar.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/calendar test/web/calendar.test.ts
git commit -m "feat: Google-, Outlook- ja .ics-kalenterilinkit"
```

---

### Task 11: Käyttöliittymän logiikka (suodattimet, ryhmittely, muotoilu, asetukset)

**Files:**
- Create: `src/web/logic/filters.ts`, `src/web/logic/grouping.ts`, `src/web/logic/format.ts`, `src/web/logic/prefs.ts`
- Test: `test/web/filters.test.ts`, `test/web/grouping.test.ts`, `test/web/format.test.ts`, `test/web/prefs.test.ts`

**Interfaces:**
- Consumes: `Event` (Task 1); `dayKey`, `addDays`, `localTime`, `isDateOnly` (Task 1); `googleCalendarUrl`, `outlookCalendarUrl`, `downloadIcs` (Task 10)
- Produces:
  - `type Range = 'all' | 'today' | 'weekend' | 'week' | 'custom'`, `interface Filters { range: Range; from?: string; to?: string; category?: string; venue?: string; q?: string }`, `filtersFromSearch(search: string): Filters`, `filtersToSearch(f: Filters): string`, `rangeBounds(f, today): [string, string] | null`, `applyFilters(events, f, today): Event[]`
  - `interface ListItem { event: Event; series: Event[] }`, `interface DayGroup { day: string; label: string; items: ListItem[] }`, `buildDayGroups(events, today): DayGroup[]`, `limitGroups(groups, limit): { groups: DayGroup[]; hasMore: boolean }`
  - `shortDate(day): string`, `dayLabel(day, today): string`, `formatTime(e): string`, `seriesSummary(series): string`, `formatAge(iso, now): string`
  - `type CalendarKind = 'google' | 'outlook' | 'ics'`, `CALENDAR_LABELS`, `getCalendarPref(storage?)`, `setCalendarPref(kind | null, storage?)`, `addToCalendar(e, kind)`

- [ ] **Step 1: Kirjoita testit**

`test/web/filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { applyFilters, filtersFromSearch, filtersToSearch, rangeBounds } from '../../src/web/logic/filters';

const ev = (p: Partial<Event> & Pick<Event, 'title' | 'start'>): Event => ({
  id: p.title, allDay: false, url: 'u', categories: ['Muut'], sources: [], ...p,
});
const TODAY = '2026-10-14'; // keskiviikko

describe('URL-tila', () => {
  it('kulkee edestakaisin', () => {
    const f = { range: 'custom' as const, from: '2026-10-20', to: '2026-10-25', category: 'Musiikki', q: 'rock' };
    expect(filtersFromSearch('?' + filtersToSearch(f))).toEqual(f);
  });
  it('tuntematon aikaväli on "all" eikä oletusarvoja kirjoiteta', () => {
    expect(filtersFromSearch('?range=xyz')).toEqual({ range: 'all' });
    expect(filtersToSearch({ range: 'all' })).toBe('');
  });
});

describe('rangeBounds', () => {
  it.each([
    ['today', TODAY, [TODAY, TODAY]],
    ['week', TODAY, [TODAY, '2026-10-20']],
    ['weekend', TODAY, ['2026-10-16', '2026-10-18']],
    ['weekend', '2026-10-17', ['2026-10-17', '2026-10-18']],
    ['weekend', '2026-10-18', ['2026-10-18', '2026-10-18']],
  ] as const)('%s @ %s', (range, today, expected) => {
    expect(rangeBounds({ range }, today)).toEqual(expected);
  });
  it('all = ei rajausta', () => {
    expect(rangeBounds({ range: 'all' }, TODAY)).toBeNull();
  });
});

describe('applyFilters', () => {
  const events = [
    ev({ title: 'Rock-ilta', start: '2026-10-14T20:00:00+03:00', categories: ['Musiikki'], venue: 'Lutakko' }),
    ev({ title: 'Näyttely', start: '2026-10-01', end: '2026-11-01', allDay: true, categories: ['Näyttelyt'] }),
    ev({ title: 'Ensi viikko', start: '2026-10-22T18:00:00+03:00' }),
    ev({ title: 'Mennyt', start: '2026-10-10T18:00:00+03:00' }),
  ];
  it('tänään sisältää käynnissä olevan näyttelyn mutta ei menneitä', () => {
    expect(applyFilters(events, { range: 'today' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta', 'Näyttely']);
  });
  it('kategoria, paikka ja haku', () => {
    expect(applyFilters(events, { range: 'all', category: 'Musiikki' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta']);
    expect(applyFilters(events, { range: 'all', venue: 'Lutakko' }, TODAY).map((e) => e.title)).toEqual(['Rock-ilta']);
    expect(applyFilters(events, { range: 'all', q: 'NÄYTT' }, TODAY).map((e) => e.title)).toEqual(['Näyttely']);
  });
});
```

`test/web/grouping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { buildDayGroups, limitGroups } from '../../src/web/logic/grouping';

const ev = (p: Partial<Event> & Pick<Event, 'title' | 'start'>): Event => ({
  id: `${p.title}-${p.start}`, allDay: false, url: 'u', categories: [], sources: [], ...p,
});
const TODAY = '2026-10-14';

describe('buildDayGroups', () => {
  it('ryhmittelee päivittäin ja nostaa käynnissä olevan tapahtuman tähän päivään', () => {
    const groups = buildDayGroups([
      ev({ title: 'Näyttely', start: '2026-10-01', end: '2026-11-01', allDay: true }),
      ev({ title: 'Keikka', start: '2026-10-14T20:00:00+03:00' }),
      ev({ title: 'Huominen', start: '2026-10-15T18:00:00+03:00' }),
    ], TODAY);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.event.title)])).toEqual([
      ['Tänään', ['Näyttely', 'Keikka']],
      ['Huomenna', ['Huominen']],
    ]);
  });

  it('kokoaa saman nimen ja paikan esitykset yhdeksi riviksi', () => {
    const groups = buildDayGroups([
      ev({ title: 'Peter Pan', venue: 'Teatteri', start: '2026-10-15T19:00:00+03:00' }),
      ev({ title: 'Peter Pan', venue: 'Teatteri', start: '2026-10-20T19:00:00+03:00' }),
      ev({ title: 'Peter Pan', venue: 'Muu', start: '2026-10-21T19:00:00+03:00' }),
    ], TODAY);
    expect(groups).toHaveLength(2);
    expect(groups[0].items[0].series).toHaveLength(2);
  });
});

describe('limitGroups', () => {
  it('katkaisee tapahtumamäärän ja kertoo, onko lisää', () => {
    const groups = buildDayGroups([
      ev({ title: 'A', start: '2026-10-14T18:00:00+03:00' }),
      ev({ title: 'B', start: '2026-10-14T19:00:00+03:00' }),
      ev({ title: 'C', start: '2026-10-15T19:00:00+03:00' }),
    ], TODAY);
    const limited = limitGroups(groups, 2);
    expect(limited.groups.flatMap((g) => g.items).length).toBe(2);
    expect(limited.hasMore).toBe(true);
    expect(limitGroups(groups, 10).hasMore).toBe(false);
  });
});
```

`test/web/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Event } from '../../src/shared/types';
import { dayLabel, formatAge, formatTime, seriesSummary, shortDate } from '../../src/web/logic/format';

const ev = (p: Partial<Event> & Pick<Event, 'start'>): Event => ({
  id: 'x', title: 'x', allDay: false, url: 'u', categories: [], sources: [], ...p,
});

describe('format', () => {
  it('shortDate ja dayLabel', () => {
    expect(shortDate('2026-10-04')).toBe('4.10.');
    expect(dayLabel('2026-10-14', '2026-10-14')).toBe('Tänään');
    expect(dayLabel('2026-10-15', '2026-10-14')).toBe('Huomenna');
    expect(dayLabel('2026-10-17', '2026-10-14')).toBe('La 17.10.');
  });
  it('formatTime', () => {
    expect(formatTime(ev({ start: '2026-10-14T19:00:00+03:00' }))).toBe('19.00');
    expect(formatTime(ev({ start: '2026-10-14T19:00:00+03:00', end: '2026-10-14T21:30:00+03:00' }))).toBe('19.00–21.30');
    expect(formatTime(ev({ start: '2026-10-14T10:00:00+03:00', end: '2026-10-16T18:00:00+03:00' }))).toBe('10.00 (päättyy 16.10.)');
    expect(formatTime(ev({ start: '2026-10-14', allDay: true }))).toBe('Koko päivä');
    expect(formatTime(ev({ start: '2026-10-04', end: '2026-11-01', allDay: true }))).toBe('4.10.–1.11.');
  });
  it('seriesSummary', () => {
    expect(seriesSummary([ev({ start: '2026-10-15T19:00:00+03:00' }), ev({ start: '2026-11-30T19:00:00+02:00' })]))
      .toBe('2 esitystä 15.10.–30.11.');
  });
  it('formatAge', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(formatAge('2026-10-14T11:30:00Z', now)).toBe('juuri äsken');
    expect(formatAge('2026-10-14T07:00:00Z', now)).toBe('5 t sitten');
    expect(formatAge('2026-10-12T07:00:00Z', now)).toBe('2 pv sitten');
  });
});
```

`test/web/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getCalendarPref, setCalendarPref } from '../../src/web/logic/prefs';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  };
}

const throwing = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
  removeItem: () => { throw new Error('SecurityError'); },
} as unknown as Storage;

describe('kalenterivalinnan muistaminen', () => {
  it('tallentaa ja lukee valinnan', () => {
    const s = memoryStorage();
    expect(getCalendarPref(s)).toBeNull();
    setCalendarPref('google', s);
    expect(getCalendarPref(s)).toBe('google');
    setCalendarPref(null, s);
    expect(getCalendarPref(s)).toBeNull();
  });
  it('hylkää tuntemattoman arvon', () => {
    const s = memoryStorage();
    s.setItem('tapahtumat.calendar', 'yahoo');
    expect(getCalendarPref(s)).toBeNull();
  });
  it('estetty tallennustila ei kaada', () => {
    expect(getCalendarPref(throwing)).toBeNull();
    expect(() => setCalendarPref('ics', throwing)).not.toThrow();
  });
});
```

- [ ] **Step 2: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/web`
Expected: uudet testit FAIL (kalenteritestit menevät läpi).

- [ ] **Step 3: Toteuta**

`src/web/logic/format.ts`:

```ts
import { addDays, dayKey, isDateOnly, localTime } from '../../shared/time';
import type { Event } from '../../shared/types';

const WEEKDAYS = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];

export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d}.${m}.`;
}

export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Tänään';
  if (day === addDays(today, 1)) return 'Huomenna';
  return `${WEEKDAYS[weekday(day)]} ${shortDate(day)}`;
}

const hm = (iso: string) => localTime(iso)!.replace(':', '.');

export function formatTime(e: Event): string {
  const startDay = dayKey(e.start);
  const endDay = e.end ? dayKey(e.end) : startDay;
  if (e.allDay) return startDay === endDay ? 'Koko päivä' : `${shortDate(startDay)}–${shortDate(endDay)}`;
  if (!e.end || isDateOnly(e.end)) return hm(e.start);
  if (endDay === startDay) return `${hm(e.start)}–${hm(e.end)}`;
  return `${hm(e.start)} (päättyy ${shortDate(endDay)})`;
}

export function seriesSummary(series: Event[]): string {
  const first = dayKey(series[0].start);
  const last = dayKey(series[series.length - 1].start);
  return `${series.length} esitystä ${shortDate(first)}–${shortDate(last)}`;
}

export function formatAge(iso: string, now: Date): string {
  const minutes = (now.getTime() - Date.parse(iso)) / 60_000;
  if (minutes < 60) return 'juuri äsken';
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} t sitten`;
  return `${Math.floor(minutes / (24 * 60))} pv sitten`;
}
```

`src/web/logic/filters.ts`:

```ts
import { addDays, dayKey } from '../../shared/time';
import type { Event } from '../../shared/types';
import { weekday } from './format';

export type Range = 'all' | 'today' | 'weekend' | 'week' | 'custom';
const RANGES: Range[] = ['all', 'today', 'weekend', 'week', 'custom'];

export interface Filters {
  range: Range;
  from?: string;
  to?: string;
  category?: string;
  venue?: string;
  q?: string;
}

const KEYS = ['from', 'to', 'category', 'venue', 'q'] as const;

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  const range = p.get('range') as Range | null;
  const f: Filters = { range: range && RANGES.includes(range) ? range : 'all' };
  for (const k of KEYS) {
    const v = p.get(k);
    if (v) f[k] = v;
  }
  return f;
}

export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.range !== 'all') p.set('range', f.range);
  for (const k of KEYS) if (f[k]) p.set(k, f[k]!);
  return p.toString();
}

export function rangeBounds(f: Filters, today: string): [string, string] | null {
  switch (f.range) {
    case 'today':
      return [today, today];
    case 'week':
      return [today, addDays(today, 6)];
    case 'weekend': {
      const dow = weekday(today);
      if (dow === 0) return [today, today];
      if (dow === 6) return [today, addDays(today, 1)];
      const friday = addDays(today, 5 - dow);
      return [friday, addDays(friday, 2)];
    }
    case 'custom':
      return [f.from ?? today, f.to ?? '9999-12-31'];
    default:
      return null;
  }
}

export function applyFilters(events: Event[], f: Filters, today: string): Event[] {
  const bounds = rangeBounds(f, today);
  const q = f.q?.trim().toLowerCase();
  return events.filter((e) => {
    const first = dayKey(e.start);
    const last = e.end ? dayKey(e.end) : first;
    if (last < today) return false;
    if (bounds && (last < bounds[0] || first > bounds[1])) return false;
    if (f.category && !e.categories.includes(f.category)) return false;
    if (f.venue && e.venue !== f.venue) return false;
    if (q && ![e.title, e.venue, e.description].some((s) => s?.toLowerCase().includes(q))) return false;
    return true;
  });
}
```

`src/web/logic/grouping.ts`:

```ts
import { dayKey } from '../../shared/time';
import type { Event } from '../../shared/types';
import { dayLabel } from './format';

export interface ListItem {
  event: Event;
  series: Event[];
}

export interface DayGroup {
  day: string;
  label: string;
  items: ListItem[];
}

const seriesKey = (e: Event) => `${e.title.trim().toLowerCase()}|${e.venue ?? ''}`;

export function buildDayGroups(events: Event[], today: string): DayGroup[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const seriesByKey = new Map<string, ListItem>();
  const byDay = new Map<string, ListItem[]>();

  for (const e of sorted) {
    const key = seriesKey(e);
    const existing = seriesByKey.get(key);
    if (existing) {
      existing.series.push(e);
      continue;
    }
    const item: ListItem = { event: e, series: [e] };
    seriesByKey.set(key, item);
    const start = dayKey(e.start);
    const day = start < today ? today : start;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, label: dayLabel(day, today), items }));
}

export function limitGroups(groups: DayGroup[], limit: number): { groups: DayGroup[]; hasMore: boolean } {
  const out: DayGroup[] = [];
  let left = limit;
  for (const g of groups) {
    if (left <= 0) return { groups: out, hasMore: true };
    out.push({ ...g, items: g.items.slice(0, left) });
    if (g.items.length > left) return { groups: out, hasMore: true };
    left -= g.items.length;
  }
  return { groups: out, hasMore: false };
}
```

`src/web/logic/prefs.ts`:

```ts
import type { Event } from '../../shared/types';
import { googleCalendarUrl } from '../calendar/google';
import { downloadIcs } from '../calendar/ics';
import { outlookCalendarUrl } from '../calendar/outlook';

export type CalendarKind = 'google' | 'outlook' | 'ics';

export const CALENDAR_LABELS: Record<CalendarKind, string> = {
  google: 'Google-kalenteri',
  outlook: 'Outlook',
  ics: 'Apple / muu (.ics)',
};

const KEY = 'tapahtumat.calendar';

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getCalendarPref(storage: Storage | null = defaultStorage()): CalendarKind | null {
  try {
    const v = storage?.getItem(KEY);
    return v && v in CALENDAR_LABELS ? (v as CalendarKind) : null;
  } catch {
    return null;
  }
}

export function setCalendarPref(kind: CalendarKind | null, storage: Storage | null = defaultStorage()): void {
  try {
    if (kind) storage?.setItem(KEY, kind);
    else storage?.removeItem(KEY);
  } catch {
    // Yksityinen selaustila tms. – valintaa ei muisteta, mutta mikään ei kaadu.
  }
}

export function addToCalendar(e: Event, kind: CalendarKind): void {
  if (kind === 'google') window.open(googleCalendarUrl(e), '_blank', 'noopener');
  else if (kind === 'outlook') window.open(outlookCalendarUrl(e), '_blank', 'noopener');
  else downloadIcs(e);
}
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run test/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/logic test/web
git commit -m "feat: suodattimet, päiväryhmittely, muotoilu ja kalenterivalinta"
```

---

### Task 12: Käyttöliittymä (Vite + Preact)

**Files:**
- Create: `vite.config.ts`, `src/web/index.html`, `src/web/main.tsx`, `src/web/App.tsx`, `src/web/styles.css`
- Create: `src/web/components/CalendarMenu.tsx`, `EventCard.tsx`, `EventDetail.tsx`, `FiltersBar.tsx`, `SourceStatusFooter.tsx`

**Interfaces:**
- Consumes: kaikki Task 11:n funktiot; `EventsFile`, `Event` (Task 1); `dayKey` (Task 1); `CATEGORY_ORDER` (Task 8, `src/dedupe/categories.ts` – puhdas moduuli ilman Node-riippuvuuksia); `public/events.json` (Task 9)
- Produces: julkaistava sivu hakemistoon `dist/`.

- [ ] **Step 1: Vite-asetukset ja sivupohja**

`vite.config.ts`:

```ts
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  base: './',
  publicDir: '../../public',
  plugins: [preact()],
  build: { outDir: '../../dist', emptyOutDir: true },
});
```

`src/web/index.html`:

```html
<!doctype html>
<html lang="fi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Tapahtumat Jyväskylä</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/web/main.tsx`:

```tsx
import { render } from 'preact';
import { App } from './App';
import './styles.css';

render(<App />, document.getElementById('app')!);
```

- [ ] **Step 2: Kalenterivalikko ja 📅-pikapainike**

`src/web/components/CalendarMenu.tsx`:

```tsx
import { useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import {
  addToCalendar, CALENDAR_LABELS, getCalendarPref, setCalendarPref, type CalendarKind,
} from '../logic/prefs';

const KINDS = Object.keys(CALENDAR_LABELS) as CalendarKind[];

export function CalendarChoices({ event, onDone }: { event: Event; onDone: () => void }) {
  const choose = (kind: CalendarKind) => {
    setCalendarPref(kind);
    addToCalendar(event, kind);
    onDone();
  };
  return (
    <div class="calendar-menu" role="menu">
      {KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" onClick={() => choose(kind)}>
          {CALENDAR_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}

/** Kortin pikapainike: muistetulla kalenterilla yksi napautus, muuten valikko. */
export function QuickAddButton({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const onClick = () => {
    const pref = getCalendarPref();
    if (!pref) {
      setOpen((o) => !o);
      return;
    }
    addToCalendar(event, pref);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <div class="quick-add" onClick={(e) => e.stopPropagation()}>
      <button type="button" class="icon-button" aria-label="Lisää kalenteriin" onClick={onClick}>
        {done ? '✓' : '📅'}
      </button>
      {open && <CalendarChoices event={event} onDone={() => setOpen(false)} />}
    </div>
  );
}

/** Tapahtuman tiedoissa näkyvä "Lisää kalenteriin ▾" ja muistetun kalenterin vaihto. */
export function AddToCalendar({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState(getCalendarPref());
  return (
    <div class="add-to-calendar">
      <button type="button" class="primary" onClick={() => setOpen((o) => !o)}>Lisää kalenteriin ▾</button>
      {open && <CalendarChoices event={event} onDone={() => { setOpen(false); setPref(getCalendarPref()); }} />}
      {pref && (
        <p class="pref-note">
          Pikapainike lisää: {CALENDAR_LABELS[pref]} ·{' '}
          <button type="button" class="link" onClick={() => { setCalendarPref(null); setPref(null); }}>Vaihda</button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Kortti, tiedot, suodattimet ja alalaita**

`src/web/components/EventCard.tsx`:

```tsx
import type { ListItem } from '../logic/grouping';
import { formatTime, seriesSummary } from '../logic/format';
import { QuickAddButton } from './CalendarMenu';

export function EventCard({ item, sourceName, onOpen }: {
  item: ListItem;
  sourceName: (id: string) => string;
  onOpen: () => void;
}) {
  const e = item.event;
  return (
    <article
      class="card"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(k) => k.key === 'Enter' && onOpen()}
    >
      {e.image ? <img class="card-image" src={e.image} alt="" loading="lazy" /> : <div class="card-image placeholder" />}
      <div class="card-body">
        <h3 class="card-title">{e.title}</h3>
        <p class="card-meta">
          {formatTime(e)}
          {e.venue ? ` · ${e.venue}` : ''}
          {e.city && e.city !== 'Jyväskylä' ? ` · ${e.city}` : ''}
        </p>
        {item.series.length > 1 && <p class="card-series">{seriesSummary(item.series)}</p>}
        <p class="card-tags">
          {e.categories.filter((c) => c !== 'Muut').map((c) => <span key={c} class="tag">{c}</span>)}
          {e.sources.map((s) => <span key={s.source} class="source">{sourceName(s.source)}</span>)}
        </p>
      </div>
      <QuickAddButton event={e} />
    </article>
  );
}
```

`src/web/components/EventDetail.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import { dayKey } from '../../shared/time';
import type { ListItem } from '../logic/grouping';
import { formatTime, shortDate } from '../logic/format';
import { AddToCalendar } from './CalendarMenu';

export function EventDetail({ item, sourceName, onClose }: {
  item: ListItem;
  sourceName: (id: string) => string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<Event>(item.event);

  useEffect(() => {
    const onKey = (k: KeyboardEvent) => k.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const e = current;
  return (
    <div class="overlay" onClick={onClose}>
      <div class="detail" role="dialog" aria-modal="true" aria-label={e.title} onClick={(ev) => ev.stopPropagation()}>
        <button type="button" class="close" aria-label="Sulje" onClick={onClose}>✕</button>
        {e.image && <img class="detail-image" src={e.image} alt="" />}
        <h2>{e.title}</h2>
        <p class="detail-when">{shortDate(dayKey(e.start))} · {formatTime(e)}</p>
        {(e.venue || e.address) && (
          <p class="detail-where">{[e.venue, e.address, e.city].filter(Boolean).join(', ')}</p>
        )}
        <AddToCalendar event={e} />
        {e.ticketUrl && <p><a href={e.ticketUrl} target="_blank" rel="noopener">Liput →</a></p>}
        {e.description && <p class="detail-description">{e.description}</p>}
        {item.series.length > 1 && (
          <div class="detail-series">
            <h3>Kaikki esitykset</h3>
            {item.series.map((s) => (
              <button
                key={s.id}
                type="button"
                class={s.id === e.id ? 'chip active' : 'chip'}
                onClick={() => setCurrent(s)}
              >
                {shortDate(dayKey(s.start))} {formatTime(s)}
              </button>
            ))}
          </div>
        )}
        <p class="detail-sources">
          Lähteet:{' '}
          {e.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ', '}
              <a href={s.url} target="_blank" rel="noopener">{sourceName(s.source)}</a>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
```

`src/web/components/FiltersBar.tsx`:

```tsx
import type { Filters, Range } from '../logic/filters';

const RANGES: [Range, string][] = [
  ['all', 'Kaikki'],
  ['today', 'Tänään'],
  ['weekend', 'Viikonloppu'],
  ['week', '7 päivää'],
  ['custom', 'Valitse päivät'],
];

export function FiltersBar({ filters, onChange, categories, venues }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  venues: string[];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div class="filters">
      <input
        type="search"
        placeholder="Hae tapahtumia…"
        value={filters.q ?? ''}
        onInput={(e) => set({ q: e.currentTarget.value || undefined })}
      />
      <div class="chips">
        {RANGES.map(([range, label]) => (
          <button
            key={range}
            type="button"
            class={filters.range === range ? 'chip active' : 'chip'}
            onClick={() => set({ range })}
          >
            {label}
          </button>
        ))}
      </div>
      {filters.range === 'custom' && (
        <div class="custom-range">
          <input type="date" value={filters.from ?? ''} onInput={(e) => set({ from: e.currentTarget.value || undefined })} />
          <span>–</span>
          <input type="date" value={filters.to ?? ''} onInput={(e) => set({ to: e.currentTarget.value || undefined })} />
        </div>
      )}
      <div class="selects">
        <select value={filters.category ?? ''} onChange={(e) => set({ category: e.currentTarget.value || undefined })}>
          <option value="">Kaikki kategoriat</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.venue ?? ''} onChange={(e) => set({ venue: e.currentTarget.value || undefined })}>
          <option value="">Kaikki paikat</option>
          {venues.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}
```

`src/web/components/SourceStatusFooter.tsx`:

```tsx
import type { SourceStatus } from '../../shared/types';
import { formatAge } from '../logic/format';

export function SourceStatusFooter({ sources, generatedAt }: {
  sources: Record<string, SourceStatus>;
  generatedAt: string;
}) {
  const now = new Date();
  return (
    <footer class="footer">
      <p>Päivitetty {formatAge(generatedAt, now)}.</p>
      <ul>
        {Object.entries(sources).map(([id, s]) => (
          <li key={id} class={s.lastError ? 'source-error' : ''}>
            {s.name}: {s.lastSuccess ? `päivitetty ${formatAge(s.lastSuccess, now)}` : 'ei vielä onnistunut'}
            {s.lastError ? ' ⚠︎' : ''}
          </li>
        ))}
      </ul>
    </footer>
  );
}
```

- [ ] **Step 4: App**

`src/web/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORY_ORDER } from '../dedupe/categories';
import { dayKey } from '../shared/time';
import type { EventsFile } from '../shared/types';
import { EventCard } from './components/EventCard';
import { EventDetail } from './components/EventDetail';
import { FiltersBar } from './components/FiltersBar';
import { SourceStatusFooter } from './components/SourceStatusFooter';
import { applyFilters, filtersFromSearch, filtersToSearch, type Filters } from './logic/filters';
import { buildDayGroups, limitGroups, type ListItem } from './logic/grouping';

const PAGE_SIZE = 60;

export function App() {
  const [data, setData] = useState<EventsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(location.search));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const today = dayKey(new Date().toISOString());

  useEffect(() => {
    fetch('./events.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventsFile>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const qs = filtersToSearch(filters);
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    setLimit(PAGE_SIZE);
  }, [filters]);

  const groups = useMemo(
    () => (data ? buildDayGroups(applyFilters(data.events, filters, today), today) : []),
    [data, filters, today],
  );
  const visible = useMemo(() => limitGroups(groups, limit), [groups, limit]);
  const categories = useMemo(() => {
    const present = new Set(data?.events.flatMap((e) => e.categories) ?? []);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [data]);
  const venues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.events ?? []) if (e.venue) counts.set(e.venue, (counts.get(e.venue) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= 3).map(([v]) => v).sort((a, b) => a.localeCompare(b, 'fi'));
  }, [data]);
  const sourceName = (id: string) => data?.sources[id]?.name ?? id;

  if (error) return <main class="app"><p class="message">Tapahtumien lataus epäonnistui ({error}).</p></main>;
  if (!data) return <main class="app"><p class="message">Ladataan tapahtumia…</p></main>;

  return (
    <main class="app">
      <header class="app-header">
        <h1>Tapahtumat</h1>
        <p class="subtitle">Jyväskylän seudun tapahtumat yhdessä paikassa</p>
      </header>
      <FiltersBar filters={filters} onChange={setFilters} categories={categories} venues={venues} />
      {groups.length === 0 && <p class="message">Ei tapahtumia valituilla suodattimilla.</p>}
      {visible.groups.map((g) => (
        <section key={g.day} class="day">
          <h2 class="day-label">{g.label}</h2>
          {g.items.map((item) => (
            <EventCard key={item.event.id} item={item} sourceName={sourceName} onOpen={() => setSelected(item)} />
          ))}
        </section>
      ))}
      {visible.hasMore && (
        <button type="button" class="more" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Näytä lisää</button>
      )}
      <SourceStatusFooter sources={data.sources} generatedAt={data.generatedAt} />
      {selected && <EventDetail item={selected} sourceName={sourceName} onClose={() => setSelected(null)} />}
    </main>
  );
}
```

- [ ] **Step 5: Tyylit**

`src/web/styles.css`:

```css
:root {
  --bg: #f6f5f2;
  --surface: #ffffff;
  --text: #1d1d1f;
  --muted: #6b6b70;
  --accent: #d2452f;
  --border: #e3e1dc;
  --radius: 14px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  background: var(--bg);
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #141416; --surface: #1f1f23; --text: #f2f2f4; --muted: #a0a0a8; --border: #2e2e34; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); }
button { font: inherit; cursor: pointer; }
a { color: var(--accent); }

.app { max-width: 760px; margin: 0 auto; padding: 16px 16px 48px; }
.app-header h1 { margin: 8px 0 0; font-size: 1.8rem; }
.subtitle { margin: 4px 0 16px; color: var(--muted); }
.message { color: var(--muted); padding: 24px 0; }

.filters { position: sticky; top: 0; z-index: 5; background: var(--bg); padding: 8px 0 12px; display: grid; gap: 8px; }
.filters input[type='search'], .filters select, .custom-range input {
  width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit;
}
.chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.chip { flex: none; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.selects, .custom-range { display: flex; gap: 8px; align-items: center; }

.day-label { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 24px 0 8px; }
.card {
  position: relative; display: grid; grid-template-columns: 72px 1fr auto; gap: 12px; align-items: start;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; margin-bottom: 8px; cursor: pointer;
}
.card:focus-visible { outline: 2px solid var(--accent); }
.card-image { width: 72px; height: 72px; border-radius: 10px; object-fit: cover; background: var(--border); }
.card-title { margin: 0 0 4px; font-size: 1rem; line-height: 1.3; }
.card-meta, .card-series { margin: 0 0 4px; font-size: 0.9rem; color: var(--muted); }
.card-series { color: var(--accent); }
.card-tags { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.tag, .source { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: var(--bg); color: var(--muted); }
.source { border: 1px solid var(--border); background: transparent; }

.quick-add { position: relative; }
.icon-button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); font-size: 1.2rem; }
.calendar-menu {
  position: absolute; right: 0; top: 48px; z-index: 10; display: grid; min-width: 200px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.15); overflow: hidden;
}
.calendar-menu button { text-align: left; padding: 12px 14px; border: 0; background: none; color: var(--text); }
.calendar-menu button + button { border-top: 1px solid var(--border); }
.add-to-calendar { position: relative; margin: 12px 0; }
.add-to-calendar .calendar-menu { left: 0; right: auto; }
.primary { padding: 10px 16px; border-radius: 10px; border: 0; background: var(--accent); color: #fff; }
.pref-note { font-size: 0.85rem; color: var(--muted); }
.link { border: 0; background: none; color: var(--accent); padding: 0; text-decoration: underline; }

.overlay { position: fixed; inset: 0; z-index: 20; background: rgb(0 0 0 / 0.45); display: flex; align-items: flex-end; justify-content: center; }
.detail {
  position: relative; width: 100%; max-width: 760px; max-height: 90vh; overflow-y: auto;
  background: var(--surface); border-radius: 18px 18px 0 0; padding: 20px 16px 32px;
}
@media (min-width: 700px) { .overlay { align-items: center; } .detail { border-radius: 18px; } }
.close { position: absolute; right: 12px; top: 12px; border: 0; background: var(--bg); width: 36px; height: 36px; border-radius: 50%; color: var(--text); }
.detail-image { width: 100%; max-height: 280px; object-fit: cover; border-radius: 12px; }
.detail h2 { margin: 12px 40px 4px 0; }
.detail-when, .detail-where, .detail-sources { color: var(--muted); margin: 4px 0; }
.detail-description { white-space: pre-line; line-height: 1.5; }
.detail-series { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.detail-series h3 { width: 100%; margin: 0; font-size: 0.95rem; }

.more { display: block; margin: 16px auto; padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.footer { margin-top: 40px; font-size: 0.85rem; color: var(--muted); }
.footer ul { padding-left: 18px; }
.source-error { color: var(--accent); }
```

- [ ] **Step 6: Build ja tyyppitarkistus**

Run: `npm run build`
Expected: `tsc` ilman virheitä ja `dist/index.html`, `dist/events.json` sekä JS/CSS-tiedostot syntyvät.

- [ ] **Step 7: Kokeile selaimessa**

Run: `npm run dev` (taustalla) ja avaa ilmoitettu osoite (oletuksena `http://localhost:5173/`).

Tarkista käsin, mieluiten puhelimen levyisellä ikkunalla (noin 390 px):
1. Lista näkyy päivittäin ryhmiteltynä, ja ensimmäinen ryhmä on "Tänään".
2. Suodatin "Viikonloppu", kategoria ja haku rajaavat listaa, ja osoiterivi päivittyy (esim. `?range=weekend`). Sivun uudelleenlataus säilyttää suodattimet.
3. 📅 kortissa avaa valikon. Valitse "Google-kalenteri": avautuu uusi välilehti, jossa on valmiiksi täytetty tapahtuma oikealla ajalla. Seuraava 📅-napautus avaa Googlen suoraan ilman valikkoa.
4. Kortin napautus avaa tiedot. "Lisää kalenteriin ▾" → "Apple / muu (.ics)" lataa tiedoston, joka aukeaa macOS:n Kalenterissa oikealla ajalla. "Vaihda" unohtaa muistetun kalenterin.
5. Monen esityksen tapahtumassa näkyy "N esitystä …", ja tiedoissa voi valita esityksen.
6. Alalaidassa näkyy lähteiden tila.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts src/web
git commit -m "feat: tapahtumalista, suodattimet, tiedot ja kalenteripainikkeet"
```

---

### Task 13: GitHub Actions ja julkaisu GitHub Pagesiin

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/update.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `npm run scrape` (Task 9), joka kirjoittaa `failing=<id> <id>` muuttujaan `GITHUB_OUTPUT`; `npm test`, `npm run build` (Task 12).

- [ ] **Step 1: CI-workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches-ignore: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Keruu- ja julkaisuworkflow**

`.github/workflows/update.yml`:

```yaml
name: Päivitä ja julkaise
on:
  schedule:
    - cron: '0 3,9,15 * * *' # UTC; Suomessa noin klo 6, 12 ja 18 (talvella tuntia aiemmin)
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pages: write
  id-token: write

concurrency:
  group: update
  cancel-in-progress: false

jobs:
  scrape:
    if: github.event_name != 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - id: run
        run: npm run scrape
      - name: Tallenna data repoon
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/events.json data/raw
          git diff --cached --quiet || git commit -m "data: päivitä tapahtumat"
          git push
      - name: Ilmoita toistuvasti epäonnistuvista lähteistä
        if: steps.run.outputs.failing != ''
        env:
          GH_TOKEN: ${{ github.token }}
          FAILING: ${{ steps.run.outputs.failing }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          for id in $FAILING; do
            title="Lähde epäonnistuu: $id"
            existing=$(gh issue list --state open --search "\"$title\" in:title" --json number --jq 'length')
            if [ "$existing" = "0" ]; then
              gh issue create --title "$title" --body "Lähde **$id** on epäonnistunut vähintään 3 kertaa peräkkäin. Sivustolla näytetään sen viimeisimmät onnistuneet tiedot. Ajo: $RUN_URL"
            fi
          done

  deploy:
    needs: scrape
    if: always() && (needs.scrape.result == 'success' || needs.scrape.result == 'skipped')
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with: { ref: main }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

Huom: `GITHUB_TOKEN`-tunnuksella tehty data-commit ei käynnistä workflowta uudelleen, joten silmukkaa ei synny. Julkaisu tehdään samassa ajossa `deploy`-jobissa.

- [ ] **Step 3: README**

`README.md`:

````markdown
# Tapahtumat

Jyväskylän seudun tapahtumat yhdessä listassa ilman tuplia. Tapahtuman voi lisätä Google-, Outlook- tai Apple-kalenteriin.

## Lähteet

keskisuomievents.fi (sisältää kalenteri.jyvaskyla.fi:n ja visitjyvaskyla.fi:n tapahtumat), paviljonki.fi, peurunka.fi, keikkalista.fi.

## Kehitys

```bash
npm install
npm run scrape   # hakee tapahtumat -> public/events.json
npm run dev      # käyttöliittymä osoitteessa http://localhost:5173
npm test
```

## Uuden lähteen lisääminen

1. Luo `src/sources/<id>.ts`, joka toteuttaa `Source`-rajapinnan ja palauttaa `RawEvent[]`.
2. Tallenna oikea vastaus hakemistoon `test/fixtures/<id>/` ja kirjoita testit.
3. Lisää lähde `SOURCES`-listaan (`src/sources/index.ts`) ja tarvittaessa `SOURCE_PRIORITY`-listaan (`src/dedupe/merge.ts`).

Suunnitelma: `docs/superpowers/specs/2026-10-11-tapahtumat-design.md`
````

- [ ] **Step 4: Tarkista paikallisesti ja commit**

Run: `npm test && npm run build`
Expected: PASS.

```bash
git add .github README.md
git commit -m "ci: ajastettu keruu, julkaisu GitHub Pagesiin ja ilmoitukset rikkinäisistä lähteistä"
```

- [ ] **Step 5: GitHub-repo ja Pages (vaatii käyttäjän hyväksynnän)**

Kysy käyttäjältä ennen tätä vaihetta: repon nimi ja näkyvyys (julkinen vai yksityinen; ilmaisen tilin GitHub Pages vaatii julkisen repon). Hyväksynnän jälkeen:

```bash
gh repo create <nimi> --<public|private> --source . --push
gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
gh workflow run update.yml
gh run watch
```

Expected: ajo menee läpi, ja `gh api repos/{owner}/{repo}/pages --jq .html_url` kertoo sivun osoitteen. Avaa osoite puhelimella ja käy läpi Task 12:n Step 7:n tarkistukset julkaistulla sivulla.
