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
  {
    name: 'Yleinen nimi (Isänpäivälounas), eri osoitteet ja kaupungit',
    a: raw({ title: 'Isänpäivälounas', start: '2026-11-08T12:00:00+02:00', venue: 'Jyväskylä', address: 'Hannikaisenkatu 39, Jyväskylä' }),
    b: raw({ source: 'peurunka', title: 'Isänpäivälounas', start: '2026-11-08T12:00:00+02:00', venue: 'Peurunka – Ravintola', address: 'Peurungantie 85 Laukaa' }),
    same: false,
  },
  {
    name: 'Yleinen nimi, kaksi eri ravintolaa samassa kaupungissa',
    a: raw({ title: 'Isänpäivälounas', start: '2026-11-08T12:00:00+02:00', venue: 'Jyväskylä', address: 'Hannikaisenkatu 39, Jyväskylä' }),
    b: raw({ title: 'Isänpäivälounas Savutuvan Apajalla', start: '2026-11-08T12:30:00+02:00', venue: 'Jyväskylä', address: 'Opinsaunankiuas 1, Jyväskylä, Suomi' }),
    same: false,
  },
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
  {
    name: 'teatterikierros = Keski-Suomen kalenterin pitkä otsikko',
    a: raw({ source: 'jklteatteri', title: 'Kurkistus kulisseihin -teatterikierros', start: '2026-10-19T18:00:00+03:00', venue: 'Jyväskylän kaupunginteatteri' }),
    b: raw({
      title: 'Kurkistus kulisseihin -teatterikierros Jyväskylän kaupunginteatterissa', start: '2026-10-19T15:00:00.000Z',
      venue: 'Jyväskylän kaupunginteatteri', address: 'Vapaudenkatu 36, Jyväskylä, Suomi',
    }),
    same: true,
  },
];
