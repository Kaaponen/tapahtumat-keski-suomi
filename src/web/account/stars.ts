const KEY = 'tapahtumat.stars';
/** Kirjautuneen käyttäjän (ratkaistut) tähdet, vain luettava varakopio kun tilin lataus epäonnistuu. */
const ACCOUNT_KEY = 'tapahtumat.accountStars';

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string, storage: Storage | null): string[] {
  try {
    const raw = storage?.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[] | null, storage: Storage | null): void {
  try {
    if (ids === null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(ids));
  } catch {
    // Yksityinen selaustila tms. – tähtiä ei muisteta, mutta mikään ei kaadu.
  }
}

export function getLocalStars(storage: Storage | null = defaultStorage()): string[] {
  return read(KEY, storage);
}

export function setLocalStars(ids: string[], storage: Storage | null = defaultStorage()): void {
  write(KEY, ids, storage);
}

export function getAccountStars(storage: Storage | null = defaultStorage()): string[] {
  return read(ACCOUNT_KEY, storage);
}

export function setAccountStars(ids: string[], storage: Storage | null = defaultStorage()): void {
  write(ACCOUNT_KEY, ids, storage);
}

export function clearAccountStars(storage: Storage | null = defaultStorage()): void {
  write(ACCOUNT_KEY, null, storage);
}
