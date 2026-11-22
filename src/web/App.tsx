import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORY_ORDER } from '../dedupe/categories';
import { dayKey } from '../shared/time';
import type { EventsFile } from '../shared/types';
import { EventCard } from './components/EventCard';
import { EventDetail } from './components/EventDetail';
import { FiltersBar } from './components/FiltersBar';
import { SourceStatusFooter } from './components/SourceStatusFooter';
import { useAccount } from './account/useAccount';
import { applyFilters, filtersFromSearch, mergeFilterSearch, mainVenue, rangeBounds, type Filters } from './logic/filters';
import { forYou } from './logic/forYou';
import { buildDayGroups, limitGroups, type ListItem } from './logic/grouping';

const PAGE_SIZE = 60;
// Tilipaneeli rakennetaan tehtävässä 10; toistaiseksi ei avaa mitään.
const onOpenAccount = () => {};
const NO_ALIASES: Record<string, string> = {};

export function App() {
  const [data, setData] = useState<EventsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(location.search));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showOngoing, setShowOngoing] = useState(false);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const [tab, setTab] = useState<'forYou' | 'all'>('forYou');
  const account = useAccount(data?.aliases ?? NO_ALIASES, data !== null);
  const { stars, toggleStar } = account;
  const today = dayKey(new Date().toISOString());

  useEffect(() => {
    fetch('./events.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventsFile>;
      })
      .then((d) => {
        // Vanhassa events.json:ssa ei ole aliaksia.
        const loaded = { ...d, aliases: d.aliases ?? {} };
        setData(loaded);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    // Säilytetään muut parametrit ja #-osa, jotta kirjautumisen paluuosoite ei katoa.
    const qs = mergeFilterSearch(location.search, filters);
    history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
    setLimit(PAGE_SIZE);
  }, [filters]);

  const forYouActive = !!account.user && tab === 'forYou';
  const groups = useMemo(() => {
    if (!data) return [];
    const start = rangeBounds(filters, today)?.[0];
    const first = start && start > today ? start : today;
    if (forYouActive && account.data) {
      const mine = forYou(data.events, account.data, stars, filters.city);
      return buildDayGroups(applyFilters(mine, filters, today, stars, true), today, first);
    }
    return buildDayGroups(applyFilters(data.events, filters, today, stars), today, first);
  }, [data, filters, today, stars, forYouActive, account.data]);
  const visible = useMemo(() => limitGroups(groups, limit), [groups, limit]);
  const categories = useMemo(() => {
    const present = new Set(data?.events.flatMap((e) => e.categories) ?? []);
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [data]);
  const venues = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.events ?? []) {
      const v = mainVenue(e.venue);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n >= 3).map(([v]) => v).sort((a, b) => a.localeCompare(b, 'fi'));
  }, [data]);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of data?.events ?? []) if (e.city) counts.set(e.city, (counts.get(e.city) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= 3).map(([c]) => c).sort((a, b) => a.localeCompare(b, 'fi'));
  }, [data]);
  const sourceName = (id: string) => data?.sources[id]?.name ?? id;

  if (error) return <main class="app"><p class="message">Tapahtumien lataus epäonnistui ({error}).</p></main>;
  if (!data) return <main class="app"><p class="message">Ladataan tapahtumia…</p></main>;

  return (
    <main class="app">
      <header class="app-header">
        <div class="app-header-row">
          <h1>Tapahtumat</h1>
          {account.available && (
            <button type="button" class="account-button" onClick={onOpenAccount}>
              {account.user ? 'Oma tili' : 'Kirjaudu'}
            </button>
          )}
        </div>
        <p class="subtitle">Jyväskylän seudun tapahtumat yhdessä paikassa</p>
      </header>
      <FiltersBar filters={filters} onChange={setFilters} categories={categories} venues={venues} cities={cities} />
      {account.user && (
        <div class="chips tabs" role="tablist" aria-label="Näkymä">
          {([['forYou', 'Sinulle'], ['all', 'Kaikki']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? 'chip active' : 'chip'} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {forYouActive && groups.length === 0 && (
        <div class="message empty-for-you">
          <p>Valitse kotipaikkakunta ja kiinnostavat kategoriat, niin näet täällä sinulle sopivat tapahtumat.</p>
          <button type="button" class="chip" onClick={onOpenAccount}>Avaa asetukset</button>
        </div>
      )}
      {groups.length === 0 && !forYouActive && <p class="message">Ei tapahtumia valituilla suodattimilla.</p>}
      {visible.groups.map((g) => (
        <section key={g.day} class="day">
          <h2 class="day-label">{g.label}</h2>
          {g.items.map((item) => (
            <EventCard key={item.event.id} item={item} sourceName={sourceName} onOpen={() => setSelected(item)} starred={stars.has(item.event.id)} onToggleStar={() => toggleStar(item.event.id)} />
          ))}
          {g.ongoing.length > 0 && (
            <>
              <button type="button" class="ongoing-toggle" aria-expanded={showOngoing} onClick={() => setShowOngoing((v) => !v)}>
                {showOngoing ? 'Piilota käynnissä olevat' : `Käynnissä myös ${g.ongoing.length} muuta (näyttelyt ym.)`}
              </button>
              {showOngoing && g.ongoing.map((item) => (
                <EventCard key={item.event.id} item={item} sourceName={sourceName} onOpen={() => setSelected(item)} starred={stars.has(item.event.id)} onToggleStar={() => toggleStar(item.event.id)} />
              ))}
            </>
          )}
        </section>
      ))}
      {visible.hasMore && (
        <button type="button" class="more" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Näytä lisää</button>
      )}
      <SourceStatusFooter sources={data.sources} generatedAt={data.generatedAt} />
      {selected && <EventDetail item={selected} sourceName={sourceName} onClose={() => setSelected(null)} stars={stars} onToggleStar={toggleStar} />}
    </main>
  );
}
