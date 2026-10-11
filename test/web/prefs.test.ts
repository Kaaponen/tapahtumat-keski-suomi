import { describe, expect, it } from 'vitest';
import { getCalendarPref, setCalendarPref } from '../../src/web/logic/prefs';

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

describe('kalenterivalinnan muistaminen', () => {
  it('tallentaa ja lukee valinnan', () => {
    const s = memoryStorage();
    expect(getCalendarPref(s)).toBeNull();
    setCalendarPref('google', s);
    expect(getCalendarPref(s)).toBe('google');
    setCalendarPref(null, s);
    expect(getCalendarPref(s)).toBeNull();
  });
  it('hylkää tuntemattoman arvon', () => {
    const s = memoryStorage();
    s.setItem('tapahtumat.calendar', 'yahoo');
    expect(getCalendarPref(s)).toBeNull();
  });
  it('estetty tallennustila ei kaada', () => {
    expect(getCalendarPref(throwing)).toBeNull();
    expect(() => setCalendarPref('ics', throwing)).not.toThrow();
  });
});
