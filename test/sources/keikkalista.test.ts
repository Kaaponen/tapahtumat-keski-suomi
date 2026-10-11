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
