# Tapahtumat – suunnitelma (projekti 1: tilit, henkilökohtainen etusivu ja kalenterisyöte)

Päivitetty: 2026-11-21

## Tausta ja tarkoitus

Tavoite on, että sovellusta käytetään laajasti. Koko Suomen tapahtumia kokoavaa palvelua ei näytä olevan olemassa: kaupungeilla on omat kalenterinsa, ja Menoinfo vaatii tapahtumien erillistä ilmoittamista eikä tarjoa henkilökohtaista syötettä. Käyttäjät ovat erilaisia, joten tapahtumia voi aina selata ilman tiliä. Kirjautunut käyttäjä saa palvelun muokattua itselleen: oman etusivun ja halutessaan kalenteriin tilattavan syötteen, joka päivittyy itsestään samaan tapaan kuin RSS.

Kokonaisuus jaettiin kolmeen projektiin, jotka tehdään tässä järjestyksessä:

1. **Tilit ja henkilökohtaisuus** (tämä dokumentti)
2. Koko Suomi: Linked Events -lukija ja paikkakuntavalinta
3. Käyttäjän omat lähteet (.ics ja schema.org)

Projekti 1 rakennetaan nykyisellä Keski-Suomen datalla, mutta paikkakunta on mukana alusta asti, jotta projekti 2 vain lisää valittavia paikkakuntia.

## Tavoitteet

- Kirjautuminen Applen ja Googlen kautta. Omia salasanoja ei ole.
- Kirjautunut käyttäjä tallentaa:
  - kotipaikkakunnan
  - suosikkikategoriat
  - seuratut paikat (esim. Lutakko)
  - tähdellä merkityt tapahtumat
- Henkilökohtainen etusivu näiden perusteella.
- Henkilökohtainen kalenterisyöte (.ics-osoite), jonka kalenterisovellus (Apple, Google, Outlook) hakee itse uudelleen:
  - tähdellä merkityt tapahtumat ovat aina mukana
  - seuratuista paikoista käyttäjä valitsee paikka kerrallaan, tuleeko paikan koko ohjelma kalenteriin (oletuksena ei)
  - kategoriat eivät tule syötteeseen, vain etusivulle
- Tapahtuman tunniste pysyy samana, vaikka järjestäjä muuttaa kellonaikaa, nimeä tai paikkaa.

**Onnistumisen mittari:**

- Ilman tiliä sovellus toimii kuten nyt.
- Kirjautunut käyttäjä näkee tähtensä ja seuraamansa paikat toisella laitteella kirjautumisen jälkeen.
- Kun tähdellä merkityn tapahtuman kellonaika muuttuu lähteessä, muutos näkyy käyttäjän kalenterissa seuraavan päivityksen jälkeen, eikä tapahtuma katoa tai tuplaannu.

## Ei kuulu tähän projektiin

- Muiden paikkakuntien tapahtumalähteet (projekti 2)
- Käyttäjän omat lähteet (projekti 3)
- Natiivisovellukset, push-ilmoitukset ja sähköpostit

## Mitä ei saa tapahtua (vaikka kaikki muuten toimisi)

- Selaaminen vaatii kirjautumisen.
- Kalenteriin ilmestyy tapahtumia, joita käyttäjä ei ole pyytänyt. Oletuksena syötteessä on vain tähdet.
- Syötteen osoite riippuu Supabasen verkkotunnuksesta. Palveluntarjoajan vaihto ei saa katkaista kenenkään tilausta.
- VPS:llä on käyttäjien henkilötietoja tai avain, jolla niitä voi lukea.

## Lähtötilanne

- Käyttöliittymä on Preact + Vite (`src/web/`) ja julkaistaan GitHub Pagesiin. PWA ja service worker ovat käytössä (`public/sw.js`).
- GitHub Actions kerää tapahtumat kolmesti vuorokaudessa tiedostoon `public/events.json`.
- Laitteelle tallennetaan nyt vain kalenterivalinta (`src/web/logic/prefs.ts`). Tähtiä tai tilejä ei ole.
- Tapahtuman tunniste lasketaan nimestä, päivästä, kellonajasta ja paikasta (`stableId`, `src/dedupe/merge.ts:16`). Se muuttuu, kun mikä tahansa näistä muuttuu.
- Yksittäisen tapahtuman .ics on jo olemassa (`src/web/calendar/ics.ts`). Siinä `UID` on tapahtuman tunniste, joten tunnisteen vaihtuminen näkyy kalenterissa poistona ja uutena tapahtumana.
- Paikka tunnistetaan nimellä: `mainVenue` (`src/web/logic/filters.ts:58`) ottaa paikan nimestä osan ennen " – "-erotinta.
- Käyttäjällä on Hostingerilla VPS, jolla pyörii myös Valheim-pelipalvelin.

## Toteutustavat, joita harkittiin

| Vaihtoehto | Plussat | Miinukset |
|---|---|---|
| **Supabase** (valittu) | Apple- ja Google-kirjautuminen valmiina, Postgres, rivitason suojaus (RLS), EU-alue. Ilmaistaso riittää alkuun. | Ilmaisprojekti voi mennä tauolle hiljaisina aikoina. Oma verkkotunnus vaatii maksullisen tason ja lisäosan. |
| Cloudflare Workers + D1 | Erittäin halpa ja nopea. | Kirjautuminen, erityisesti Apple, pitäisi rakentaa ja ylläpitää itse. |
| Firebase | Kirjautuminen helppo. | Funktiot vaativat käytön mukaan laskuttavan tason, tietokanta ei ole relaatiokanta, vahva sidos Googleen. |

Supabase valittiin, koska se poistaa työläimmän ja riskialtteimman osan (kirjautumisen) ja tietomalli on luonnostaan relaatiomallinen. Syötteen osoiteriski ratkaistaan ajamalla syötepalvelu omalla VPS:llä omassa verkkotunnuksessa.

## Ratkaisut

### Arkkitehtuuri

```
Selain (GitHub Pages, <nimi>.fi)
  ├─ events.json (staattinen, kuten nyt)
  └─ Supabase: kirjautuminen + käyttäjän valinnat (RLS)

Kalenterisovellus → https://syote.<nimi>.fi/<token>.ics
  └─ VPS: syötepalvelu (Docker) Caddyn takana
       ├─ hakee events.json:n sivustolta (välimuisti)
       └─ kutsuu Supabasesta funktiota feed_for_token(token)
```

### Verkkotunnus

- Hankitaan Hostingerista. Palvelun nimi valitaan vapaiden verkkotunnusten mukaan. Ei vielä päätetty, joten tässä dokumentissa käytetään paikkamerkkiä `<nimi>.fi`.
- Sivu siirretään GitHub Pagesissa omaan verkkotunnukseen (CNAME). GitHub ohjaa vanhan osoitteen uuteen.
- Syöte palvelee osoitteessa `syote.<nimi>.fi`.
- Verkkotunnus otetaan käyttöön ennen kuin syöte julkaistaan kenellekään.

### Kirjautuminen

- Supabase Auth, palveluntarjoajina Apple ja Google. Molemmat alusta asti, koska App Store vaatii Apple-kirjautumisen, jos Google-kirjautuminen on tarjolla.
- Applen kehittäjätili (99 $/v) ja Googlen OAuth-asetukset tehdään käyttäjän omilla tunnuksilla, jotta palvelun voi myöhemmin vaihtaa ilman, että käyttäjien tunnisteet katoavat.
- Supabase-projekti EU-alueelle.

### Tietomalli (Supabase, Postgres)

- `profiles`: `user_id` (viittaa `auth.users`), `home_city`, `feed_token` (satunnainen, vähintään 128 bittiä, uniikki), `created_at`
- `favorite_categories`: `user_id`, `category`
- `followed_venues`: `user_id`, `venue` (`mainVenue`-muotoinen nimi), `in_calendar` (oletus `false`)

Paikka tunnistetaan tässä projektissa vain nimen perusteella. Tapahtumat, joilla ei ole paikan nimeä (nyt 1 301 / 1 871, pääosin keskisuomievents, joka antaa vain osoitteen), eivät tule seurannan kautta. Paikkojen tunnistus osoitteesta ja nimien yhtenäistäminen tehdään projektissa 2, koska koko Suomen data tarvitsee sitä joka tapauksessa.
- `starred_events`: `user_id`, `event_id`, `starred_at`

Jokaisessa taulussa RLS: käyttäjä lukee ja kirjoittaa vain omia rivejään.

`feed_for_token(token)` on `security definer` -funktio, joka palauttaa vain kyseisen syötteen tähdet (`event_id`-lista) ja kalenteriin valitut paikat (`venue`-lista). Ei nimiä, sähköposteja tai muuta. Koska token on itse salaisuus, funktion saa kutsua julkisella anon-avaimella. Näin VPS:lle ei tarvita mitään salaista avainta.

### Pysyvä tapahtumatunniste

Tunniste ei saa enää riippua nimestä, ajasta tai paikasta. Periaate: tapahtuma säilyttää tunnisteensa niin kauan kuin yksikin sen lähdeavaimista säilyy. Lähdeavain on lähde + lähteen oma tunniste (`source` + `sourceId`).

- Keruu ylläpitää repossa tiedostoa (esim. `data/ids.json`), joka kertoo lähdeavaimelle sen tunnisteen.
- Kun tuplat on yhdistetty, ryhmä saa ensimmäisen lähdeavaimiensa joukosta löytyvän vanhan tunnisteen. Uusi tunniste luodaan vain, jos yhtäkään ei löydy.
- **Toistuvat tapahtumat:** jos lähde käyttää samaa `sourceId`:tä usealle päivälle, päivä lisätään lähdeavaimeen. Muuten yhden päivän tähti merkitsisi kaikki päivät. (Oma ratkaisuni.)
- **Kaupunginteatteri:** `jklteatteri`-lähteen `sourceId` muodostetaan jatkossa nimestä ja päivästä ilman kellonaikaa. Tunniste säilyy, kun kellonaika muuttuu samana päivänä. Päivän siirtyessä esitys saa uuden tunnisteen, ellei se ole yhdistetty Keski-Suomen kalenterin tapahtumaan, jonka avain säilyy. Erillistä sumeaa jatkuvuushakua ei tehdä. (Oma ratkaisuni.)
- **Yhdistyminen ja jakautuminen:** kun kaksi tunnisteellista tapahtumaa yhdistyy, hävinnyt tunniste jää aliakseksi, joka osoittaa säilyneeseen. Käyttöliittymä ja syötepalvelu ratkaisevat tähdet aliasten kautta, joten tähti ei katoa. Jos ryhmä jakautuu, vanha tunniste jää sille osalle, jolla on ensisijaisin lähde (`SOURCE_PRIORITY`), ja toinen saa uuden. (Oma ratkaisuni.)
- Nykyiset tunnisteet otetaan käyttöön lähtöarvoina, jotta jo olemassa olevat .ics-lataukset eivät muutu.

### Menneet tapahtumat

Tapahtuma pysyy kalenterisyötteessä 30 päivää sen jälkeen, kun se on päättynyt. Kalenterista näkee, missä on käynyt. Koska `events.json` ei sisällä menneitä tapahtumia (`src/scrape/run.ts` poistaa ne), keruu tallentaa viimeisen 30 päivän menneet tapahtumat erilliseen tiedostoon (esim. `public/recent-past.json`). Syötepalvelu lukee molemmat tiedostot. Käyttöliittymä ei näytä menneitä tapahtumia.

Tapahtuma, joka katoaa lähteestä ennen alkamistaan (todennäköisesti peruttu), putoaa syötteestä heti.

### Käyttöliittymä

- **Ilman tiliä:** kuten nyt. Lisäksi tähden voi merkitä myös ilman tiliä, ja se tallennetaan laitteelle (localStorage). Kirjautuessa laitteen tähdet yhdistetään tilin tähtiin. (Oma ratkaisuni: madaltaa kynnystä, eikä kirjautumisen jälkeen menetetä mitään.)
- **Kirjautuneena:** näkymässä on kaksi välilehteä: "Sinulle" (oletus) ja "Kaikki". "Sinulle" näyttää kotipaikkakunnalta tähdet, seuratut paikat ja suosikkikategoriat, ja lisäksi seurattujen paikkojen tapahtumat, vaikka ne olisivat muualla. (Oma ratkaisuni.)
- **Matkalla:** paikkakunnan voi vaihtaa hetkeksi suodattimesta (näkyy osoitteessa kuten muutkin suodattimet), eikä kotipaikkakunta muutu.
- **Tähti ja seuraaminen:** tähti tapahtumakortissa ja tapahtuman tiedoissa. Paikan voi seurata tapahtuman tiedoista.
- **Asetukset:** kotipaikkakunta, kategoriat, seuratut paikat ja kunkin kohdalla valinta "näytä kalenterissa", syötteen osoite kopioitavaksi sekä tilausohjeet (Apple, Google, Outlook). Lisäksi "luo uusi syöteosoite", joka mitätöi vanhan, ja "poista tili", joka poistaa kaikki tiedot.
- Supabase-kutsut kootaan yhteen moduuliin (esim. `src/web/account/`), jotta palveluntarjoajan vaihto koskee vain sitä.

### Syötepalvelu (VPS)

- TypeScript (Node), samassa repossa (esim. `src/feed/`). Käyttää samaa .ics-koodia kuin käyttöliittymä (`src/web/calendar/`), joka laajennetaan tuottamaan useita tapahtumia yhteen kalenteriin.
- Pyyntö `GET /<token>.ics`:
  1. Kutsuu `feed_for_token`. Tuntematon token palauttaa 404.
  2. Valitsee tapahtumat `events.json`:sta: tähdet sekä kalenteriin valittujen paikkojen tapahtumat.
  3. Palauttaa `text/calendar`-vastauksen.
- `events.json` haetaan sivustolta ja pidetään muistissa muutaman minuutin.
- Tulevat tapahtumat luetaan `events.json`:sta ja viimeisen 30 päivän menneet `recent-past.json`:sta (katso "Menneet tapahtumat").
- Jos Supabase ei vastaa (esim. ilmaisprojekti tauolla), palautetaan virhe eikä tyhjää kalenteria, jotta kalenteri ei poista käyttäjän tapahtumia.
- Ajo Docker-kontissa. Edessä Caddy, joka hoitaa HTTPS-varmenteen automaattisesti. Palomuuri sallii vain SSH:n, 80/443:n ja Valheimin portit. Kontti ei tarvitse pääsyä Valheimin tiedostoihin.

### Tietosuoja

- Tietosuojaseloste sivulle: mitä tallennetaan (kirjautumistunniste, sähköposti Applelta tai Googlelta, valinnat), missä (Supabase, EU) ja miten tili poistetaan.
- Tilin poisto poistaa käyttäjän ja kaikki hänen rivinsä.

## Rakentajan päätettävät

- Tarkat taulujen ja sarakkeiden nimet, indeksit ja migraatioiden työkalu.
- Tilin poiston toteutus (esim. Supabasen funktio, jota käyttäjä kutsuu omalla istunnollaan; VPS:ää ei tarvita).
- Miten "Sinulle"-näkymä yhdistää säännöt ja järjestää tapahtumat.
- Välimuistin kesto syötepalvelussa ja `Cache-Control`-otsakkeet.
- Kirjautumisnapin ja "Sinulle"-näkymän tarkka ulkoasu nykyisen tyylin mukaisesti.
- Caddyn ja Dockerin asetusten yksityiskohdat. Tarkista ensin, mitä VPS:llä jo pyörii (esim. olemassa oleva web-palvelin porteissa 80/443).
- Testit: vähintään tunnisteen pysyvyys (aika, nimi ja paikka muuttuvat; toistuva tapahtuma; yhdistyminen ja jakautuminen), syötteen tapahtumavalinta menneineen ja usean tapahtuman .ics.

## Avoimet asiat ennen rakentamista

- Palvelun nimi ja verkkotunnus.
- Applen kehittäjätilin hankinta.
