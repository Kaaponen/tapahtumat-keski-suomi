# Tapahtumat – suunnitelma (vaihe 1)

Päivitetty: 2026-10-11

## Tavoite

Web-sovellus, joka kokoaa Jyväskylän seudun tapahtumat useista lähteistä yhteen listaan ilman tuplia. Käyttäjä selaa listaa ja lisää haluamansa tapahtumat omaan kalenteriinsa (Google, Outlook tai Apple/muu .ics).

- **Käyttäjät:** aluksi omaan käyttöön, myöhemmin mahdollisesti julkinen. Ei kirjautumista vaiheessa 1.
- **Onnistumisen mittari:** käyttäjä löytää viikon tapahtumat yhdestä paikasta, sama tapahtuma näkyy vain kerran, ja kalenteriin lisääminen onnistuu yhdellä tai kahdella napautuksella.

### Rajaus

Vaiheeseen 1 kuuluu:
- Lähteet: keskisuomievents.fi (kattaa myös kalenteri.jyvaskyla.fi), visitjyvaskyla.fi, paviljonki.fi, peurunka.fi, keikkalista.fi
- Ajastettu keruu, tuplien yhdistäminen, staattinen web-sivu, kalenteriin lisääminen tapahtuma kerrallaan

Vaiheeseen 1 eivät kuulu:
- Käyttäjätilit ja tilattava henkilökohtainen kalenterisyöte (vaihe 2)
- Lähteet meteli.net (estää automaattiset haut, 403), keski-suomi.menoinfo.fi, jklteatteri.fi, terassikesa.fi (lisätään myöhemmin yksi kerrallaan)
- Karttanäkymä

## Lähteet

Tiedot on tarkistettu 2026-10-11.

| Lähde | Tapa | Huomiot |
|---|---|---|
| keskisuomievents.fi | JSON-rajapinta `https://keskisuomievents.fi/api/v1/event?page=N&page_size=…&include=location,area&start=today&super_event_type=umbrella,none` | Linked Events -tyyppinen rajapinta, noin 2 160 tapahtumaa. Kentät `start_time`, `end_time`, `name`, `location`, `keywords`, `images`, `offers`. Sivutus `meta.next`-kentän kautta. kalenteri.jyvaskyla.fi käyttää samaa rajapintaa, joten sitä ei kerätä erikseen. |
| visitjyvaskyla.fi | WordPress REST `/wp-json/wp/v2/events` + tapahtumasivun HTML | Noin 1 590 tapahtumaa. `acf` on tyhjä, joten päivämäärät ja paikka luetaan tapahtumasivulta (`link`). Haetaan vain sivut, joita ei ole jo välimuistissa (`modified` muuttunut). |
| paviljonki.fi | WordPress REST `/wp-json/wp/v2/tapahtuma` + tapahtumasivun HTML | Noin 348 tapahtumaa, sama periaate kuin visitjyvaskylässä. Paikka on aina Paviljonki. |
| peurunka.fi | REST `/wp-json/events/v2/upcoming` | Paikka on aina Peurunka (Laukaa). |
| keikkalista.fi | `https://www.keikkalista.fi/jyvaskyla`, sivuun upotettu schema.org/Event JSON-LD | Noin 30 keikkaa. |

Kenttien tarkka muoto tarkistetaan toteutuksen aikana, ja jokaisesta lähteestä tallennetaan esimerkkivastaus testejä varten.

## Rakenne

```
GitHub Actions (cron, esim. 3×/vrk)
  └─ keruuskripti (Node + TypeScript)
       ├─ src/sources/<lähde>.ts  →  RawEvent[]
       ├─ normalisointi          →  NormalizedEvent[]
       ├─ tuplien yhdistäminen   →  Event[]
       └─ kirjoittaa public/events.json, commit repoon
  └─ build (Vite + Preact) → GitHub Pages
```

- **Kieli:** TypeScript kaikkialla. Tyypit `src/shared/types.ts` ovat yhteisiä keruulle ja käyttöliittymälle.
- **Riippuvuudet:** Noden oma `fetch`, `cheerio` HTML:n lukemiseen, `vitest` testeihin, Vite + Preact käyttöliittymään. Aikavyöhykkeiden käsittelyyn kevyt kirjasto (esim. `date-fns-tz`) tai `Intl`.
- **Kohtelias keruu:** oma User-Agent-tunniste, jossa on projektin repositorion URL, noin 500 ms tauko pyyntöjen välissä samaan palvelimeen, keruu enintään 3 kertaa vuorokaudessa.

### Lähdemoduulin rajapinta

```ts
interface Source {
  id: string;            // esim. "paviljonki"
  name: string;          // näyttönimi
  fetch(ctx: FetchContext): Promise<RawEvent[]>;
}

interface RawEvent {
  source: string;
  sourceId: string;      // lähteen oma tunniste tai URL
  title: string;
  start: string;         // ISO 8601, aikavyöhykkeen kanssa
  end?: string;
  allDay?: boolean;
  venue?: string;
  address?: string;
  city?: string;
  url: string;           // tapahtuman sivu lähteessä
  ticketUrl?: string;
  image?: string;
  description?: string;  // pelkkä teksti, lyhennetty
  categories?: string[];
}
```

`FetchContext` tarjoaa kohteliaan `fetch`-kääreen ja edellisen ajon välimuistin. Lähteet eivät tiedä toisistaan mitään.

## Tuplien yhdistäminen

1. **Normalisointi**
   - Nimi: pienet kirjaimet, diakriitit säilyvät (ä/ö), välimerkit ja ylimääräiset välilyönnit pois. Poistetaan tunnetut lisäosat, kuten "loppuunmyyty", "(k18)", "jyväskylä" ja "/ <paikka>".
   - Paikka: sanakirja `src/dedupe/venues.ts`, joka muuttaa eri kirjoitusasut samaksi avaimeksi (esim. "Jyväskylän Paviljonki", "Paviljonki, Sali A" → `paviljonki`). Tuntematon paikka normalisoidaan pelkkänä tekstinä.
   - Aika: muunnetaan aikavyöhykkeeseen Europe/Helsinki. Päiväavaimena käytetään paikallista päivämäärää.
2. **Vertailu** vain saman päiväavaimen tapahtumien kesken. Kaksi tapahtumaa ovat sama tapahtuma, jos
   - paikka-avaimet ovat samat tai toinen niistä puuttuu, **ja**
   - nimien samankaltaisuus (token set ratio) ≥ 0,85 **tai** toisen normalisoitu nimi sisältää toisen kokonaan (vähintään 4 merkkiä), **ja**
   - jos molemmilla on kellonaika, alkamisajat eroavat enintään 90 minuuttia.

   Raja-arvot ovat lähtöarvoja, ja niitä säädetään testiaineiston avulla.
3. **Ryhmittely:** yhdistetään tapahtumat union-find-rakenteella, jolloin jos A=B ja B=C, kaikki kolme ovat samaa tapahtumaa.
4. **Yhdistäminen:** jokainen kenttä valitaan parhaasta lähteestä.
   - Kellonaika: tarkin (kellonaika voittaa koko päivän tapahtuman).
   - Kuvaus: pisin.
   - Kuva: ensimmäinen saatavilla oleva lähteiden etusijajärjestyksessä.
   - Lipunmyyntilinkki ja ensisijainen URL: tapahtumapaikan oma sivu (paviljonki, peurunka) ennen kokoavia sivustoja.
   - `sources`: lista `{ source, url }` kaikista yhdistetyistä lähteistä.
5. **Pysyvä tunniste:** `id = hash(normalisoitu nimi + päiväavain + paikka-avain)`. Käytetään .ics-tiedoston UID-kenttänä ja vaiheessa 2.
6. **Toistuvat esitykset** säilyvät erillisinä tapahtumina. Käyttöliittymä ryhmittelee saman nimen ja paikan tapahtumat näkymään yhtenä rivinä ("Esitykset 12.10.–30.11.").

## Tietomuoto: `events.json`

```json
{
  "generatedAt": "2026-10-11T06:00:00+03:00",
  "sources": {
    "paviljonki": { "name": "Paviljonki", "lastSuccess": "…", "lastError": null, "consecutiveFailures": 0, "count": 120 }
  },
  "events": [
    {
      "id": "a1b2c3…",
      "title": "…",
      "start": "…", "end": "…", "allDay": false,
      "venue": "Paviljonki", "address": "…", "city": "Jyväskylä",
      "url": "…", "ticketUrl": "…", "image": "…", "description": "…",
      "categories": ["musiikki"],
      "sources": [{ "source": "paviljonki", "url": "…" }, { "source": "keikkalista", "url": "…" }]
    }
  ]
}
```

Menneet tapahtumat poistetaan. Tiedostoon otetaan tapahtumat noin 6 kuukauden päähän, jotta tiedoston koko pysyy kohtuullisena. Raja tarkistetaan toteutuksen aikana.

Lisäksi `data/raw/<lähde>.json` tallentaa jokaisen lähteen edellisen onnistuneen tuloksen varmuuskopioksi.

## Käyttöliittymä

**Lista (pääsivu, suunniteltu ensin puhelimelle)**
- Tapahtumat aikajärjestyksessä, ryhmiteltyinä päivittäin ("Tänään", "Huomenna", "La 18.10.").
- Kortissa on kuva, nimi, kellonaika, paikka, kategoria, lähdemerkit sekä **📅-pikapainike**:
  - Jos käyttäjä on jo valinnut kalenterinsa, yksi napautus lisää tapahtuman siihen.
  - Muuten painike avaa kalenterivalikon, ja valinta muistetaan.
  - Painikkeen napautus ei avaa tapahtuman tietoja.
- Suodattimet: aikaväli (tänään / viikonloppu / tämä viikko / valitut päivät), kategoria, paikka ja vapaa tekstihaku. Suodattimet tallentuvat sivun osoitteeseen, joten näkymän voi jakaa linkkinä.

**Tapahtuman tiedot** (kortin napautus): kuvaus, osoite, linkit kaikkiin lähteisiin, lipunmyyntilinkki ja **"Lisää kalenteriin ▾"** -valikko, jossa on myös vaihtoehto vaihtaa muistettua kalenteria.

**Kalenteriin lisääminen** (kaikki tehdään selaimessa):
- Google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…`
- Outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=…&startdt=…&enddt=…&body=…&location=…`
- Apple / muu: `.ics`-tiedosto (`VEVENT`, UID = tapahtuman `id`), ladataan Blob-objektina.
- Jos lopetusaikaa ei ole, käytetään oletuksena 2 tunnin kestoa. Koko päivän tapahtumat lisätään päivämäärämuotoisina.
- Valittu kalenteri tallennetaan selaimen `localStorage`-muistiin.

**Alalaita:** lähteiden tila, esimerkiksi "Peurunka päivitetty viimeksi 2 pv sitten".

## Virhetilanteet

- Jokainen lähde ajetaan erikseen (`try/catch`). Epäonnistuneen lähteen kohdalla käytetään `data/raw/<lähde>.json`-tiedoston tietoja, ja lähteen tila päivitetään.
- Jos lähde palauttaa 0 tapahtumaa, tulos tulkitaan virheeksi, kun edellisellä kerralla tapahtumia oli enemmän kuin 5.
- Kun `consecutiveFailures` on 3 tai enemmän, työnkulku avaa GitHubiin ilmoituksen (issue), jos lähteelle ei ole jo avointa ilmoitusta.
- Yksittäinen tapahtuma, jota ei saa jäsennettyä (esim. puuttuva päivämäärä), ohitetaan ja kirjataan lokiin. Se ei kaada koko lähdettä.

## Testaus

- **Lähteet:** jokaisesta lähteestä tallennetaan esimerkkivastaukset hakemistoon `test/fixtures/<lähde>/`. Jäsentimet testataan ilman verkkoyhteyttä.
- **Tuplien yhdistäminen:** taulukko oikeista tapahtumapareista (tuplat ja vain samankaltaiset) tiedostossa `test/dedupe.cases.ts`. Testit tarkistavat, että tunnistus on oikein molempiin suuntiin.
- **Kalenteri:** yksikkötestit Google- ja Outlook-linkkien muodolle sekä .ics-tiedoston rakenteelle (rivinvaihdot, erikoismerkkien escapointi, aikavyöhyke).
- **Työnkulku:** CI ajaa testit ja buildin jokaisella pushilla.

## Hakemistorakenne

```
src/
  shared/types.ts
  sources/{keskisuomievents,visitjyvaskyla,paviljonki,peurunka,keikkalista}.ts
  sources/index.ts
  scrape/{run.ts,http.ts,status.ts}
  dedupe/{normalize.ts,venues.ts,match.ts,merge.ts}
  web/  (Vite + Preact: App, EventList, EventCard, EventDetail, Filters, calendar/{google,outlook,ics}.ts)
data/raw/
public/events.json
test/
.github/workflows/{scrape.yml,deploy.yml,ci.yml}
```

## Vaihe 2 (ei toteuteta nyt)

- Tähdellä merkityt tapahtumat → henkilökohtainen tilattava `.ics`-syöte (salainen linkki). Vaatii pienen taustapalvelun tai tietokannan.
- Uudet lähteet: menoinfo (eventz.today-rajapinta), jklteatteri (HTML), terassikesa (rajapinta selvitettävä), meteli (vaatii selaimen tai luvan).
