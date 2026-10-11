import { describe, expect, it } from 'vitest';
import { categoryIcon } from '../../src/web/logic/categoryIcon';

describe('categoryIcon', () => {
  it.each([
    [['Musiikki'], '🎵'],
    [['Teatteri'], '🎭'],
    [['Näyttelyt', 'Lapset ja perheet'], '🖼️'],
    [['Urheilu'], '⚽'],
    [['Muut'], '📅'],
    [[], '📅'],
  ])('%j → %s', (categories, expected) => {
    expect(categoryIcon(categories)).toBe(expected);
  });
});
