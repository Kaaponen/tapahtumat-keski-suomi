import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { resolveIds } from '../../shared/aliases';
import type { AccountApi } from './client';
import { accountConfig } from './config';
import { getAccountStars, getLocalStars, setAccountStars, setLocalStars } from './stars';
import { remoteStarIds, starsToUpload } from './sync';
import type { AccountUser, UserData } from './types';

export interface Account {
  available: boolean;
  user: AccountUser | null;
  data: UserData | null;
  /** Kirjautuneen käyttäjän tietojen lataus epäonnistui (tähdet ovat silloin laitteen varakopiosta). */
  loadFailed: boolean;
  stars: Set<string>;
  toggleStar(id: string): void;
  api: AccountApi | null;
  reload(): Promise<void>;
}

/**
 * Tili ja tähdet. `ready` kertoo, että aliakset on ladattu; vasta sitten tähtiä
 * ratkaistaan ja synkronoidaan, ettei vanhoja tunnisteita lähetetä tilille.
 */
export function useAccount(aliases: Record<string, string>, ready = true): Account {
  const available = accountConfig() !== null;
  const [api, setApi] = useState<AccountApi | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [data, setData] = useState<UserData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [stars, setStars] = useState<Set<string>>(() => new Set(getLocalStars()));
  const starsRef = useRef(stars);
  starsRef.current = stars;
  const aliasesRef = useRef(aliases);
  aliasesRef.current = aliases;

  // Supabase ladataan vasta, kun asetukset ovat olemassa: pääpaketti pysyy pienenä.
  useEffect(() => {
    const cfg = accountConfig();
    if (!cfg) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    import('./client')
      .then(async ({ createAccountApi }) => {
        if (cancelled) return;
        const a = createAccountApi(cfg);
        setApi(a);
        setUser(await a.currentUser());
        off = a.onAuthChange(setUser);
      })
      .catch((e: unknown) => console.warn('Tilimoduulin lataus epäonnistui', e));
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  const userId = user?.id ?? null;

  // Uloskirjautuneena tähdet ovat laitteella.
  useEffect(() => {
    if (userId || !ready) return;
    const resolved = resolveIds(getLocalStars(), aliases);
    setLocalStars(resolved);
    setStars(new Set(resolved));
    setData(null);
    setLoadFailed(false);
  }, [userId, ready, aliases]);

  const sync = useCallback(async (a: AccountApi, isCurrent: () => boolean) => {
    let d = await a.load();
    const up = starsToUpload(getLocalStars(), d.starred, aliasesRef.current);
    if (up.length > 0) {
      await a.addStars(up);
      d = await a.load();
    }
    setLocalStars([]);
    if (!isCurrent()) return;
    setData(d);
    setLoadFailed(false);
    setStars(new Set(resolveIds(d.starred, aliasesRef.current)));
  }, []);

  // Epäonnistuneen latauksen jälkeen näytetään tilin tähdet laitteen varakopiosta (vain luku).
  const failLoad = () => {
    setLoadFailed(true);
    if (!dataRef.current) setStars(new Set(resolveIds(getAccountStars(), aliasesRef.current)));
  };

  // Kirjautuessa: lähetä paikalliset tähdet tilille ja siirry käyttämään tilin tietoja.
  useEffect(() => {
    if (!api || !userId || !ready) return;
    let current = true;
    sync(api, () => current).catch((e: unknown) => {
      console.warn('Tilin tietojen lataus epäonnistui', e);
      if (current) failLoad();
    });
    return () => {
      current = false;
    };
  }, [api, userId, ready, sync]);

  const reload = useCallback(async () => {
    if (!api || !userId) return;
    setLoadFailed(false);
    try {
      await sync(api, () => true);
    } catch (e) {
      failLoad();
      throw e;
    }
  }, [api, userId, sync]);

  // Ladattujen tilin tähtien varakopio laitteelle; tyhjennetään uloskirjautuessa (client.ts).
  useEffect(() => {
    if (userId && data) setAccountStars([...stars]);
  }, [userId, data, stars]);

  const toggleStar = (id: string) => {
    const prev = starsRef.current;
    const on = !prev.has(id);
    const next = new Set(prev);
    if (on) next.add(id);
    else next.delete(id);
    setStars(next);
    if (!userId || !api) {
      setLocalStars([...next]);
      return;
    }
    // Poistettaessa poistetaan myös tähden vanhoilla (aliasoiduilla) tunnisteilla tallennetut rivit.
    const remote = dataRef.current?.starred ?? [];
    const ids = on ? [id] : remoteStarIds(id, remote, aliasesRef.current);
    (on ? api.addStars(ids) : api.removeStars(ids)).then(() => {
      const removed = new Set(ids);
      setData((d) => d && { ...d, starred: on ? [...new Set([...d.starred, id])] : d.starred.filter((s) => !removed.has(s)) });
    }).catch((e: unknown) => {
      console.warn('Tähden tallennus epäonnistui', e);
      setStars((cur) => {
        const back = new Set(cur);
        if (on) back.delete(id);
        else back.add(id);
        return back;
      });
    });
  };

  return { available, user, data, loadFailed, stars, toggleStar, api, reload };
}
