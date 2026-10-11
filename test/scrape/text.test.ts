import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText } from '../../src/scrape/text';

describe('htmlToText', () => {
  it('poistaa tagit ja yhdistää välilyönnit', () => {
    expect(htmlToText('<p>Hei <b>maailma</b></p><p>Toinen</p>')).toBe('Hei maailma Toinen');
  });
  it('erottaa <br>-rivit välilyönnillä', () => {
    expect(htmlToText('Rivi1<br />Rivi2')).toBe('Rivi1 Rivi2');
  });
  it('lyhentää pitkän tekstin', () => {
    const out = htmlToText('a'.repeat(700), 600)!;
    expect(out.length).toBe(600);
    expect(out.endsWith('…')).toBe(true);
  });
  it('palauttaa undefined tyhjälle', () => {
    expect(htmlToText('')).toBeUndefined();
    expect(htmlToText('<p> </p>')).toBeUndefined();
    expect(htmlToText(null)).toBeUndefined();
  });
});

describe('decodeEntities', () => {
  it('purkaa HTML-entiteetit', () => {
    expect(decodeEntities('Timo &#038; Jarkko &#8211; Voices')).toBe('Timo & Jarkko – Voices');
  });
});
