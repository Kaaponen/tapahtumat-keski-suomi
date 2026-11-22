import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { resolveIds } from '../../shared/aliases';
import type { AccountApi } from './client';
import { accountConfig } from './config';
import { getLocalStars, setLocalStars } from './stars';
import { starsToUpload } from './sync';
import type { AccountUser, UserData } from './types';

export interface Account {
  available: boolean;
  user: AccountUser | null;
  data: UserData | null;
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
    setStars(new Set(resolveIds(d.starred, aliasesRef.current)));
  }, []);

  // Kirjautuessa: lähetä paikalliset tähdet tilille ja siirry käyttämään tilin tietoja.
  useEffect(() => {
    if (!api || !userId || !ready) return;
    let current = true;
    sync(api, () => current).catch((e: unknown) => console.warn('Tilin tietojen lataus epäonnistui', e));
    return () => {
      current = false;
    };
  }, [api, userId, ready, sync]);

  const reload = useCallback(async () => {
    if (api && userId) await sync(api, () => true);
  }, [api, userId, sync]);

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
    api.setStar(id, on).catch((e: unknown) => {
      console.warn('Tähden tallennus epäonnistui', e);
      setStars((cur) => {
        const back = new Set(cur);
        if (on) back.delete(id);
        else back.add(id);
        return back;
      });
    });
  };

  return { available, user, data, stars, toggleStar, api, reload };
}
