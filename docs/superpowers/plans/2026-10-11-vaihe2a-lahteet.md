# Vaihe 2A: uudet lähteet – toteutussuunnitelma

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lisätään keruuseen Jelmun (Lutakko, Musta kynnys) keikat ja Jyväskylän kaupunginteatterin esitykset niin, etteivät ne tuplaannu Keski-Suomen kalenterin tapahtumien kanssa.

**Architecture:** Kaksi uutta `Source`-moduulia (`src/sources/jelmu.ts`, `src/sources/jklteatteri.ts`) samaan tapaan kuin `paviljonki.ts`. Kummastakin on puhdas jäsennysfunktio, joka saa HTML:n ja päivän (`today`, muotoa YYYY-MM-DD), sekä `fetch`, joka hakee sivut. Uusi apufunktio `inferYear` päättelee vuoden päivämäärille, joissa sitä ei ole. Lähteet rekisteröidään `SOURCES`- ja `SOURCE_PRIORITY`-listoihin.

**Tech Stack:** Node 22, TypeScript (strict), cheerio, vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-vaihe2a-lahteet-design.md`

## Global Constraints

- Työ tehdään haarassa `feat/vaihe2a-lahteet`. Spec on jo commitoitu sinne.
- Jokainen commit päättyy riviin `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ei uusia riippuvuuksia.
- Lähde-id:t ovat `jelmu` ja `jklteatteri`. Nimet ovat `Jelmu` ja `Jyväskylän kaupunginteatteri`.
- `SOURCE_PRIORITY` on täsmälleen `['paviljonki', 'peurunka', 'jelmu', 'jklteatteri', 'keikkalista', 'keskisuomievents']`.
- Testiaineiston haussa käytetään User-Agentia `TapahtumatBot/0.1 (+https://github.com/Kaaponen/tapahtumat-keski-suomi)`. Bottiestoja ei kierretä.
- Komennot `npm test` ja `npm run typecheck` menevät läpi jokaisen tehtävän lopussa.
- Koodin ja testien kommentit ja testinimet kirjoitetaan suomeksi, kuten muualla repossa.

## Review Focus

1. **Vuodenvaihde:** tammikuussa joulukuun lopun päivämäärä tulkitaan edelliselle vuodelle, ei 11 kuukauden päähän. Testi on tehtävässä 1.
2. **Saman keikan aikaero:** Jelmulla on ovien aika ja esiintymisaika, Keski-Suomen kalenterissa ovien aika. Jelmun `start` on siksi ovien aika, jolloin keikat yhdistyvät. Testit ovat tehtävissä 2 ja 4.
3. **Teatterin vapaamuotoiset rivit:**
   - Useita aikoja samalla rivillä, aikaväli ja rivin lopun lisätekstit.
   - Sama päivä ja aika kahdesti sivulla.
   - Rivit, jotka eivät ala viikonpäivällä.
   Testit ovat tehtävässä 3.
4. **Yksittäisen sivun haku epäonnistuu:** teatterin muut esitykset tallennetaan silti. Testi on tehtävässä 3.
5. **Koostesivu `muut-tapahtumat` ohitetaan,** koska siinä on monta eri tapahtumaa yhden otsikon alla. Testi on tehtävässä 3.

## Tiedostot

| Tiedosto | Muutos |
|---|---|
| `src/shared/time.ts` | Lisätään `inferYear` |
| `test/shared/time.test.ts` | `inferYear`-testit |
| `src/sources/jelmu.ts` | Uusi: `JELMU_URL`, `parseJelmu`, `jelmu` |
| `test/sources/jelmu.test.ts` | Uusi |
| `test/fixtures/jelmu/front.html` | Uusi: tallennettu etusivu |
| `src/sources/jklteatteri.ts` | Uusi: `JKLTEATTERI_LIST_URL`, `parseTeatteriList`, `parseTeatteriShow`, `jklteatteri` |
| `test/sources/jklteatteri.test.ts` | Uusi |
| `test/fixtures/jklteatteri/{list,aino,vierailu-luolamies}.html` | Uudet: tallennetut sivut |
| `src/sources/index.ts` | Lähteet `SOURCES`-listaan |
| `src/dedupe/merge.ts` | `SOURCE_PRIORITY` |
| `test/dedupe.cases.ts`, `test/dedupe/merge.test.ts` | Tuplien tunnistuksen ja yhdistämisen testit uusille lähteille |
| `README.md` | Lähdelista |

---

### Task 1: `inferYear`

**Files:**
- Modify: `src/shared/time.ts` (lisätään funktion `addDays` perään)
- Test: `test/shared/time.test.ts`

**Interfaces:**
- Produces: `inferYear(m: number, d: number, today: string): number`. Parametri `today` on muotoa `YYYY-MM-DD`. Funktio palauttaa aikaisimman vuoden joukosta (edellinen, kuluva, seuraava), jolla päivämäärä on enintään 60 päivää ennen `today`ta.

- [ ] **Step 1: Kirjoita epäonnistuva testi**

Lisää `inferYear` tiedoston `test/shared/time.test.ts` import-listaan ja tiedoston loppuun:

```ts
describe('inferYear', () => {
  it('tuleva päivä on kuluvaa vuotta', () => {
    expect(inferYear(10, 16, '2026-10-11')).toBe(2026);
  });
  it('lähimenneisyys pysyy kuluvana vuonna (suodatetaan myöhemmin pois)', () => {
    expect(inferYear(9, 25, '2026-10-11')).toBe(2026);
  });
  it('yli 60 päivää mennyt päivä on ensi vuotta', () => {
    expect(inferYear(1, 15, '2026-10-11')).toBe(2027);
  });
  it('raja: tasan 60 päivää sitten on kuluvaa vuotta, 61 päivää ensi vuotta', () => {
    expect(inferYear(8, 12, '2026-10-11')).toBe(2026);
    expect(inferYear(8, 11, '2026-10-11')).toBe(2027);
  });
  it('joulukuussa tammikuun päivä on ensi vuotta', () => {
    expect(inferYear(1, 5, '2026-12-20')).toBe(2027);
    expect(inferYear(12, 1, '2026-12-20')).toBe(2026);
  });
  it('tammikuussa joulukuun loppu on edellistä vuotta', () => {
    expect(inferYear(12, 28, '2027-01-10')).toBe(2026);
    expect(inferYear(1, 20, '2027-01-10')).toBe(2027);
  });
});
```

- [ ] **Step 2: Aja testi ja varmista, että se epäonnistuu**

Run: `npx vitest run test/shared/time.test.ts`
Expected: FAIL (`inferYear` ei ole funktio / ei exportattu)

- [ ] **Step 3: Toteuta**

Lisää tiedostoon `src/shared/time.ts` funktion `addDays` jälkeen:

```ts
/**
 * Vuosi päivämäärälle, jossa sitä ei ole ("16.10."): aikaisin vuosi (edellinen, kuluva, seuraava),
 * jolla päivä on enintään 60 päivää menneisyydessä.
 */
export function inferYear(m: number, d: number, today: string): number {
  const y = Number(today.slice(0, 4));
  const cutoff = addDays(today, -60);
  return [y - 1, y].find((year) => isoDate(year, m, d) >= cutoff) ?? y + 1;
}
```

- [ ] **Step 4: Aja testit**

Run: `npx vitest run test/shared/time.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/time.ts test/shared/time.test.ts
git commit -m "feat: inferYear päättelee vuoden päivämäärälle ilman vuotta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Jelmu-lähde

**Files:**
- Create: `src/sources/jelmu.ts`
- Create: `test/sources/jelmu.test.ts`
- Create: `test/fixtures/jelmu/front.html`

**Interfaces:**
- Consumes: `inferYear(m, d, today)` (Task 1), `helsinkiIso`, `isoDate`, `dayKey` tiedostosta `src/shared/time.ts`, `fakeCtx` tiedostosta `test/helpers.ts`.
- Produces: `JELMU_URL = 'https://www.jelmu.net/'`, `parseJelmu(html: string, today: string): RawEvent[]`, `jelmu: Source` (id `jelmu`).

Sivun rakenne (tarkistettu 2026-10-11) on tiivistetysti tällainen:

```html
<li class="product ...">
  <a href="https://www.jelmu.net/event/saimaa-2" class="woocommerce-LoopProduct-link ..."><img src="...jpeg" />
    <p class="datetime"><span>pe</span><span class="date">16.10.</span></p>
    <div><h2 class="woocommerce-loop-product__title"><span> Saimaa (21:00) </span></h2>
      <div><span class="location">Lutakko</span><span class="age">K18</span><span class="doors">Ovet 19:00</span>
        <span class="price">…33,00€… &ndash; …40,00€…</span></div></div></a>
  <p class="out-of-stock">Loppuunmyyty!</p>
</li>
```

Kaikilla keikoilla ei ole nimessä esiintymisaikaa (otsikko voi olla ilman `<span>`-elementtiä, esim. "Live is Life: Radiopuhelimet, PK Keränen").

- [ ] **Step 1: Tallenna oikea etusivu testiaineistoksi**

```bash
mkdir -p test/fixtures/jelmu
node -e 'const [u,p]=process.argv.slice(1);fetch(u,{headers:{"User-Agent":"TapahtumatBot/0.1 (+https://github.com/Kaaponen/tapahtumat-keski-suomi)"}}).then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(t=>require("fs").writeFileSync(p,t))' https://www.jelmu.net/ test/fixtures/jelmu/front.html
grep -c 'woocommerce-LoopProduct-link' test/fixtures/jelmu/front.html
```

Expected: luku on yli 20.

- [ ] **Step 2: Kirjoita epäonnistuvat testit**

Luo `test/sources/jelmu.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JELMU_URL, jelmu, parseJelmu } from '../../src/sources/jelmu';
import { fakeCtx } from '../helpers';

const item = (inner: string) => `<li class="product type-product">${inner}</li>`;

const FRONT = `<ul class="products">
${item(`<a href="https://www.jelmu.net/event/saimaa-2" class="woocommerce-LoopProduct-link woocommerce-loop-product__link"><img src="https://www.jelmu.net/media/saimaa.jpeg" alt="" />
  <p class="datetime"><span>pe</span><span class="date">16.10.</span></p>
  <div><h2 class="woocommerce-loop-product__title"><span>
      Saimaa (21:00)        </span></h2>
  <div><span class="location">Lutakko</span><span class="age">K18</span><span class="doors">Ovet 19:00</span>
  <span class="price"><span class="amount"><bdi>33,00<span>&euro;</span></bdi></span> &ndash; <span class="amount"><bdi>40,00<span>&euro;</span></bdi></span></span>
  </div></div></a><p class="out-of-stock">Loppuunmyyty!</p>`)}
${item(`<a href="https://www.jelmu.net/event/live-is-life" class="woocommerce-LoopProduct-link"><img src="https://www.jelmu.net/media/lil.jpeg" />
  <p class="datetime"><span>pe</span><span class="date">15.1.</span></p>
  <div><h2 class="woocommerce-loop-product__title">
      Live is Life: Radiopuhelimet, PK Keränen    </h2>
  <div><span class="location">Musta kynnys</span><span class="doors">Ovet 21:00</span></div></div></a>`)}
${item(`<a href="https://www.jelmu.net/event/klubi" class="woocommerce-LoopProduct-link">
  <p class="datetime"><span>pe</span><span class="date">20.11.</span></p>
  <div><h2 class="woocommerce-loop-product__title"><span>Klubi-ilta (22:00)</span></h2>
  <div><span class="location">Lutakko</span></div></div></a>`)}
${item(`<a href="https://www.jelmu.net/event/avoimet" class="woocommerce-LoopProduct-link">
  <p class="datetime"><span>la</span><span class="date">21.11.</span></p>
  <div><h2 class="woocommerce-loop-product__title">Avoimet ovet</h2></div></a>`)}
${item(`<a href="https://www.jelmu.net/event/rikki" class="woocommerce-LoopProduct-link">
  <p class="datetime"><span></span><span class="date"></span></p>
  <div><h2 class="woocommerce-loop-product__title">Ei päivää</h2></div></a>`)}
</ul>`;

const TODAY = '2026-10-11';

describe('parseJelmu', () => {
  it('käyttää ovien aikaa alkuaikana ja kokoaa kuvauksen', () => {
    expect(parseJelmu(FRONT, TODAY)[0]).toEqual({
      source: 'jelmu',
      sourceId: 'saimaa-2',
      title: 'Saimaa',
      start: '2026-10-16T19:00:00+03:00',
      allDay: false,
      venue: 'Lutakko',
      city: 'Jyväskylä',
      url: 'https://www.jelmu.net/event/saimaa-2',
      ticketUrl: 'https://www.jelmu.net/event/saimaa-2',
      image: 'https://www.jelmu.net/media/saimaa.jpeg',
      description: 'K18 · Ovet 19:00 · Keikka alkaa 21:00 · 33,00€ – 40,00€ · Loppuunmyyty',
      categories: ['keikat'],
    });
  });

  it('päättelee vuoden ja lukee otsikon ilman span-elementtiä', () => {
    expect(parseJelmu(FRONT, TODAY)[1]).toMatchObject({
      sourceId: 'live-is-life',
      title: 'Live is Life: Radiopuhelimet, PK Keränen',
      start: '2027-01-15T21:00:00+02:00',
      venue: 'Musta kynnys',
      description: 'Ovet 21:00',
    });
  });

  it('käyttää esiintymisaikaa, jos ovien aikaa ei ole', () => {
    expect(parseJelmu(FRONT, TODAY)[2]).toMatchObject({
      title: 'Klubi-ilta',
      start: '2026-11-20T22:00:00+02:00',
      allDay: false,
      description: 'Keikka alkaa 22:00',
    });
  });

  it('ilman kellonaikaa tapahtuma on koko päivän, ja rivi ilman päivää ohitetaan', () => {
    const events = parseJelmu(FRONT, TODAY);
    expect(events).toHaveLength(4);
    expect(events[3]).toMatchObject({ title: 'Avoimet ovet', start: '2026-11-21', allDay: true });
    expect(events[3].description).toBeUndefined();
    expect(events[3].venue).toBeUndefined();
  });

  it('jäsentää oikean tallennetun etusivun', () => {
    const events = parseJelmu(readFileSync('test/fixtures/jelmu/front.html', 'utf8'), TODAY);
    expect(events.length).toBeGreaterThan(20);
    for (const e of events) {
      expect(e.url).toMatch(/^https:\/\/www\.jelmu\.net\/event\//);
      expect(['Lutakko', 'Musta kynnys']).toContain(e.venue);
      expect(e.title).not.toMatch(/\(\d{1,2}[:.]\d{2}\)$/);
    }
  });
});

describe('jelmu.fetch', () => {
  afterEach(() => vi.useRealTimers());

  it('hakee etusivun kerran ja päättelee vuoden nykyhetkestä', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T09:00:00Z'));
    const ctx = fakeCtx({ [JELMU_URL]: FRONT });
    const events = await jelmu.fetch(ctx);
    expect(ctx.requested).toEqual([JELMU_URL]);
    expect(events).toHaveLength(4);
    expect(events[1].start).toBe('2027-01-15T21:00:00+02:00');
  });
});
```

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/jelmu.test.ts`
Expected: FAIL (moduulia `src/sources/jelmu` ei löydy)

- [ ] **Step 4: Toteuta**

Luo `src/sources/jelmu.ts`:

```ts
import * as cheerio from 'cheerio';
import { dayKey, helsinkiIso, inferYear, isoDate } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

export const JELMU_URL = 'https://www.jelmu.net/';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const TIME = /(\d{1,2})[:.](\d{2})/;
/** Esiintymisaika otsikon lopussa: "Saimaa (21:00)". */
const TITLE_TIME = /\s*\((\d{1,2}[:.]\d{2})\)\s*$/;

/**
 * Jelmun etusivun "Tulevat keikat". Alkuaika on ovien aika, koska Keski-Suomen kalenteri
 * käyttää samoja keikkoja ovien ajalla; esiintymisaika kerrotaan kuvauksessa.
 */
export function parseJelmu(html: string, today: string): RawEvent[] {
  const $ = cheerio.load(html);
  const out: RawEvent[] = [];
  $('li.product').each((_, el) => {
    const li = $(el);
    const url = li.find('a.woocommerce-LoopProduct-link').first().attr('href');
    const rawTitle = clean(li.find('.woocommerce-loop-product__title').first().text());
    const showTime = rawTitle.match(TITLE_TIME)?.[1];
    const title = rawTitle.replace(TITLE_TIME, '');
    const date = li.find('.datetime .date').first().text().match(/(\d{1,2})\.(\d{1,2})\./);
    if (!url || !title || !date) return;

    const d = Number(date[1]);
    const m = Number(date[2]);
    const y = inferYear(m, d, today);
    const doors = clean(li.find('.doors').first().text());
    const time = doors.match(TIME) ?? showTime?.match(TIME) ?? null;
    const description = [
      clean(li.find('.age').first().text()),
      doors,
      showTime && `Keikka alkaa ${showTime}`,
      clean(li.find('.price').first().text()),
      li.find('.out-of-stock').length > 0 && 'Loppuunmyyty',
    ].filter(Boolean).join(' · ');

    out.push({
      source: 'jelmu',
      sourceId: new URL(url).pathname.split('/').filter(Boolean).pop() ?? url,
      title,
      start: time ? helsinkiIso(y, m, d, Number(time[1]), Number(time[2])) : isoDate(y, m, d),
      allDay: !time,
      venue: clean(li.find('.location').first().text()) || undefined,
      city: 'Jyväskylä',
      url,
      ticketUrl: url,
      image: li.find('img').first().attr('src') || undefined,
      description: description || undefined,
      categories: ['keikat'],
    });
  });
  return out;
}

export const jelmu: Source = {
  id: 'jelmu',
  name: 'Jelmu',
  async fetch(ctx) {
    return parseJelmu(await ctx.getText(JELMU_URL), dayKey(new Date().toISOString()));
  },
};
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources/jelmu.test.ts && npm run typecheck`
Expected: PASS. Jos oikean sivun testi epäonnistuu jonkin paikan nimen takia (esim. kolmas paikka), tarkista tallennettu sivu ja lisää paikka testin sallittuihin arvoihin vain, jos se on aidosti Jelmun paikka.

- [ ] **Step 6: Commit**

```bash
git add src/sources/jelmu.ts test/sources/jelmu.test.ts test/fixtures/jelmu/front.html
git commit -m "feat: Jelmu-lähde (Lutakko, Musta kynnys)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Kaupunginteatteri-lähde

**Files:**
- Create: `src/sources/jklteatteri.ts`
- Create: `test/sources/jklteatteri.test.ts`
- Create: `test/fixtures/jklteatteri/list.html`, `test/fixtures/jklteatteri/aino.html`, `test/fixtures/jklteatteri/vierailu-luolamies.html`

**Interfaces:**
- Consumes: `inferYear` (Task 1), `helsinkiIso`, `isoDate`, `dayKey`, `fakeCtx`.
- Produces:
  - `JKLTEATTERI_LIST_URL = 'https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto'`
  - `parseTeatteriList(html: string): string[]`, joka palauttaa absoluuttiset esityssivujen URLit ilman tuplia sivun järjestyksessä. `muut-tapahtumat` jätetään pois.
  - `parseTeatteriShow(html: string, url: string, today: string): RawEvent[]`
  - `jklteatteri: Source` (id `jklteatteri`)

Esityssivun rakenne (tarkistettu 2026-10-11): sivun sisältö on elementissä `div.main`. Esityskerrat ovat `<br>`-eroteltuina riveinä, esimerkiksi `<strong>pe 25.9. </strong>klo 18.30&nbsp;<strong>ennakkonäytös</strong><br>`. Oikeilla sivuilla esiintyvät myös nämä muodot:
- "la 28.11. klo 13.00 ja klo 14.30"
- "ke 13.10. klo 10–12"
- "ma 16.11.2026 klo 18.30 | suuri näyttämö"
- "ma 28.9. klo 18 TÄYNNÄ"

Seuraavat rivit eivät ole esityskertoja: "Ensi-ilta la 26.9.2026 klo 15" ja "Teosesittely 17.9. klo 13.00".

- [ ] **Step 1: Tallenna oikeat sivut testiaineistoksi**

```bash
mkdir -p test/fixtures/jklteatteri
save() { node -e 'const [u,p]=process.argv.slice(1);fetch(u,{headers:{"User-Agent":"TapahtumatBot/0.1 (+https://github.com/Kaaponen/tapahtumat-keski-suomi)"}}).then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(t=>require("fs").writeFileSync(p,t))' "$1" "$2"; sleep 1; }
save https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto test/fixtures/jklteatteri/list.html
save https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto/aino test/fixtures/jklteatteri/aino.html
save https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto/vierailu-luolamies test/fixtures/jklteatteri/vierailu-luolamies.html
ls -la test/fixtures/jklteatteri
```

Expected: kolme tiedostoa, jokainen yli 20 kt.

- [ ] **Step 2: Kirjoita epäonnistuvat testit**

Luo `test/sources/jklteatteri.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JKLTEATTERI_LIST_URL, jklteatteri, parseTeatteriList, parseTeatteriShow,
} from '../../src/sources/jklteatteri';
import { fakeCtx } from '../helpers';

const BASE = 'https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto';
const AINO = `${BASE}/aino`;
const LUOLAMIES = `${BASE}/vierailu-luolamies`;

const LIST = `<html><body><div class="main">
  <a href="/kaupunginteatteri/ohjelmisto">Ohjelmisto</a>
  <a href="/kaupunginteatteri/ohjelmisto/aino">Aino A.</a>
  <a href="/kaupunginteatteri/ohjelmisto/aino">Lue lisää</a>
  <a href="/kaupunginteatteri/ohjelmisto/muut-tapahtumat">Muut tapahtumat</a>
  <a href="https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto/vierailu-luolamies/">Luolamies</a>
  <a href="/tanssiteatteri/ohjelmisto/jotain">Tanssi</a>
</div></body></html>`;

const SHOW = `<html><head>
<meta property="og:title" content="Vierailu: Aino A." />
<meta property="og:description" content="Kuvaus &amp; lisää." />
<meta property="og:image" content="https://www.jklteatteri.fi/kuva.jpg" />
</head><body>
<div class="main main--with-sidebar">
<p><strong>Ensi-ilta</strong> la 26.9.2026 klo 15 | &nbsp;suuri näyttämö<br>
<a href="https://www.lippu.fi/eventseries/name-1">Osta liput &gt;&gt;</a></p>
<p><strong>pe 16.10. </strong>klo 18.30&nbsp;<strong>&nbsp;ennakkonäytös</strong><br>
<strong>la 28.11. </strong>klo 13.00 ja klo 14.30<br>
<strong>ke 13.1. </strong>klo 10–12<br>
<strong>pe 16.10. </strong>klo 18.30 TÄYNNÄ<br>
Teosesittely 17.10. klo 13.00<br>
<strong>la 21.11.2026</strong> klo 18 | suuri näyttämö</p>
</div></body></html>`;

const TODAY = '2026-10-11';

describe('parseTeatteriList', () => {
  it('palauttaa esityssivut ilman tuplia ja ohittaa koostesivun', () => {
    expect(parseTeatteriList(LIST)).toEqual([AINO, LUOLAMIES]);
  });

  it('jäsentää oikean tallennetun ohjelmistosivun', () => {
    const urls = parseTeatteriList(readFileSync('test/fixtures/jklteatteri/list.html', 'utf8'));
    expect(urls.length).toBeGreaterThanOrEqual(5);
    expect(urls).toContain(AINO);
    expect(urls.some((u) => u.endsWith('/muut-tapahtumat'))).toBe(false);
  });
});

describe('parseTeatteriShow', () => {
  const events = () => parseTeatteriShow(SHOW, AINO, TODAY);

  it('tekee jokaisesta esityskerrasta oman tapahtuman', () => {
    expect(events()[0]).toEqual({
      source: 'jklteatteri',
      sourceId: 'aino-2026-10-16-1830',
      title: 'Aino A.',
      start: '2026-10-16T18:30:00+03:00',
      allDay: false,
      venue: 'Jyväskylän kaupunginteatteri',
      city: 'Jyväskylä',
      url: AINO,
      ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
      image: 'https://www.jklteatteri.fi/kuva.jpg',
      description: 'Kuvaus & lisää.',
      categories: ['teatteri'],
    });
  });

  it('lukee useat ajat, aikavälin ja rivin vuoden; ohittaa tuplat ja rivit ilman viikonpäivää', () => {
    expect(events().map((e) => [e.start, e.end])).toEqual([
      ['2026-10-16T18:30:00+03:00', undefined],
      ['2026-11-28T13:00:00+02:00', undefined],
      ['2026-11-28T14:30:00+02:00', undefined],
      ['2027-01-13T10:00:00+02:00', '2027-01-13T12:00:00+02:00'],
      ['2026-11-21T18:00:00+02:00', undefined],
    ]);
  });

  it('ei palauta mitään ilman otsikkoa', () => {
    expect(parseTeatteriShow('<html><body><div class="main">pe 16.10. klo 18</div></body></html>', AINO, TODAY)).toEqual([]);
  });

  it('jäsentää oikeat tallennetut esityssivut', () => {
    const aino = parseTeatteriShow(readFileSync('test/fixtures/jklteatteri/aino.html', 'utf8'), AINO, TODAY);
    expect(aino.length).toBeGreaterThanOrEqual(10);
    expect(aino.every((e) => e.title === 'Aino A.' && e.ticketUrl?.includes('lippu.fi'))).toBe(true);
    const luolamies = parseTeatteriShow(
      readFileSync('test/fixtures/jklteatteri/vierailu-luolamies.html', 'utf8'), LUOLAMIES, TODAY,
    );
    expect(luolamies.length).toBeGreaterThanOrEqual(1);
    expect(luolamies[0].title).toBe('Luolamies');
  });
});

describe('jklteatteri.fetch', () => {
  afterEach(() => vi.useRealTimers());

  it('hakee listan ja esityssivut; epäonnistunut sivu ohitetaan', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T09:00:00Z'));
    const logs: string[] = [];
    const ctx = { ...fakeCtx({ [JKLTEATTERI_LIST_URL]: LIST, [AINO]: SHOW }), log: (m: string) => logs.push(m) };
    const events = await jklteatteri.fetch(ctx);
    expect(events).toHaveLength(5);
    expect(ctx.requested).toEqual([JKLTEATTERI_LIST_URL, AINO, LUOLAMIES]);
    expect(logs.join('\n')).toContain(LUOLAMIES);
  });

  it('listasivun virhe kaataa lähteen', async () => {
    await expect(jklteatteri.fetch(fakeCtx({}))).rejects.toThrow();
  });
});
```

Huom: `{ ...fakeCtx(...) }` kopioi `requested`-taulukon viittauksen, joten `ctx.requested` päivittyy, koska `lookup` työntää samaan taulukkoon.

- [ ] **Step 3: Aja testit ja varmista, että ne epäonnistuvat**

Run: `npx vitest run test/sources/jklteatteri.test.ts`
Expected: FAIL (moduulia ei löydy)

- [ ] **Step 4: Toteuta**

Luo `src/sources/jklteatteri.ts`:

```ts
import * as cheerio from 'cheerio';
import { dayKey, helsinkiIso, inferYear, isoDate } from '../shared/time';
import type { RawEvent, Source } from '../shared/types';

const BASE = 'https://www.jklteatteri.fi';
export const JKLTEATTERI_LIST_URL = `${BASE}/kaupunginteatteri/ohjelmisto`;

/** Koostesivu, jolla on monta eri tapahtumaa yhden otsikon alla. */
const SKIP = new Set(['muut-tapahtumat']);
const SHOW_PATH = /^\/kaupunginteatteri\/ohjelmisto\/([^/]+)\/?$/;
/** Esityskerran rivi alkaa viikonpäivällä: "pe 25.9. klo 18.30", "ma 16.11.2026 klo 18.30". */
const LINE = /^(?:ma|ti|ke|to|pe|la|su) (\d{1,2})\.(\d{1,2})\.(\d{4})?/i;
/** "klo 18.30", "klo 18", "klo 10–12". */
const KLO = /klo\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*[–-]\s*(\d{1,2})(?:[.:](\d{2}))?)?/gi;

export function parseTeatteriList(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL($(a).attr('href')!, JKLTEATTERI_LIST_URL);
    } catch {
      return; // rikkinäinen linkki
    }
    const m = u.pathname.match(SHOW_PATH);
    if (u.hostname === 'www.jklteatteri.fi' && m && !SKIP.has(m[1])) {
      urls.add(`${BASE}/kaupunginteatteri/ohjelmisto/${m[1]}`);
    }
  });
  return [...urls];
}

/** Sivun tekstirivit: <br> ja lohkoelementtien loput ovat rivinvaihtoja. */
function textLines(html: string): string[] {
  const marked = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '$&\n');
  return cheerio.load(marked).root().text().split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
}

export function parseTeatteriShow(html: string, url: string, today: string): RawEvent[] {
  const $ = cheerio.load(html);
  const meta = (p: string) => $(`meta[property="og:${p}"]`).attr('content')?.trim() || undefined;
  const title = meta('title')?.replace(/^(vierailu|yhteistyö):\s*/i, '');
  if (!title) return [];
  const main = $('.main').first();
  const root = main.length ? main : $('body');
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop()!;
  const ticketUrl = root.find('a[href*="lippu.fi"]').first().attr('href') || undefined;

  const out: RawEvent[] = [];
  const seen = new Set<string>();
  for (const line of textLines(root.html() ?? '')) {
    const date = line.match(LINE);
    if (!date) continue;
    const d = Number(date[1]);
    const m = Number(date[2]);
    const y = date[3] ? Number(date[3]) : inferYear(m, d, today);
    for (const t of line.matchAll(KLO)) {
      const hh = Number(t[1]);
      const mm = Number(t[2] ?? 0);
      if (hh > 23 || mm > 59) continue;
      const sourceId = `${slug}-${isoDate(y, m, d)}-${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      out.push({
        source: 'jklteatteri',
        sourceId,
        title,
        start: helsinkiIso(y, m, d, hh, mm),
        end: t[3] ? helsinkiIso(y, m, d, Number(t[3]), Number(t[4] ?? 0)) : undefined,
        allDay: false,
        venue: 'Jyväskylän kaupunginteatteri',
        city: 'Jyväskylä',
        url,
        ticketUrl,
        image: meta('image'),
        description: meta('description'),
        categories: ['teatteri'],
      });
    }
  }
  return out;
}

export const jklteatteri: Source = {
  id: 'jklteatteri',
  name: 'Jyväskylän kaupunginteatteri',
  async fetch(ctx) {
    const today = dayKey(new Date().toISOString());
    const urls = parseTeatteriList(await ctx.getText(JKLTEATTERI_LIST_URL));
    const out: RawEvent[] = [];
    for (const url of urls) {
      try {
        out.push(...parseTeatteriShow(await ctx.getText(url), url, today));
      } catch (err) {
        ctx.log(`jklteatteri: esityssivu epäonnistui ${url}: ${(err as Error).message}`);
      }
    }
    return out;
  },
};
```

- [ ] **Step 5: Aja testit**

Run: `npx vitest run test/sources/jklteatteri.test.ts && npm run typecheck`
Expected: PASS. Jos `toEqual`-vertailu kaatuu siksi, että `end: undefined` -avain puuttuu tai on mukana, se ei ole virhe, sillä `toEqual` ohittaa undefined-arvot. Tutki siis muut erot.

- [ ] **Step 6: Commit**

```bash
git add src/sources/jklteatteri.ts test/sources/jklteatteri.test.ts test/fixtures/jklteatteri
git commit -m "feat: Jyväskylän kaupunginteatteri -lähde

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rekisteröinti, etusijajärjestys, README ja oikea keruu

**Files:**
- Modify: `src/sources/index.ts`
- Modify: `src/dedupe/merge.ts:9`
- Modify: `test/dedupe.cases.ts` (lisätään tapauksia `DEDUPE_CASES`-taulukon loppuun)
- Modify: `test/dedupe/merge.test.ts` (lisätään testi `describe('mergeGroup')`-lohkoon)
- Modify: `README.md`

**Interfaces:**
- Consumes: `jelmu` (Task 2), `jklteatteri` (Task 3), `raw()` tiedostosta `test/dedupe.cases.ts`, `mergeGroup` ja `normalizeEvent`.

- [ ] **Step 1: Kirjoita testit tuplien tunnistukselle ja etusijalle**

Lisää `test/dedupe.cases.ts`-tiedoston `DEDUPE_CASES`-taulukon loppuun (ennen sulkevaa `];`):

```ts
  {
    name: 'Jelmun keikka ovien ajalla = Keski-Suomen kalenterin sama keikka',
    a: raw({ source: 'jelmu', title: 'Saimaa', start: '2026-10-16T19:00:00+03:00', venue: 'Lutakko', city: 'Jyväskylä' }),
    b: raw({ title: 'Saimaa', start: '2026-10-16T19:00:00+03:00', venue: 'Tanssisali Lutakko', address: 'Lutakonaukio 3' }),
    same: true,
  },
  {
    name: 'teatterin esitys = Keski-Suomen kalenterin pitkä otsikko',
    a: raw({ source: 'jklteatteri', title: 'Aino A.', start: '2026-10-17T13:00:00+03:00', venue: 'Jyväskylän kaupunginteatteri' }),
    b: raw({
      title: 'Aino A. -näytelmä Jyväskylän kaupunginteatterissa', start: '2026-10-17T10:00:00.000Z',
      venue: 'Jyväskylän kaupunginteatteri', address: 'Vapaudenkatu 36, Jyväskylä, Suomi',
    }),
    same: true,
  },
  {
    name: 'saman teatteriesityksen eri kellonajat ovat eri tapahtumia',
    a: raw({ source: 'jklteatteri', title: 'Aino A.', start: '2026-10-17T13:00:00+03:00', venue: 'Jyväskylän kaupunginteatteri' }),
    b: raw({ source: 'jklteatteri', title: 'Aino A.', start: '2026-10-17T18:00:00+03:00', venue: 'Jyväskylän kaupunginteatteri' }),
    same: false,
  },
```

Lisää `test/dedupe/merge.test.ts`-tiedoston `describe('mergeGroup', …)`-lohkoon:

```ts
  it('teatterin oma lähde voittaa kokoavan kalenterin, osoite täydentyy kalenterista', () => {
    const kse = raw({
      source: 'keskisuomievents', title: 'Aino A. -näytelmä Jyväskylän kaupunginteatterissa',
      start: '2026-10-17T10:00:00.000Z', venue: 'Jyväskylän kaupunginteatteri',
      address: 'Vapaudenkatu 36, Jyväskylä, Suomi', url: 'https://kse/2',
    });
    const th = raw({
      source: 'jklteatteri', title: 'Aino A.', start: '2026-10-17T13:00:00+03:00',
      venue: 'Jyväskylän kaupunginteatteri', url: 'https://th/1', ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
    });
    expect(mergeGroup([kse, th].map(normalizeEvent))).toMatchObject({
      title: 'Aino A.',
      url: 'https://th/1',
      ticketUrl: 'https://www.lippu.fi/eventseries/name-1',
      address: 'Vapaudenkatu 36, Jyväskylä, Suomi',
      sources: [
        { source: 'jklteatteri', url: 'https://th/1' },
        { source: 'keskisuomievents', url: 'https://kse/2' },
      ],
    });
  });
```

- [ ] **Step 2: Aja testit ja katso, mitkä epäonnistuvat**

Run: `npx vitest run test/dedupe`
Expected: merge-testi FAIL. `jklteatteri` ei vielä ole `SOURCE_PRIORITY`-listassa, joten `keskisuomievents` voittaa ja `title`/`url` ovat väärin. Tuplatapausten pitäisi mennä läpi jo nyt. Jos jokin niistä epäonnistuu, älä muuta tuplien tunnistuksen kynnysarvoja. Kirjaa asia raporttiin ja jatka.

- [ ] **Step 3: Rekisteröi lähteet ja päivitä etusija**

`src/sources/index.ts` kokonaisuudessaan:

```ts
import type { Source } from '../shared/types';
import { jelmu } from './jelmu';
import { jklteatteri } from './jklteatteri';
import { keikkalista } from './keikkalista';
import { keskisuomievents } from './keskisuomievents';
import { paviljonki } from './paviljonki';
import { peurunka } from './peurunka';

export const SOURCES: Source[] = [paviljonki, peurunka, jelmu, jklteatteri, keikkalista, keskisuomievents];
```

`src/dedupe/merge.ts` rivi 9:

```ts
export const SOURCE_PRIORITY = ['paviljonki', 'peurunka', 'jelmu', 'jklteatteri', 'keikkalista', 'keskisuomievents'];
```

- [ ] **Step 4: Päivitä README**

Korvaa `README.md`:n "## Lähteet" -osion kappale tällä:

```markdown
keskisuomievents.fi (sisältää kalenteri.jyvaskyla.fi:n ja visitjyvaskyla.fi:n tapahtumat), paviljonki.fi, peurunka.fi, jelmu.net (Lutakko ja Musta kynnys), jklteatteri.fi (kaupunginteatteri) ja keikkalista.fi.

Ei kerätä: menoinfo (robots.txt kieltää), meteli.net (estää botit), terassikesa.fi (ei rajapintaa), ilokivi.fi (ei tapahtumalistaa). Perustelut: `docs/superpowers/specs/2026-10-11-vaihe2a-lahteet-design.md`.
```

- [ ] **Step 5: Aja kaikki testit**

Run: `npm test && npm run typecheck`
Expected: PASS (kaikki testit; määrä on aiempi 169 + uudet)

- [ ] **Step 6: Oikea keruu ja tuplien tarkistus**

```bash
npm run scrape
node -e '
const f = JSON.parse(require("fs").readFileSync("public/events.json"));
const has = (e, s) => e.sources.some((x) => x.source === s);
console.log("lähteiden tila:", Object.fromEntries(Object.entries(f.sources).map(([k, v]) => [k, v.ok ?? v])));
console.log("jelmu:", f.events.filter((e) => has(e, "jelmu")).length, "joista yhdistetty KSE:hen:", f.events.filter((e) => has(e, "jelmu") && has(e, "keskisuomievents")).length);
console.log("jklteatteri:", f.events.filter((e) => has(e, "jklteatteri")).length, "joista yhdistetty KSE:hen:", f.events.filter((e) => has(e, "jklteatteri") && has(e, "keskisuomievents")).length);
const key = (e) => e.start.slice(0, 16) + "|" + (e.venue || "");
const th = f.events.filter((e) => /kaupunginteatteri|lutakko|musta kynnys/i.test(e.venue || ""));
const byKey = {};
for (const e of th) (byKey[e.start.slice(0, 10) + "|" + (/lutakko/i.test(e.venue) ? "lutakko" : /musta/i.test(e.venue) ? "musta" : "teatteri")] ??= []).push(e);
for (const [k, list] of Object.entries(byKey)) if (list.length > 1) console.log("MAHDOLLINEN TUPLA", k, list.map((e) => e.title + " @" + e.start + " [" + e.sources.map((s) => s.source) + "]").join("  ||  "));
'
```

Tarkista tuloste:
- `jelmu` ja `jklteatteri` ovat tilassa onnistuneina.
- Jelmun keikkoja on vähintään 20 ja teatterin esityksiä vähintään 30.
- Rivit "MAHDOLLINEN TUPLA" ovat joko aidosti eri tapahtumia (esim. eri esityksiä samana päivänä) tai tuplia.
- Kirjaa raporttiin jokainen todellinen tupla otsikoineen, esimerkiksi "Teatterikierrokset" vs. "Kurkistus kulisseihin -teatterikierros…". Tuplien tunnistuksen kynnysarvoja ei muuteta tässä vaiheessa; tuplat mainitaan PR:n kuvauksessa tunnettuina rajoituksina.

- [ ] **Step 7: Palauta keruun tuottamat datatiedostot**

Keruu ajetaan oikeasti GitHub Actionsissa. Siksi paikallisesti syntyneitä datamuutoksia ei commitoida:

```bash
git restore public/events.json data/raw
rm -f data/raw/jelmu.json data/raw/jklteatteri.json
git status --short
```

Expected: muutettuina vain tämän tehtävän lähdekoodi- ja testitiedostot sekä README.

- [ ] **Step 8: Commit**

```bash
git add src/sources/index.ts src/dedupe/merge.ts test/dedupe.cases.ts test/dedupe/merge.test.ts README.md
git commit -m "feat: Jelmu ja kaupunginteatteri keruuseen, paikkojen omat lähteet etusijalle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
