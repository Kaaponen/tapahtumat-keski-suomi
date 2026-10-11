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
