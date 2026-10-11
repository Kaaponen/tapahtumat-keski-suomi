import { describe, expect, it } from 'vitest';
import { categorize } from '../../src/dedupe/categories';

describe('categorize', () => {
  it.each([
    [['Konsertit', 'Paviljonki Klubi'], ['Musiikki']],
    [['keikat'], ['Musiikki']],
    [['Pikkujoulut'], ['Ruoka ja juoma']],
    [['Taide'], ['Näyttelyt']],
    [['Urheilu', 'lapsille'], ['Urheilu', 'Lapset ja perheet']],
    [['Stand up'], ['Stand up']],
    [[], ['Muut']],
    [['jotain outoa'], ['Muut']],
  ])('%j → %j', (input, expected) => {
    expect(categorize(input)).toEqual(expected);
  });
});
