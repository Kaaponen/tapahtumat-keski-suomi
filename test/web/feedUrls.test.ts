import { describe, expect, it } from 'vitest';
import { feedUrls } from '../../src/web/account/feedUrls';

describe('feedUrls', () => {
  it('muodostaa https- ja webcal-osoitteen', () => {
    expect(feedUrls('https://syote.x.fi', 'abc')).toEqual({
      https: 'https://syote.x.fi/abc.ics',
      webcal: 'webcal://syote.x.fi/abc.ics',
    });
  });
  it('sallii lopun kauttaviivan', () => {
    expect(feedUrls('https://syote.x.fi/', 'abc').https).toBe('https://syote.x.fi/abc.ics');
  });
});
