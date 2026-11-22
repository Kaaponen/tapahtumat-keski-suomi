import { describe, expect, it } from 'vitest';
import { resolveId, resolveIds } from '../../src/shared/aliases';

describe('aliakset', () => {
  it('resolveId seuraa aliasketjun loppuun', () => {
    expect(resolveId('a', { a: 'b', b: 'c' })).toBe('c');
    expect(resolveId('x', {})).toBe('x');
  });
  it('resolveId pysähtyy kehään', () => {
    expect(['a', 'b']).toContain(resolveId('a', { a: 'b', b: 'a' }));
  });
  it('resolveIds poistaa tuplat ja säilyttää järjestyksen', () => {
    expect(resolveIds(['a', 'z', 'c', 'a'], { a: 'c' })).toEqual(['c', 'z']);
  });
});
