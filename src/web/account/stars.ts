const KEY = 'tapahtumat.stars';

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getLocalStars(storage: Storage | null = defaultStorage()): string[] {
  try {
    const raw = storage?.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setLocalStars(ids: string[], storage: Storage | null = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Yksityinen selaustila tms. – tähtiä ei muisteta, mutta mikään ei kaadu.
  }
}
