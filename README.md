# Tapahtumat

Jyväskylän seudun tapahtumat yhdessä listassa ilman tuplia. Tapahtuman voi lisätä Google-, Outlook- tai Apple-kalenteriin.

## Asentaminen sovellukseksi

Sivu on asennettava web-sovellus (PWA), joka toimii myös ilman verkkoa viimeksi haetuilla tiedoilla.

- iPhone/iPad: Safari → Jaa → Lisää Koti-valikkoon
- Android: Chrome → valikko → Asenna sovellus
- Mac: Safari → Arkisto → Lisää Dockiin, tai Chrome → osoiterivin asennuskuvake

Toteutus: `public/manifest.webmanifest`, `public/sw.js` ja kuvakkeet hakemistossa `public/icons/`.

## Lähteet

keskisuomievents.fi (sisältää kalenteri.jyvaskyla.fi:n ja visitjyvaskyla.fi:n tapahtumat), paviljonki.fi, peurunka.fi, jelmu.net (Lutakko ja Musta kynnys), jklteatteri.fi (kaupunginteatteri) ja keikkalista.fi.

Ei kerätä: menoinfo (robots.txt kieltää), meteli.net (estää botit), terassikesa.fi (ei rajapintaa), ilokivi.fi (ei tapahtumalistaa). Perustelut: `docs/superpowers/specs/2026-10-11-vaihe2a-lahteet-design.md`.

## Kehitys

```bash
npm install
npm run scrape   # hakee tapahtumat -> public/events.json
npm run dev      # käyttöliittymä osoitteessa http://localhost:5173
npm test
```

## Tilit ja syöte

Kirjautuminen (Apple/Google), seuratut paikat ja henkilökohtainen kalenterisyöte käyttävät Supabasea. Tilitoiminnot näkyvät sovelluksessa vain, kun web-buildille on annettu kolme muuttujaa. Ilman niitä sivu toimii kuten ennen.

GitHubissa: Settings > Secrets and variables > Actions > Variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `FEED_BASE_URL` (syötepalvelun osoite, esim. `https://syote.example.fi`)

Workflow välittää ne build-vaiheelle nimillä `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ja `VITE_FEED_BASE_URL`. Paikallisesti samat `VITE_`-muuttujat voi antaa `npm run dev`- tai `npm run build` -komennolle.

### Tietokanta

Skeema on hakemistossa `supabase/migrations/`. Supabase CLI:tä ei asenneta riippuvuudeksi; aja se `npx`:llä:

```bash
npx supabase@latest link --project-ref <projektin-tunnus>
npx supabase@latest db push
```

Migraation testit (PGlite, ei vaadi Supabasea): `npm run db:test`.

## Syötepalvelun julkaisu

Syötepalvelu (`npm run feed`, `src/feed/server.ts`) ajetaan VPS:llä Dockerilla. Tiedostot ovat hakemistossa `deploy/feed/`: `Dockerfile`, `docker-compose.yml` (palvelut `feed` ja `caddy`), `Caddyfile` ja `.env.example`. Syöte kuuntelee porttia 8787 vain Dockerin sisäverkossa, ja Caddy hoitaa HTTPS:n (Let's Encrypt).

### 1. Tarkista VPS ennen mitään asennusta

VPS:llä pyörii myös Valheim-palvelin. Selvitä ensin, mitä porteissa jo kuunnellaan:

```bash
sudo ss -tlnp   # TCP: onko 80/443 jo käytössä?
sudo ss -ulnp   # UDP: Valheimin portit
```

Valheim käyttää tyypillisesti UDP-portteja 2456-2458 (tarkista omasta asetuksestasi).

Jos jokin web-palvelin (nginx, Apache, oma Caddy) pitää jo portteja 80/443, älä aja tämän repon Caddya. Poista `caddy`-palvelu `docker-compose.yml`:stä, julkaise `feed` esim. `127.0.0.1:8787:8787` ja lisää vanhaan web-palvelimeen reverse proxy osoitteesta `FEED_DOMAIN` kohteeseen `127.0.0.1:8787`.

### 2. Palomuuri

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 2456:2458/udp   # Valheim, muuta tarvittaessa
sudo ufw enable
sudo ufw status
```

Portti 8787 ei saa olla avoinna ulospäin.

### 3. DNS

Lisää verkkotunnukselle (esim. `syote.example.fi`) A-tietue VPS:n IP-osoitteeseen. Caddy hakee varmenteen vasta kun tietue osoittaa oikein.

### 4. Käynnistys

```bash
cd deploy/feed
cp .env.example .env   # täytä SUPABASE_URL, SUPABASE_ANON_KEY, EVENTS_BASE_URL, FEED_DOMAIN
docker compose up -d --build
curl https://$FEED_DOMAIN/health   # -> ok
```

Päivitys: `cd deploy/feed && git pull && docker compose up -d --build`. Lokit: `docker compose logs -f feed`.

## Uuden lähteen lisääminen

1. Luo `src/sources/<id>.ts`, joka toteuttaa `Source`-rajapinnan ja palauttaa `RawEvent[]`.
2. Tallenna oikea vastaus hakemistoon `test/fixtures/<id>/` ja kirjoita testit.
3. Lisää lähde `SOURCES`-listaan (`src/sources/index.ts`) ja tarvittaessa `SOURCE_PRIORITY`-listaan (`src/dedupe/merge.ts`).

Suunnitelma: `docs/superpowers/specs/2026-10-11-tapahtumat-design.md`
