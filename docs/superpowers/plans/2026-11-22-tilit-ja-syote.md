# Tilit, henkilökohtainen etusivu ja kalenterisyöte – toteutussuunnitelma

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tähdet, seuratut paikat, kotipaikkakunta ja suosikkikategoriat Apple/Google-kirjautumisen taakse, "Sinulle"-näkymä sekä VPS:llä ajettava henkilökohtainen .ics-syöte – pysyvien tapahtumatunnisteiden varassa.

**Architecture:** Keruu (GitHub Actions) ylläpitää pysyviä tunnisteita tiedostossa `data/ids.json` ja kirjoittaa `events.json`:n lisäksi `recent-past.json`:n. Käyttöliittymä (GitHub Pages) käyttää Supabasea (Auth + Postgres + RLS) dynaamisesti ladattavan moduulin kautta. Syötepalvelu (Node, Docker, Caddy, VPS) kutsuu Supabasesta vain `feed_for_token`-funktiota anon-avaimella ja koostaa .ics:n sivuston JSON-tiedostoista.

**Tech Stack:** TypeScript, Preact + Vite, Vitest, `@supabase/supabase-js` (v2), Supabase CLI + pgTAP, Node 22 (`node:http`), tsx, Docker Compose, Caddy.

**Spec:** `docs/superpowers/specs/2026-11-21-tilit-ja-syote-design.md`

## Global Constraints

- Selaaminen ei koskaan vaadi kirjautumista. Kun Supabase-ympäristömuuttujat puuttuvat, sovellus toimii täsmälleen kuten nyt (tili-UI piilossa).
- Syötteeseen tulevat aina tähdet; seuratun paikan tapahtumat vain, jos `in_calendar = true` (oletus `false`). Kategoriat eivät koskaan tule syötteeseen.
- Menneet tapahtumat pysyvät syötteessä 30 päivää (`PAST_DAYS = 30`). Ennen alkuaan lähteestä kadonnut tapahtuma ei päädy menneisiin.
- Syötteen osoite on muotoa `https://syote.<nimi>.fi/<token>.ics`; token on 48 heksamerkkiä (24 satunnaista tavua). Osoite ei saa riippua Supabasen verkkotunnuksesta.
- VPS:llä on vain Supabasen URL ja anon-avain. Ei service role -avainta eikä henkilötietoja.
- Supabase-kutsut vain hakemistossa `src/web/account/` (käyttöliittymä) ja `src/feed/supabase.ts` (syöte).
- Paikka tunnistetaan nimellä: `mainVenue(venue)` = osa ennen " – "-erotinta.
- Supabase-projekti EU-alueella. Kirjautuminen: Apple ja Google, molemmat.
- Käyttöliittymän tekstit suomeksi; koodin kommentit suomeksi kuten nyt.

## Review Focus

1. **Supabase ei vastaa tai on tauolla** → syöte palauttaa 503 + `Retry-After`, ei koskaan tyhjää kalenteria (muuten kalenteri poistaa käyttäjän tapahtumat). Testi: Task 7.
2. **Tähdellä merkityn tapahtuman tunniste muuttuu aliakseksi** (kaksi tapahtumaa yhdistyy) → tähti näkyy edelleen käyttöliittymässä ja tapahtuma syötteessä. Testit: Task 3 ja Task 5.
3. **Väärän muotoinen tai tuntematon token** → 404, eikä väärän muotoisella tokenilla kutsuta Supabasea. Testi: Task 7.
4. **localStorage ei käytettävissä** (yksityinen selaus) → tähden painaminen ei kaada sovellusta. Testi: Task 3.
5. **Sama tapahtuma sekä tähdellä että seuratussa paikassa** → syötteessä kerran. Testi: Task 5.

---

### Task 1: Pysyvät tapahtumatunnisteet

**Files:**
- Create: `src/dedupe/ids.ts`, `src/shared/retention.ts`
- Modify: `src/dedupe/merge.ts` (lisää `dedupeWithIds`), `src/sources/jklteatteri.ts:68` (sourceId)
- Test: `test/dedupe/ids.test.ts`, päivitä `test/sources/jklteatteri*.test.ts`

**Interfaces:**
- Produces:
  - `src/shared/retention.ts`: `export const PAST_DAYS = 30;`
  - `src/dedupe/ids.ts`:
    - `export interface IdRegistry { keys: Record<string, { id: string; lastDay: string }>; aliases: Record<string, string> }`
    - `export function emptyRegistry(): IdRegistry`
    - `export function assignIds(opts: { groups: Normalized[][]; fallbackIds: string[]; registry: IdRegistry; today: string; rank: (source: string) => number }): { ids: string[]; registry: IdRegistry }`
  - `src/dedupe/merge.ts`: `export function dedupeWithIds(events: RawEvent[], registry: IdRegistry, today: string): { events: Event[]; registry: IdRegistry }`. Nykyinen `dedupe(events)` säilyy ennallaan.

**Säännöt (`assignIds`):**
- Lähdeavain = `${source}:${sourceId}`. Jos sama avain esiintyy tällä ajolla usealla eri päivällä (`dayKey(start)`), avain on `${source}:${sourceId}@${day}`.
- Ryhmät käsitellään järjestyksessä parhaan lähteen `rank`-arvon mukaan (pienin ensin), tasatilanteessa alkuperäisessä järjestyksessä. Ryhmän sisällä avaimet käydään `rank`-järjestyksessä.
- Ryhmä saa ensimmäisen rekisteristä löytyvän tunnisteen, jota mikään aiemmin käsitelty ryhmä ei ole tällä ajolla ottanut. Näin jakautumisessa vanha tunniste jää ensisijaisimmalle lähteelle.
- Ryhmän muut rekisteristä löytyvät, eri tunnisteet (joita kukaan ei ottanut) kirjataan aliakseksi: `aliases[vanha] = valittu`.
- Jos tunnistetta ei löydy, käytetään `fallbackIds[i]` (nykyinen `stableId`). Jos se on jo käytössä, lisätään `-2`, `-3`, … kunnes uniikki.
- Kaikki ryhmän avaimet kirjataan valittuun tunnisteeseen, `lastDay` = `lastDayKey` kyseisestä tapahtumasta.
- Karsinta: avaimet, joiden `lastDay < addDays(today, -PAST_DAYS)`, poistetaan. Aliakset poistetaan, jos niiden kohde ei enää ole minkään avaimen tunniste. Aliasketjut litistetään (alias osoittaa aina lopulliseen tunnisteeseen).

- [ ] **Step 1: Kirjoita epäonnistuvat testit** `test/dedupe/ids.test.ts` (ryhmät rakennetaan käsin `normalizeEvent(raw({...}))`-kutsuilla, ei matcheria):
  - `tyhjä rekisteri tuottaa samat tunnisteet kuin dedupe` – `dedupeWithIds(evs, emptyRegistry(), today).events.map(e => e.id)` on sama kuin `dedupe(evs).map(e => e.id)` (testidata ilman tuplatunnisteita).
  - `säilyttää tunnisteen kun kellonaika muuttuu` – ajo 1: `{source:'paviljonki', sourceId:'p1', start:'2026-12-05T19:00:00+02:00'}` → id X; ajo 2 samalla rekisterillä ja `start:'2026-12-05T20:00:00+02:00'` → id X.
  - `säilyttää tunnisteen kun nimi ja paikka muuttuvat`.
  - `toistuva tapahtuma saa eri tunnisteen joka päivälle` – sama `sourceId` päivinä 5.12. ja 6.12. → kaksi eri tunnistetta, ja ajo 2 antaa samat.
  - `yhdistyminen jättää aliaksen` – ajo 1: ryhmät `[kse:k1]` → X ja `[paviljonki:p1]` → Y; ajo 2: ryhmä `[kse:k1, paviljonki:p1]` → id Y ja `registry.aliases[X] === Y`.
  - `jakautuminen: vanha tunniste jää ensisijaisimmalle lähteelle` – ajo 1: `[kse:k1, paviljonki:p1]` → Y; ajo 2: `[kse:k1]`, `[paviljonki:p1]` → paviljonki saa Y, kse uuden ≠ Y.
  - `karsii yli 30 päivää sitten päättyneet avaimet ja niiden aliakset` – today `2026-12-31`, avain jonka `lastDay` `2026-11-30` poistuu, `2026-12-01` säilyy.
  - `tunnisteet ovat uniikkeja vaikka fallback törmää`.
- [ ] **Step 2: Aja** `npx vitest run test/dedupe/ids.test.ts` → FAIL (moduulia ei ole).
- [ ] **Step 3: Toteuta** `src/shared/retention.ts`, `src/dedupe/ids.ts` yllä olevien sääntöjen mukaan ja `dedupeWithIds` tiedostoon `merge.ts`: ryhmittele kuten `dedupe`, `mergeGroup` jokaiselle (fallback-tunniste), `assignIds({ rank, … })`, korvaa tunnisteet ja lajittele kuten `dedupe`.
- [ ] **Step 4: Muuta teatterin `sourceId`** muotoon `${slug}-${isoDate(y,m,d)}`; saman päivän toinen esitys (aikajärjestyksessä) `${slug}-${isoDate}-2`, kolmas `-3`. Nykyinen `seen`-tarkistus tuplarivien poistoon säilyy, mutta avaimena on täysi aika. Päivitä teatterin fixture-testien odotetut `sourceId`:t ja lisää testi `saman päivän kaksi esitystä saavat eri sourceId:n`.
- [ ] **Step 5: Aja** `npm test` → kaikki PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: pysyvät tapahtumatunnisteet lähdeavainten rekisterillä"`

---

### Task 2: Keruu tallentaa rekisterin, aliakset ja menneet tapahtumat

**Files:**
- Modify: `src/shared/types.ts`, `src/scrape/run.ts`, `src/scrape/cli.ts`, `.github/workflows/update.yml` (rivi `git add`)
- Test: `test/scrape/run.test.ts`

**Interfaces:**
- Consumes: `dedupeWithIds`, `IdRegistry`, `emptyRegistry` (Task 1), `PAST_DAYS`.
- Produces:
  - `EventsFile` saa kentän `aliases: Record<string, string>`.
  - `export interface RecentPastFile { generatedAt: string; events: Event[] }` (`src/shared/types.ts`)
  - `RunDeps` saa kentät `previousIds: IdRegistry | null` ja `previousPast: RecentPastFile | null`.
  - `runScrape(d): Promise<{ file: EventsFile; ids: IdRegistry; recentPast: RecentPastFile }>`
  - Tiedostot: `data/ids.json` (IdRegistry), `public/recent-past.json` (RecentPastFile).

**Menneiden sääntö:** `recentPast.events` = edellisen `events.json`:n (`d.previous`) tapahtumat, joiden `lastDayKey < today`, yhdistettynä `previousPast.events`:iin; tunniste ratkaistaan aliasten kautta, tuplat (sama id) poistetaan uusinta suosien, karsitaan `lastDayKey < addDays(today, -PAST_DAYS)`, lajitellaan alkuajan mukaan. Tapahtuma, joka puuttuu uudesta datasta mutta ei ole päättynyt, ei päädy menneisiin.

- [ ] **Step 1: Kirjoita epäonnistuvat testit** `test/scrape/run.test.ts`:
  - `siirtää eilen päättyneen tapahtuman menneisiin` – `previous.events` sisältää eilisen tapahtuman → `recentPast.events` sisältää sen, `file.events` ei.
  - `pudottaa yli 30 päivää sitten päättyneet menneet`.
  - `ei siirrä ennen alkuaan kadonnutta tapahtumaa menneisiin` – huomisen tapahtuma puuttuu uudesta lähdedatasta → ei kummassakaan.
  - `events.json sisältää aliakset ja rekisteri palautetaan` – kaksi ajoa, joissa ryhmät yhdistyvät → `file.aliases` ei tyhjä, `ids.aliases` sama.
  - Päivitä olemassa olevat testit käyttämään `(await runScrape(d)).file`.
- [ ] **Step 2: Aja** `npx vitest run test/scrape/run.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** `runScrape` (`dedupeWithIds(filterWindow(all, now), d.previousIds ?? emptyRegistry(), today)`, menneiden sääntö) ja `cli.ts`: lue `data/ids.json` ja `public/recent-past.json`, kirjoita molemmat (`ids.json` muotoiltuna `JSON.stringify(x, null, 1)`, muut kuten nyt).
- [ ] **Step 4: Päivitä workflow:** `git add public/events.json public/recent-past.json data/raw data/ids.json`.
- [ ] **Step 5: Aja** `npm test && npm run scrape` → testit PASS, ja `data/ids.json` sekä `public/recent-past.json` syntyvät. Tarkista, että `public/events.json`:n tunnisteet ovat samat kuin ennen ajoa (`git diff --stat public/events.json` näyttää vain datamuutokset, ei kaikkien tunnisteiden vaihtoa).
- [ ] **Step 6: Commit** (mukaan `data/ids.json` ja `public/recent-past.json`) `git commit -m "feat: keruu tallentaa tunnisterekisterin ja menneet tapahtumat"`

---

### Task 3: Tähdet laitteelle ja tähtipainike

**Files:**
- Create: `src/shared/aliases.ts`, `src/web/account/stars.ts`, `src/web/components/StarButton.tsx`
- Modify: `src/web/logic/filters.ts` (`starred`-suodatin), `src/web/components/EventCard.tsx`, `src/web/components/EventDetail.tsx`, `src/web/components/FiltersBar.tsx`, `src/web/App.tsx`, `src/web/styles.css`
- Test: `test/shared/aliases.test.ts`, `test/web/stars.test.ts`, `test/web/filters.test.ts`

**Interfaces:**
- Consumes: `EventsFile.aliases` (Task 2).
- Produces:
  - `src/shared/aliases.ts`: `export function resolveId(id: string, aliases: Record<string, string>): string` (seuraa ketjua, enintään 10 askelta) ja `export function resolveIds(ids: string[], aliases: Record<string, string>): string[]` (ratkaistu, uniikki, järjestys säilyy).
  - `src/web/account/stars.ts`: `getLocalStars(storage?: Storage | null): string[]`, `setLocalStars(ids: string[], storage?: Storage | null): void`. Avain `tapahtumat.stars`. Sama virheensieto kuin `prefs.ts`:ssä.
  - `StarButton({ starred, title, onToggle }: { starred: boolean; title: string; onToggle: () => void })` – `aria-pressed={starred}`, `aria-label` = `Merkitse tähdellä: ${title}` / `Poista tähti: ${title}`, merkki ★/☆.
  - `Filters.starred?: '1'`; `applyFilters(events, f, today, stars?: Set<string>)` – kun `f.starred`, vain tähdellä merkityt.
  - App: tila `stars: Set<string>` ja `toggleStar(id: string)`. Task 8 vaihtaa tallennuksen tiliin.

- [ ] **Step 1: Kirjoita epäonnistuvat testit:**
  - `resolveId seuraa aliasketjun loppuun` (`{a:'b', b:'c'}` → `'c'`), `resolveId pysähtyy kehään` (`{a:'b', b:'a'}` ei jää jumiin), `resolveIds poistaa tuplat`.
  - `tallentaa ja lukee tähdet` ja `ei kaadu kun localStorage heittää` (`throwing`-storage kuten `prefs.test.ts`:ssä: `setLocalStars` ei heitä, `getLocalStars` palauttaa `[]`).
  - `starred-suodatin näyttää vain tähdellä merkityt` ja `starred säilyy osoiterivillä` (`filtersToSearch`/`filtersFromSearch`).
- [ ] **Step 2: Aja** `npx vitest run test/shared/aliases.test.ts test/web/stars.test.ts test/web/filters.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** moduulit ja UI: tähtipainike kortissa 📅-painikkeen viereen (korttigridiin uusi sarake) ja tiedoissa "Lisää kalenteriin" -painikkeen viereen; FiltersBarin aikavälisirujen perään siru "★ Tähdet". App lukee tähdet `resolveIds(getLocalStars(), data.aliases)` datan latauduttua ja kirjoittaa ratkaistun listan takaisin.
- [ ] **Step 4: Aja** `npm test && npm run build` → PASS.
- [ ] **Step 5: Tarkista selaimessa** (`npm run dev`): tähti pysyy uudelleenlatauksen jälkeen, "★ Tähdet" suodattaa, ja tähti toimii näppäimistöllä.
- [ ] **Step 6: Commit** `git commit -m "feat: tähdet laitteelle ja tähtisuodatin"`

---

### Task 4: Usean tapahtuman .ics

**Files:**
- Modify: `src/web/calendar/ics.ts`
- Test: `test/web/calendar.test.ts`

**Interfaces:**
- Produces: `export function veventLines(e: Event, now: Date): string[]` ja `export function buildCalendar(events: Event[], opts?: { now?: Date; name?: string }): string`. `buildIcs(e, now)` = `buildCalendar([e], { now })`. Kun `name` annetaan, mukaan rivit `X-WR-CALNAME:<name>`, `REFRESH-INTERVAL;VALUE=DURATION:PT6H` ja `X-PUBLISHED-TTL:PT6H`. Rivit taitetaan `foldLine`:lla ja erotetaan `\r\n`:llä kuten nyt.

- [ ] **Step 1: Kirjoita epäonnistuvat testit:** `buildCalendar kokoaa tapahtumat yhteen kalenteriin` (kaksi tapahtumaa → täsmälleen yksi `BEGIN:VCALENDAR` ja kaksi `BEGIN:VEVENT`, UID:t `${id}@tapahtumat`), `buildCalendar lisää nimen ja päivitysvälin`, `tyhjä lista tuottaa kelvollisen tyhjän kalenterin`. Olemassa olevat `buildIcs`-testit eivät muutu.
- [ ] **Step 2: Aja** `npx vitest run test/web/calendar.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** jakamalla nykyinen `buildIcs` kahteen funktioon.
- [ ] **Step 4: Aja** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "refactor: usean tapahtuman .ics-kalenteri"`

---

### Task 5: Syötteen tapahtumavalinta

**Files:**
- Create: `src/shared/venue.ts`, `src/feed/select.ts`
- Modify: `src/web/logic/filters.ts` (`mainVenue` siirtyy tiedostoon `src/shared/venue.ts` ja viedään edelleen `filters.ts`:stä)
- Test: `test/feed/select.test.ts`

**Interfaces:**
- Consumes: `resolveId`/`resolveIds` (Task 3), `mainVenue`.
- Produces:
  - `export interface FeedPrefs { starred: string[]; venues: string[] }` (`src/feed/select.ts`)
  - `export interface EventsBundle { upcoming: Event[]; past: Event[]; aliases: Record<string, string> }`
  - `export function selectFeedEvents(bundle: EventsBundle, prefs: FeedPrefs): Event[]` – tapahtumat (tulevat + menneet), joiden id on ratkaistuissa tähdissä TAI joiden `mainVenue(e.venue)` on `prefs.venues`-listassa; uniikki id:n mukaan, lajiteltu alkuajan mukaan.

- [ ] **Step 1: Kirjoita epäonnistuvat testit:** `ottaa tähdellä merkityt`, `ratkaisee vanhan tunnisteen aliaksen kautta`, `ottaa kalenteriin valitun paikan kaikki tapahtumat` (`venue: 'Lutakko – Iso sali'` vastaa `'Lutakko'`), `tähti ja seurattu paikka samassa tapahtumassa → kerran`, `ottaa menneet tapahtumat mukaan`, `ei ota muita tapahtumia`.
- [ ] **Step 2: Aja** `npx vitest run test/feed/select.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** `src/shared/venue.ts` ja `selectFeedEvents`.
- [ ] **Step 4: Aja** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: syötteen tapahtumavalinta"`

---

### Task 6: Supabase-tietokanta, RLS ja funktiot

**Files:**
- Create: `supabase/config.toml` (`npx supabase init`), `supabase/migrations/20261122000000_tilit.sql`, `supabase/tests/tilit.test.sql`
- Modify: `package.json` (devDependency `supabase`, skripti `"db:test": "supabase test db"`)

**Interfaces:**
- Produces (SQL, schema `public`):
  - `profiles(user_id uuid primary key references auth.users on delete cascade, home_city text, feed_token text unique not null, created_at timestamptz default now())`
  - `favorite_categories(user_id uuid references auth.users on delete cascade, category text, primary key (user_id, category))`
  - `followed_venues(user_id uuid references auth.users on delete cascade, venue text, in_calendar boolean not null default false, primary key (user_id, venue))`
  - `starred_events(user_id uuid references auth.users on delete cascade, event_id text, starred_at timestamptz default now(), primary key (user_id, event_id))`
  - Laukaisin `auth.users`-lisäykselle: luo `profiles`-rivin, `feed_token = encode(gen_random_bytes(24), 'hex')`.
  - `feed_for_token(token text) returns json` – `security definer`, `set search_path = public`: `{"starred": [...], "venues": [...]}` (venues vain `in_calendar`), tai `null` tuntemattomalle tokenille.
  - `regenerate_feed_token() returns text` – vaihtaa kutsujan (`auth.uid()`) tokenin ja palauttaa uuden.
  - `delete_account() returns void` – `security definer`, poistaa `auth.users`-rivin, jonka `id = auth.uid()`.
  - RLS kaikissa tauluissa: `auth.uid() = user_id` (select/insert/update/delete); `profiles`-tauluun ei insert/delete-oikeutta käyttäjälle eikä `feed_token`-sarakkeen päivitystä (vain `regenerate_feed_token`).
  - Oikeudet: `revoke execute ... from public`; `feed_for_token` → `anon, authenticated`; `regenerate_feed_token`, `delete_account` → `authenticated`.

- [ ] **Step 1: Kirjoita pgTAP-testit** `supabase/tests/tilit.test.sql` (luo kaksi testikäyttäjää `auth.users`-tauluun ja vaihda roolia `set local role authenticated; set local request.jwt.claims = ...`):
  - `kirjautuminen luo profiilin ja 48-merkkisen tokenin`
  - `käyttäjä A ei näe käyttäjän B tähtiä, paikkoja eikä profiilia`
  - `anon ei näe mitään taulua`
  - `feed_for_token palauttaa tähdet ja vain kalenteriin valitut paikat`
  - `feed_for_token palauttaa null tuntemattomalle tokenille`
  - `regenerate_feed_token mitätöi vanhan tokenin`
  - `käyttäjä ei voi päivittää feed_tokenia suoraan`
  - `delete_account poistaa käyttäjän kaikki rivit`
- [ ] **Step 2: Aja** `npx supabase start && npm run db:test` → FAIL (taulut puuttuvat). Vaatii Dockerin.
- [ ] **Step 3: Kirjoita migraatio.**
- [ ] **Step 4: Aja** `npx supabase db reset && npm run db:test` → kaikki PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: Supabase-tietokanta, RLS ja syötefunktiot"`

---

### Task 7: Syötepalvelu

**Files:**
- Create: `src/feed/supabase.ts`, `src/feed/events.ts`, `src/feed/server.ts`
- Modify: `package.json` (skripti `"feed": "tsx src/feed/server.ts"`)
- Test: `test/feed/server.test.ts`, `test/feed/events.test.ts`

**Interfaces:**
- Consumes: `FeedPrefs`, `EventsBundle`, `selectFeedEvents` (Task 5), `buildCalendar` (Task 4), `feed_for_token` (Task 6).
- Produces:
  - `src/feed/supabase.ts`: `fetchFeedPrefs(token: string, cfg: { url: string; anonKey: string }, fetchFn = fetch): Promise<FeedPrefs | null>` – `POST ${url}/rest/v1/rpc/feed_for_token` body `{"token": token}`, otsakkeet `apikey` ja `Authorization: Bearer <anonKey>`; muu kuin 2xx → heittää.
  - `src/feed/events.ts`: `createEventsCache(opts: { baseUrl: string; ttlMs: number; fetchFn?: typeof fetch; now?: () => number }): () => Promise<EventsBundle>` – hakee `${baseUrl}/events.json` ja `${baseUrl}/recent-past.json`; TTL:n sisällä ei hae uudelleen; jos haku epäonnistuu ja vanha data on olemassa, palauttaa vanhan, muuten heittää.
  - `src/feed/server.ts`: `createFeedHandler(deps: { getPrefs: (token: string) => Promise<FeedPrefs | null>; getEvents: () => Promise<EventsBundle>; now?: () => Date }): (req: IncomingMessage, res: ServerResponse) => Promise<void>`. Kun tiedosto ajetaan suoraan, käynnistää palvelimen ympäristömuuttujilla `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EVENTS_BASE_URL`, `PORT` (oletus 8787), `ttlMs` 5 minuuttia.
  - Reitit: `GET /health` → 200 `ok`; `GET /<token>.ics`, token `/^[0-9a-f]{48}$/` → 200 `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: public, max-age=900`, kalenterin nimi `Tapahtumat – omat`. Muu polku tai väärän muotoinen token → 404; muu metodi kuin GET/HEAD → 405; `getPrefs` tai `getEvents` heittää → 503 + `Retry-After: 300`.

- [ ] **Step 1: Kirjoita epäonnistuvat testit** (palvelin porttiin 0 `http.createServer(createFeedHandler(fakeDeps))`, pyynnöt `fetch`illä):
  - `palauttaa kalenterin tunnetulle tokenille` (200, content-type, runko sisältää tähdellä merkityn tapahtuman `SUMMARY`-rivin)
  - `väärän muotoinen token → 404 eikä Supabasea kutsuta` (`getPrefs`-kutsuja 0)
  - `tuntematon token → 404`
  - `Supabase-virhe → 503 eikä tyhjää kalenteria` (status 503, `Retry-After: 300`, runko ei sisällä `BEGIN:VCALENDAR`)
  - `tapahtumadatan virhe ilman välimuistia → 503`
  - `POST → 405` ja `GET /health → 200`
  - `events.json haetaan kerran TTL:n sisällä` ja `haun epäonnistuessa palautetaan vanha data` (`test/feed/events.test.ts`, valekello `now`)
  - `fetchFeedPrefs lähettää tokenin ja anon-avaimen` ja `heittää 5xx-vastauksesta`
- [ ] **Step 2: Aja** `npx vitest run test/feed` → FAIL.
- [ ] **Step 3: Toteuta** kolme moduulia.
- [ ] **Step 4: Aja** `npm test` → PASS.
- [ ] **Step 5: Kokeile paikallisesti:** `npx supabase start`, luo testikäyttäjä ja tähti SQL:llä, `SUPABASE_URL=… SUPABASE_ANON_KEY=… EVENTS_BASE_URL=https://kaaponen.github.io/tapahtumat-keski-suomi npm run feed`, sitten `curl -i localhost:8787/<token>.ics` → 200 ja VEVENT.
- [ ] **Step 6: Commit** `git commit -m "feat: henkilökohtainen kalenterisyötepalvelu"`

---

### Task 8: Tilimoduuli ja kirjautuminen

**Files:**
- Create: `src/web/account/config.ts`, `src/web/account/types.ts`, `src/web/account/client.ts`, `src/web/account/sync.ts`, `src/web/account/useAccount.ts`
- Modify: `package.json` (dependency `@supabase/supabase-js`), `src/web/App.tsx` (tähdet `useAccount`in kautta, otsikkoon "Kirjaudu"/"Oma tili")
- Test: `test/web/sync.test.ts`

**Interfaces:**
- Consumes: `getLocalStars`/`setLocalStars`, `resolveIds` (Task 3), Task 6:n taulut ja funktiot.
- Produces:
  - `config.ts`: `accountConfig(): { supabaseUrl: string; anonKey: string; feedBaseUrl: string } | null` – lähteenä `import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEED_BASE_URL`; jos jokin puuttuu → `null`.
  - `types.ts`: `export interface UserData { homeCity: string | null; favoriteCategories: string[]; followedVenues: { venue: string; inCalendar: boolean }[]; starred: string[]; feedToken: string }` ja `export interface AccountUser { id: string; email: string | null }`.
  - `client.ts`: `export interface AccountApi { currentUser(): Promise<AccountUser | null>; onAuthChange(cb: (u: AccountUser | null) => void): () => void; signIn(provider: 'apple' | 'google'): Promise<void>; signOut(): Promise<void>; load(): Promise<UserData>; setStar(eventId: string, on: boolean): Promise<void>; addStars(ids: string[]): Promise<void>; setHomeCity(city: string | null): Promise<void>; setFavoriteCategories(categories: string[]): Promise<void>; setFollowedVenue(venue: string, follow: { inCalendar: boolean } | null): Promise<void>; regenerateFeedToken(): Promise<string>; deleteAccount(): Promise<void> }` ja `export function createAccountApi(cfg): AccountApi`. `signIn` käyttää `redirectTo: location.origin + location.pathname`.
  - `useAccount.ts`: `useAccount(aliases: Record<string, string>): { available: boolean; user: AccountUser | null; data: UserData | null; stars: Set<string>; toggleStar(id: string): void; api: AccountApi | null; reload(): Promise<void> }`. Lataa `client.ts`:n dynaamisella `import()`:lla vain, jos `accountConfig()` ei ole null. Uloskirjautuneena tähdet laitteelta (Task 3), kirjautuneena tililtä.
  - `sync.ts`: `starsToUpload(local: string[], remote: string[], aliases: Record<string, string>): string[]` – ratkaistut paikalliset, joita ei ole etänä.
  - Kirjautuessa: `addStars(starsToUpload(...))`, sitten `setLocalStars([])`.

- [ ] **Step 1: Kirjoita epäonnistuvat testit:** `lähettää vain puuttuvat tähdet`, `ratkaisee paikalliset aliakset ennen vertailua`, `tyhjä paikallinen lista → ei mitään`.
- [ ] **Step 2: Aja** `npx vitest run test/web/sync.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** moduulit ja kytke App käyttämään `useAccount`ia.
- [ ] **Step 4: Aja** `npm test && npm run build` → PASS. Tarkista ilman `.env`-muuttujia: tili-UI ei näy, tähdet toimivat laitteella, ja `dist/assets`issa ei ole Supabase-koodia pääpaketissa (erillinen chunk).
- [ ] **Step 5: Commit** `git commit -m "feat: tilimoduuli ja Apple/Google-kirjautuminen"`

---

### Task 9: Paikkakuntasuodatin ja "Sinulle"-näkymä

**Files:**
- Create: `src/web/logic/forYou.ts`
- Modify: `src/web/logic/filters.ts` (`city`), `src/web/components/FiltersBar.tsx`, `src/web/App.tsx`, `src/web/styles.css`
- Test: `test/web/forYou.test.ts`, `test/web/filters.test.ts`

**Interfaces:**
- Consumes: `UserData`, `useAccount` (Task 8), `mainVenue`.
- Produces:
  - `Filters.city?: string` (osoiterivillä `city`); `applyFilters` suodattaa `e.city === f.city`.
  - `forYou(events: Event[], prefs: Pick<UserData, 'homeCity' | 'favoriteCategories' | 'followedVenues'>, stars: Set<string>, city?: string): Event[]` – mukaan, jos tähdellä TAI `mainVenue(e.venue)` seurattu (mikä tahansa paikkakunta) TAI (kategoria suosikeissa JA `e.city === (city ?? homeCity)`; jos kumpaakaan ei ole, kategoriasääntö koskee kaikkia paikkakuntia).
  - Kirjautuneena kaksi välilehteä: "Sinulle" (oletus) ja "Kaikki". "Sinulle"-näkymässä `filters.city` toimii paikkakunnan väliaikaisena vaihtona (`forYou`n `city`-parametri), muut suodattimet kuten nyt. Tyhjä "Sinulle": teksti "Valitse kotipaikkakunta ja kiinnostavat kategoriat, niin näet täällä sinulle sopivat tapahtumat." ja painike, joka avaa asetukset (Task 10).
  - FiltersBar: paikkakuntavalinta (paikkakunnat, joilla on vähintään 3 tapahtumaa, kuten paikoissa), ensimmäinen vaihtoehto "Kaikki paikkakunnat".

- [ ] **Step 1: Kirjoita epäonnistuvat testit:** `ottaa tähdellä merkityn toiselta paikkakunnalta`, `ottaa seuratun paikan toiselta paikkakunnalta`, `ottaa suosikkikategorian vain kotipaikkakunnalta`, `väliaikainen paikkakunta korvaa kotipaikkakunnan`, `ilman kotipaikkakuntaa kategoria koskee kaikkia`, `city-suodatin ja osoiterivi`.
- [ ] **Step 2: Aja** `npx vitest run test/web/forYou.test.ts test/web/filters.test.ts` → FAIL.
- [ ] **Step 3: Toteuta.**
- [ ] **Step 4: Aja** `npm test && npm run build` → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: Sinulle-näkymä ja paikkakuntasuodatin"`

---

### Task 10: Tilin asetukset, paikan seuraaminen ja tietosuojaseloste

**Files:**
- Create: `src/web/components/AccountPanel.tsx`, `src/web/account/feedUrls.ts`, `public/tietosuoja.html`
- Modify: `src/web/components/EventDetail.tsx` (seuraa paikkaa), `src/web/App.tsx`, `src/web/styles.css`, `public/sw.js` (ei muutoksia välimuistiin; varmista, ettei Supabase-pyyntöjä käsitellä – ne ovat toista alkuperää)
- Test: `test/web/feedUrls.test.ts`

**Interfaces:**
- Consumes: `AccountApi`, `UserData` (Task 8), `forYou` (Task 9).
- Produces:
  - `feedUrls(baseUrl: string, token: string): { https: string; webcal: string }` – `https://syote.x.fi/abc.ics` ja `webcal://syote.x.fi/abc.ics`; `baseUrl`in lopun `/` sallitaan.
  - `AccountPanel` (`<dialog>` kuten `EventDetail`): kirjautumattomalle painikkeet "Kirjaudu Applella" ja "Kirjaudu Googlella"; kirjautuneelle osiot:
    - Kotipaikkakunta (valinta)
    - Kiinnostavat kategoriat (sirut, `CATEGORY_ORDER`)
    - Seuratut paikat: lista, jokaisella valintaruutu "Näytä kalenterissa" ja "Lopeta seuraaminen"
    - Kalenterisyöte: osoite ja "Kopioi", linkki "Avaa kalenterissa" (`webcal`), ohjeet: Apple – avaa linkki tai Asetukset → Kalenteri → Tilit → Lisää tili → Muu → Lisää tilattu kalenteri; Google – calendar.google.com → Muut kalenterit → + → URL-osoitteesta (Google päivittää harvemmin, jopa kerran vuorokaudessa); Outlook – Lisää kalenteri → Tilaa verkosta
    - "Luo uusi syöteosoite" (vahvistus: "Vanha osoite lakkaa toimimasta, ja kalenteri pitää tilata uudelleen.")
    - "Kirjaudu ulos" ja "Poista tili" (vahvistus: "Tili ja kaikki tallennetut valinnat poistetaan pysyvästi.")
    - Linkki tietosuojaselosteeseen
  - EventDetail: kirjautuneena ja kun `mainVenue(e.venue)` on olemassa, painike "Seuraa: <paikka>" / "Seurataan: <paikka>" (uusi seuranta `inCalendar: false`).
  - `public/tietosuoja.html`: kuka ylläpitää, mitä tallennetaan (kirjautumistunniste, Applen/Googlen antama sähköposti, valinnat), missä (Supabase, EU), mihin käytetään (henkilökohtainen näkymä ja syöte), ei jaeta eteenpäin, tilin poisto asetuksista, yhteydenotto. Ylläpitäjän nimi ja yhteystieto kysytään Kallelta ennen julkaisua.

- [ ] **Step 1: Kirjoita epäonnistuvat testit:** `muodostaa https- ja webcal-osoitteen`, `sallii lopun kauttaviivan`.
- [ ] **Step 2: Aja** `npx vitest run test/web/feedUrls.test.ts` → FAIL.
- [ ] **Step 3: Toteuta** paneeli, seuraaminen ja seloste.
- [ ] **Step 4: Aja** `npm test && npm run build` → PASS.
- [ ] **Step 5: Tarkista paikallisesti** paikallista Supabasea vasten (`.env.local`: paikallisen Supabasen URL ja anon-avain; kirjautuminen testikäyttäjällä Supabase Studion kautta luodulla istunnolla tai sähköpostilla vain paikallisesti): asetukset tallentuvat, "Näytä kalenterissa" vaikuttaa `feed_for_token`in tulokseen, uusi syöteosoite mitätöi vanhan, tilin poisto tyhjentää rivit.
- [ ] **Step 6: Commit** `git commit -m "feat: tilin asetukset, paikan seuraaminen ja tietosuojaseloste"`

---

### Task 11: Julkaisutiedostot ja ohjeet

**Files:**
- Create: `deploy/feed/Dockerfile`, `deploy/feed/docker-compose.yml`, `deploy/feed/Caddyfile`, `deploy/feed/.env.example`
- Modify: `.github/workflows/update.yml` (build-vaiheen `env`: `VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}`, `VITE_SUPABASE_ANON_KEY: ${{ vars.SUPABASE_ANON_KEY }}`, `VITE_FEED_BASE_URL: ${{ vars.FEED_BASE_URL }}`), `README.md` (osiot "Tilit ja syöte" ja "Syötepalvelun julkaisu")

**Interfaces:**
- Consumes: `npm run feed` (Task 7).
- Produces: Docker-kontti `feed` (Node 22 alpine, `npm ci`, `CMD ["npx", "tsx", "src/feed/server.ts"]`, ei-root-käyttäjä, portti 8787 vain sisäverkkoon) ja `caddy` (portit 80/443, `syote.<nimi>.fi { reverse_proxy feed:8787 }`). `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `EVENTS_BASE_URL`, `FEED_DOMAIN`.

- [ ] **Step 1: Kirjoita tiedostot.** Jos VPS:llä on jo web-palvelin porteissa 80/443 (tarkistetaan Task 12:ssa), README neuvoo lisäämään syötteen sen taakse Caddyn sijaan.
- [ ] **Step 2: Aja** `docker compose -f deploy/feed/docker-compose.yml build` → onnistuu, ja `docker compose ... up feed` + `curl localhost:8787/health` (portti avattuna testiä varten) → `ok`.
- [ ] **Step 3: Aja** `npm test && npm run build` → PASS (ilman muuttujia sivu toimii kuten ennen).
- [ ] **Step 4: Commit** `git commit -m "chore: syötepalvelun julkaisutiedostot ja ohjeet"`

---

### Task 12: Käyttöönotto (yhdessä Kallen kanssa)

Tämä tehtävä vaatii Kallen tunnukset ja päätökset. Jokainen kohta tehdään vasta Kallen luvalla.

- [ ] **Step 1: Nimi ja verkkotunnus:** Kalle valitsee nimen, tarkistetaan saatavuus ja ostetaan Hostingerista.
- [ ] **Step 2: GitHub Pages omaan verkkotunnukseen:** DNS (`A`/`CNAME` GitHub Pagesin ohjeen mukaan), repon asetuksissa Custom domain ja Enforce HTTPS. Varmista, että vanha osoite ohjautuu. Huom.: PWA:n asentaneiden pitää asentaa sovellus uudelleen uudesta osoitteesta.
- [ ] **Step 3: Supabase:** projekti EU-alueelle, `npx supabase link` ja `npx supabase db push`. Auth → Site URL `https://<nimi>.fi`, Redirect URLs sama.
- [ ] **Step 4: Google:** OAuth-asiakas Kallen Google Cloud -tilillä, redirect URI Supabasen ohjeen mukaan, avaimet Supabaseen.
- [ ] **Step 5: Apple:** kehittäjätili (99 $/v), Services ID ja avain Kallen tilillä, avaimet Supabaseen. Muistutus: Applen client secret vanhenee 6 kuukauden välein ja pitää uusia.
- [ ] **Step 6: GitHub-muuttujat:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FEED_BASE_URL=https://syote.<nimi>.fi`, ja aja workflow.
- [ ] **Step 7: VPS:** tarkista, mitä porteissa 80/443 jo on ja mitkä portit Valheim käyttää. DNS `syote.<nimi>.fi` → VPS:n IP. Palomuuri (SSH, 80, 443, Valheimin portit), `deploy/feed/.env`, `docker compose up -d`. Tarkista `curl https://syote.<nimi>.fi/health` → `ok`.
- [ ] **Step 8: Päästä päähän:** kirjaudu Applella ja Googlella, merkitse tähti, tilaa syöte iPhonen kalenteriin, tapahtuma näkyy. Pysäytä syötekontti hetkeksi ja varmista, ettei kalenteri tyhjene.
