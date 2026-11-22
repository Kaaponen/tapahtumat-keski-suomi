import { describe, expect, it } from 'vitest';
import { starsToUpload } from '../../src/web/account/sync';

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
