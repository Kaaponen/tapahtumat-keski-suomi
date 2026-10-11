import { describe, expect, it } from 'vitest';
import { safeUrl } from '../../src/shared/url';

describe('safeUrl', () => {
  it.each([
    ['lippu.fi/eventseries/123', 'https://lippu.fi/eventseries/123'],
    ['www.studiolaive.fi/kauppa', 'https://www.studiolaive.fi/kauppa'],
    ['  https://x.fi/a ', 'https://x.fi/a'],
    [' https://paviljonki.fi/t', 'https://paviljonki.fi/t'],
    ['http://ok.fi', 'http://ok.fi/'],
  ])('hyväksyy %s', (input, out) => {
    expect(safeUrl(input)).toBe(out);
  });
  it.each([
    ['Ovelta 30min ennen'], ['javascript:alert(1)'], ['mailto:a@b.fi'], [''], ['   '], [undefined], [null],
    ['https://x.fi/a b'],
  ])('hylkää %s', (input) => {
    expect(safeUrl(input as string | undefined)).toBeUndefined();
  });
});
