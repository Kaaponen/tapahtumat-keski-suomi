# Tapahtumat – suunnitelma (vaihe 2A: uudet lähteet)

Päivitetty: 2026-10-11

## Tavoite

Lisätään kaksi uutta lähdettä, joilla on siisti ja kerättävissä oleva data:

- **Jelmu** (jelmu.net): Lutakon ja Mustan kynnyksen keikat. Tällä hetkellä datassa on vain 2 Lutakon keikkaa, joten aukko on todellinen.
- **Jyväskylän kaupunginteatteri** (jklteatteri.fi): esitykset tulevat jo osin Keski-Suomen kalenterista (69 tapahtumaa). Oma lähde tuo kuitenkin teatterin oman lippulinkin ja varmistaa, että kaikki esityskerrat ovat mukana.

**Onnistumisen mittari:**
- Jelmun keikat näkyvät listassa oikealla kellonajalla ja paikalla.
- Teatterin esitykset eivät näy tuplina, vaan yhdistyvät Keski-Suomen kalenterin vastaaviin tapahtumiin.
- Mikään olemassa oleva testi ei rikkoudu.

Henkilökohtainen tilattava kalenterisyöte (vaihe 2B) ei kuulu tähän osaan.

## Lähteet

Tiedot on tarkistettu 2026-10-11.

### Jelmu – `jelmu`

- **Haku:** yksi HTML-haku `https://www.jelmu.net/` ("Tulevat keikat", 48 keikkaa, ei sivutusta). robots.txt sallii.
- **Rakenne:** WordPress + WooCommerce. Jokainen keikka on `li.product`, ja siinä on:
  - linkki `a.woocommerce-LoopProduct-link[href]` muotoa `https://www.jelmu.net/event/<slug>`
  - päivämäärä `p.datetime .date`, esimerkiksi "16.10." (ei vuotta)
  - nimi `h2.woocommerce-loop-product__title`, esimerkiksi "Saimaa (21:00)"
  - paikka `span.location` ("Lutakko" tai "Musta kynnys")
  - ikäraja `span.age` ("K18")
  - ovien aukeamisaika `span.doors` ("Ovet 19:00")
  - hinta `span.price`
  - kuva `img`
  - loppuunmyynti `p.out-of-stock` ("Loppuunmyyty!")
- **Muunnos RawEventiksi:**
  - `sourceId` on slug.
  - `title` on nimi, josta poistetaan lopun "(HH:MM)".
  - `start` on päivämäärä (vuosi päätellään, katso alla) ja ovien aukeamisaika. Jos sitä ei ole, käytetään nimen sulkeissa olevaa esiintymisaikaa, ja jos kumpaakaan ei ole, tapahtuma on koko päivän (`allDay`). Ovien aika on ensisijainen, koska Keski-Suomen kalenteri käyttää samoja keikkoja ovien ajalla: esimerkiksi Saimaa 16.10. on siellä klo 19.00 ja Jelmulla "(21:00)". Kahden tunnin ero ylittäisi tuplien tunnistuksen 90 minuutin rajan, ja sama keikka näkyisi kahdesti.
  - `venue` on paikan nimi sellaisenaan, `city` on "Jyväskylä" ja `address` jätetään tyhjäksi.
  - `url` ja `ticketUrl` ovat keikan oma sivu.
  - `image` on listan kuva.
  - `description` muodostetaan näistä " · "-erottimella: ikäraja, "Ovet HH:MM", "Keikka alkaa HH:MM" (nimen sulkeista), hinta ja "Loppuunmyyty" (vain ne, jotka löytyvät).
  - `categories` on `['keikat']`, joka vastaa Musiikki-kategoriaa.
- Rivit, joista puuttuu nimi, linkki tai jäsennettävä päivämäärä, ohitetaan.

### Kaupunginteatteri – `jklteatteri`

- **Haku:**
  - Ohjelmistosivu `https://www.jklteatteri.fi/kaupunginteatteri/ohjelmisto`.
  - Siitä kerätään esityslinkit `/kaupunginteatteri/ohjelmisto/<slug>` (nyt 9 kpl).
  - Jokainen esityssivu haetaan erikseen, eli noin 10 hakua per keruu.
- **Ohitettavat sivut:** `muut-tapahtumat` on koostesivu, jolla on useita eri tapahtumia yhden otsikon alla, joten sitä ei jäsennetä.
- **Esityssivu:**
  - Nimi: `og:title`, esimerkiksi "Aino A.". Etuliitteet "Vierailu:" ja "Yhteistyö:" poistetaan ("Vierailu: Luolamies" → "Luolamies").
  - Kuvaus: `og:description`
  - Kuva: `og:image`
  - Lippulinkki: ensimmäinen `https://www.lippu.fi/...`-linkki
- **Esityskerrat:** sisältö muunnetaan riveiksi (`<br>` ja `</p>` ovat rivinvaihtoja). Esityskerraksi tulkitaan rivi, joka alkaa viikonpäivällä ja jossa on päivämäärä ja kellonaika:
  - Esimerkkejä: "pe 25.9. klo 18.30 ennakkonäytös" ja "la 26.9.2026 klo 15".
  - Säännöllinen lauseke: `^(ma|ti|ke|to|pe|la|su) D.M.[YYYY] klo H[.MM]`.
  - Vuosi otetaan riviltä, jos se on siellä. Muuten se päätellään.
  - Rivit ilman viikonpäivää jätetään pois, esimerkiksi "Teosesittely 17.9. klo 13.00".
  - Samalla rivillä voi olla useita aikoja ("la 28.11. klo 13.00 ja klo 14.30"), ja jokaisesta tulee oma esityskerta.
  - Aikaväli ("ke 13.10. klo 10–12") antaa myös päättymisajan.
  - Rivin loppuosa ("ennakkonäytös", "TÄYNNÄ", "| suuri näyttämö") ei vaikuta tulkintaan.
  - Sama päivä ja aika kahdesti sivulla tuottaa vain yhden esityskerran.
- **Muunnos RawEventiksi:** yksi RawEvent per esityskerta.
  - `sourceId` on `<slug>-<YYYY-MM-DD>-<HHMM>`.
  - `venue` on "Jyväskylän kaupunginteatteri" ja `city` on "Jyväskylä".
  - `url` on esityssivu.
  - `categories` on `['teatteri']`.
- Jos yksittäisen esityssivun haku epäonnistuu, se kirjataan lokiin ja ohitetaan. Muiden esitysten tiedot tallennetaan normaalisti. Jos listasivun haku epäonnistuu, koko lähde epäonnistuu, ja varmuuskopio otetaan käyttöön tavalliseen tapaan.

## Yhteiset muutokset

- **`inferYear(m, d, today)`** tulee tiedostoon `src/shared/time.ts`.
  - Valitaan vuosista (edellinen, kuluva, seuraava) aikaisin, jolla päivämäärä on enintään 60 päivää menneisyydessä. Käytännössä: yli 60 päivää mennyt päivä tulkitaan ensi vuodelle, ja tammikuussa joulukuun loppu tulkitaan edelliselle vuodelle.
  - Esimerkki, kun tänään on 11.10.2026: "16.10." → 2026, "25.9." → 2026 ja "15.1." → 2027.
  - `today` annetaan parametrina testattavuuden vuoksi. Lähteet käyttävät nykyhetkeä Helsingin ajassa.
  - Menneet esityskerrat putoavat pois olemassa olevan `filterWindow`-suodatuksen kautta.
- **Lähteiden etusijajärjestys** (`SOURCE_PRIORITY`): `['paviljonki', 'peurunka', 'jelmu', 'jklteatteri', 'keikkalista', 'keskisuomievents']`.
  - Paikkojen omat sivut ovat ensin, joten niiden nimi, kellonaika ja lippulinkki voittavat yhdistettäessä.
- **`SOURCES`:** uudet lähteet lisätään listaan.
- **Paikka-avaimet:**
  - `kaupunginteatteri` ja `lutakko` ovat jo listassa.
  - "Musta kynnys" saa avaimen `musta kynnys` yleissäännön kautta, joten listaa ei tarvitse muuttaa.
- **README:** lähdetaulukkoon lisätään uudet lähteet ja kirjataan, miksi muut ehdokkaat jätettiin pois.

## Jätetään pois

| Lähde | Syy |
|---|---|
| Menoinfo | Selaimessa ajettava sovellus yksityisellä rajapinnalla. robots.txt kieltää tekoälybotit (myös ClaudeBot). |
| Meteli.net | Cloudflare estää botit (403). Estoa ei kierretä; ainoa reitti on pyytää Meteliltä lupaa tai rajapintaa. |
| Terassikesä | Selaimessa ajettava sovellus ilman löydettyä rajapintaa. Kesäsesongin terassiopas. |
| Ilokivi (soihtu.fi) | Ilokivi.fi ohjaa JYY:n liiketoimintasivulle, jolla ei ole tapahtumalistaa. |
| Jyväskylä Sinfonia, Poppari | Tapahtumat tulevat jo Keski-Suomen kalenterista. |

## Testaus

- **Testiaineisto:** kummastakin lähteestä tallennetaan oikea sivu kansioon `test/fixtures/<id>/`. Jelmulta tallennetaan etusivu. Teatterilta tallennetaan ohjelmistosivu ja kaksi esityssivua, joista toisessa on vuosi rivillä ja toisessa ei.
- **Yksikkötestit:**
  - `inferYear`: raja 60 päivää sekä vuodenvaihde molempiin suuntiin. Esimerkiksi tammikuussa "28.12." tulkitaan edelliselle vuodelle (mennyt esitys), ei 11 kuukauden päähän.
  - Jelmun jäsennin: kellonaika nimestä, ovien aukeamisaika varalla, loppuunmyyty, rivin ohitus.
  - Teatterin jäsennin: esityskerrat, rivi ilman viikonpäivää ohitetaan, vuosi rivillä, lippulinkki, `muut-tapahtumat` ohitetaan.
- **`fetch`-testit:** tehdään valetulla `FetchContext`illa samaan tapaan kuin olemassa olevissa lähteissä. Mukana tapaus, jossa yksi esityssivu epäonnistuu.
- **Oikea keruu:** lopuksi ajetaan `npm run scrape` ja tarkistetaan kaksi asiaa:
  - Jelmun keikkoja on kymmeniä.
  - Teatterin esitykset yhdistyvät Keski-Suomen kalenterin tapahtumiin (sama esitys samana päivänä ja aikana näkyy kerran, ja lähteinä on molemmat).
