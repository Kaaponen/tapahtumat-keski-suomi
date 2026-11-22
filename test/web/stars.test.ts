import { describe, expect, it } from 'vitest';
import { clearAccountStars, getAccountStars, getLocalStars, setAccountStars, setLocalStars } from '../../src/web/account/stars';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  };
}

const throwing = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('SecurityError'); },
  removeItem: () => { throw new Error('SecurityError'); },
} as unknown as Storage;

describe('tähdet laitteella', () => {
  it('tallentaa ja lukee tähdet', () => {
    const s = memoryStorage();
    expect(getLocalStars(s)).toEqual([]);
    setLocalStars(['a', 'b'], s);
    expect(getLocalStars(s)).toEqual(['a', 'b']);
  });
  it('hylkää virheellisen sisällön', () => {
    const s = memoryStorage();
    s.setItem('tapahtumat.stars', '{"x":1}');
    expect(getLocalStars(s)).toEqual([]);
    s.setItem('tapahtumat.stars', 'ei json');
    expect(getLocalStars(s)).toEqual([]);
    s.setItem('tapahtumat.stars', '["a",3,"b"]');
    expect(getLocalStars(s)).toEqual(['a', 'b']);
  });
  it('ei kaadu kun localStorage heittää', () => {
    expect(getLocalStars(throwing)).toEqual([]);
    expect(() => setLocalStars(['a'], throwing)).not.toThrow();
  });
});

describe('tilin tähtien varakopio', () => {
  it('tallentaa, lukee ja tyhjentää erillisen avaimen', () => {
    const s = memoryStorage();
    expect(getAccountStars(s)).toEqual([]);
    setAccountStars(['a', 'b'], s);
    expect(getAccountStars(s)).toEqual(['a', 'b']);
    expect(getLocalStars(s)).toEqual([]);
    expect(s.getItem('tapahtumat.accountStars')).toBe('["a","b"]');
    clearAccountStars(s);
    expect(getAccountStars(s)).toEqual([]);
    expect(s.getItem('tapahtumat.accountStars')).toBeNull();
  });
  it('ei kaadu kun localStorage heittää', () => {
    expect(getAccountStars(throwing)).toEqual([]);
    expect(() => setAccountStars(['a'], throwing)).not.toThrow();
    expect(() => clearAccountStars(throwing)).not.toThrow();
  });
});
