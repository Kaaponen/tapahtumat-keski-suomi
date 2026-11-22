import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORY_ORDER } from '../../dedupe/categories';
import type { Account } from '../account/useAccount';
import { accountConfig } from '../account/config';
import { feedUrls } from '../account/feedUrls';

const SAVE_ERROR = 'Tallennus epäonnistui. Yritä uudelleen.';

/** Tilin asetukset natiivissa <dialog>-elementissä (kuten EventDetail). */
export function AccountPanel({ account, cities, onClose }: { account: Account; cities: string[]; onClose: () => void }) {
  const { api, data, user, reload } = account;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      root.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  /** Tallentaa muutoksen ja lataa tilin tiedot uudelleen; virheestä näytetään lyhyt ilmoitus. */
  const save = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      console.warn('Tallennus epäonnistui', e);
      setError(SAVE_ERROR);
    }
  };

  const signInWith = (provider: 'apple' | 'google') => {
    api?.signIn(provider).catch((e: unknown) => {
      console.warn('Kirjautuminen epäonnistui', e);
      setError('Kirjautuminen epäonnistui. Yritä uudelleen.');
    });
  };

  const cfg = accountConfig();
  const urls = data && cfg ? feedUrls(cfg.feedBaseUrl, data.feedToken) : null;
  const toggleCategory = (c: string) => {
    if (!data) return;
    const next = data.favoriteCategories.includes(c)
      ? data.favoriteCategories.filter((x) => x !== c)
      : [...data.favoriteCategories, c];
    void save(() => api!.setFavoriteCategories(next));
  };
  const copy = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Kopiointi epäonnistui', e);
      setError('Kopiointi epäonnistui. Valitse osoite ja kopioi se käsin.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      class="detail account-panel"
      aria-labelledby="account-title"
      onCancel={(ev) => { ev.preventDefault(); onClose(); }}
      onClick={(ev) => ev.target === dialogRef.current && onClose()}
    >
      <div class="detail-content">
        <button type="button" class="close" aria-label="Sulje" onClick={onClose}>✕</button>
        <h2 id="account-title">{user ? 'Oma tili' : 'Kirjaudu'}</h2>
        {error && <p class="panel-error" role="alert">{error}</p>}

        {!user && (
          <div class="panel-section">
            <p class="pref-note">Kirjautuneena tähdet, seuratut paikat ja kalenterisyöte kulkevat mukanasi laitteelta toiselle.</p>
            <div class="panel-buttons">
              <button type="button" class="primary" onClick={() => signInWith('apple')}>Kirjaudu Applella</button>
              <button type="button" class="primary" onClick={() => signInWith('google')}>Kirjaudu Googlella</button>
            </div>
          </div>
        )}

        {user && !data && <p class="message">Ladataan…</p>}

        {user && data && (
          <>
            {user.email && <p class="pref-note">{user.email}</p>}

            <section class="panel-section">
              <h3>Kotipaikkakunta</h3>
              <select
                aria-label="Kotipaikkakunta"
                value={data.homeCity ?? ''}
                onChange={(ev) => void save(() => api!.setHomeCity(ev.currentTarget.value || null))}
              >
                <option value="">Ei valittu</option>
                {(data.homeCity && !cities.includes(data.homeCity) ? [data.homeCity, ...cities] : cities).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </section>

            <section class="panel-section">
              <h3>Kiinnostavat kategoriat</h3>
              <div class="chips wrap">
                {CATEGORY_ORDER.map((c) => {
                  const on = data.favoriteCategories.includes(c);
                  return (
                    <button key={c} type="button" class={on ? 'chip active' : 'chip'} aria-pressed={on} onClick={() => toggleCategory(c)}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </section>

            <section class="panel-section">
              <h3>Seuratut paikat</h3>
              {data.followedVenues.length === 0 && <p class="pref-note">Et seuraa vielä yhtään paikkaa. Voit seurata paikkaa tapahtuman tiedoista.</p>}
              <ul class="venue-list">
                {data.followedVenues.map((v) => (
                  <li key={v.venue}>
                    <span class="venue-name">{v.venue}</span>
                    <label>
                      <input
                        type="checkbox"
                        checked={v.inCalendar}
                        onChange={(ev) => void save(() => api!.setFollowedVenue(v.venue, { inCalendar: ev.currentTarget.checked }))}
                      />{' '}
                      Näytä kalenterissa
                    </label>
                    <button type="button" class="link" onClick={() => void save(() => api!.setFollowedVenue(v.venue, null))}>
                      Lopeta seuraaminen
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {urls && (
              <section class="panel-section">
                <h3>Kalenterisyöte</h3>
                <div class="feed-row">
                  <input type="text" readOnly aria-label="Kalenterisyötteen osoite" value={urls.https} onFocus={(ev) => ev.currentTarget.select()} />
                  <button type="button" class="chip" onClick={() => void copy()}>{copied ? 'Kopioitu' : 'Kopioi'}</button>
                </div>
                <p><a href={urls.webcal}>Avaa kalenterissa</a></p>
                <ul class="feed-help">
                  <li><strong>Apple:</strong> avaa linkki tai Asetukset → Kalenteri → Tilit → Lisää tili → Muu → Lisää tilattu kalenteri.</li>
                  <li><strong>Google:</strong> calendar.google.com → Muut kalenterit → + → URL-osoitteesta. Google päivittää harvemmin, jopa kerran vuorokaudessa.</li>
                  <li><strong>Outlook:</strong> Lisää kalenteri → Tilaa verkosta.</li>
                </ul>
                <button
                  type="button"
                  class="link"
                  onClick={() => {
                    if (window.confirm('Vanha osoite lakkaa toimimasta, ja kalenteri pitää tilata uudelleen.')) {
                      void save(() => api!.regenerateFeedToken());
                    }
                  }}
                >
                  Luo uusi syöteosoite
                </button>
              </section>
            )}

            <section class="panel-section panel-buttons">
              <button type="button" class="chip" onClick={() => void api?.signOut().then(onClose).catch((e: unknown) => { console.warn('Uloskirjautuminen epäonnistui', e); setError('Uloskirjautuminen epäonnistui. Yritä uudelleen.'); })}>
                Kirjaudu ulos
              </button>
              <button
                type="button"
                class="chip danger"
                onClick={() => {
                  if (!window.confirm('Tili ja kaikki tallennetut valinnat poistetaan pysyvästi.')) return;
                  api!.deleteAccount().then(onClose).catch((e: unknown) => {
                    console.warn('Tilin poisto epäonnistui', e);
                    setError('Tilin poisto epäonnistui. Yritä uudelleen.');
                  });
                }}
              >
                Poista tili
              </button>
            </section>
          </>
        )}

        <p class="pref-note"><a href="./tietosuoja.html" target="_blank" rel="noopener">Tietosuojaseloste</a></p>
      </div>
    </dialog>
  );
}
