import { describe, expect, it } from 'vitest';
import { remoteStarIds, starsToUpload } from '../../src/web/account/sync';

describe('starsToUpload', () => {
  it('lähettää vain puuttuvat tähdet', () => {
    expect(starsToUpload(['a', 'b', 'c'], ['b'], {})).toEqual(['a', 'c']);
  });
  it('ratkaisee paikalliset aliakset ennen vertailua', () => {
    expect(starsToUpload(['old', 'x'], ['new'], { old: 'new' })).toEqual(['x']);
  });
  it('tyhjä paikallinen lista → ei mitään', () => {
    expect(starsToUpload([], ['a'], {})).toEqual([]);
  });
});

describe('remoteStarIds', () => {
  it('palauttaa kaikki tilin tunnisteet, jotka ratkeavat poistettavaan tähteen', () => {
    expect(remoteStarIds('y', ['x', 'y', 'z'], { x: 'y' }).sort()).toEqual(['x', 'y']);
  });
  it('vanha tunniste ilman nykyistä riviä poistuu silti', () => {
    expect(remoteStarIds('y', ['x', 'z'], { x: 'y' }).sort()).toEqual(['x', 'y']);
  });
  it('seuraa aliasketjua', () => {
    expect(remoteStarIds('c', ['a'], { a: 'b', b: 'c' }).sort()).toEqual(['a', 'c']);
  });
});
