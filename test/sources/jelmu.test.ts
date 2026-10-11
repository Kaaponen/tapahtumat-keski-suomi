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

  it('usean esiintyjän otsikko: nimet pilkulla, esiintymisaika pääesiintyjältä', () => {
    const html = item(`<a href="https://www.jelmu.net/event/vilkkumaa" class="woocommerce-LoopProduct-link">
      <p class="datetime"><span>la</span><span class="date">7.11.</span></p>
      <div><h2 class="woocommerce-loop-product__title"><span> Maija Vilkkumaa (20:00) </span> <span> M (19:00) </span></h2>
      <div><span class="doors">Ovet 18:00</span></div></div></a>`);
    expect(parseJelmu(html, TODAY)[0]).toMatchObject({
      title: 'Maija Vilkkumaa, M',
      start: '2026-11-07T18:00:00+02:00',
      description: 'Ovet 18:00 · Keikka alkaa 20:00',
    });
  });

  it('ohittaa mahdottoman päivän ja hylkää kellonajan 24:00', () => {
    const bad = item(`<a href="https://www.jelmu.net/event/x" class="woocommerce-LoopProduct-link">
      <p class="datetime"><span>la</span><span class="date">31.2.</span></p>
      <div><h2 class="woocommerce-loop-product__title"><span>X (21:00)</span></h2></div></a>`);
    const late = item(`<a href="https://www.jelmu.net/event/y" class="woocommerce-LoopProduct-link">
      <p class="datetime"><span>la</span><span class="date">21.11.</span></p>
      <div><h2 class="woocommerce-loop-product__title"><span>Y (24:00)</span></h2></div></a>`);
    expect(parseJelmu(bad + late, TODAY)).toEqual([
      expect.objectContaining({ title: 'Y', start: '2026-11-21', allDay: true }),
    ]);
  });

  it('ohittaa perutut keikat', () => {
    const html = item(`<a href="https://www.jelmu.net/event/etta" class="woocommerce-LoopProduct-link">
      <p class="datetime"><span>pe</span><span class="date">23.10.</span></p>
      <div><h2 class="woocommerce-loop-product__title"><span>PERUTTU: Etta (21:00)</span></h2></div></a>`);
    expect(parseJelmu(html, TODAY)).toEqual([]);
  });

  it('jäsentää oikean tallennetun etusivun', () => {
    const events = parseJelmu(readFileSync('test/fixtures/jelmu/front.html', 'utf8'), TODAY);
    expect(events.length).toBeGreaterThan(20);
    for (const e of events) {
      expect(e.url).toMatch(/^https:\/\/www\.jelmu\.net\/event\//);
      expect(['Lutakko', 'Musta kynnys']).toContain(e.venue);
      expect(e.title).not.toMatch(/\(\d/);
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
