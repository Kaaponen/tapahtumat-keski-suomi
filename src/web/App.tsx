import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORY_ORDER } from '../dedupe/categories';
import { dayKey } from '../shared/time';
import type { EventsFile } from '../shared/types';
import { EventCard } from './components/EventCard';
import { EventDetail } from './components/EventDetail';
import { FiltersBar } from './components/FiltersBar';
import { SourceStatusFooter } from './components/SourceStatusFooter';
import { applyFilters, filtersFromSearch, filtersToSearch, mainVenue, rangeBounds, type Filters } from './logic/filters';
import { buildDayGroups, limitGroups, type ListItem } from './logic/grouping';

const PAGE_SIZE = 60;

export function App() {
  const [data, setData] = useState<EventsFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch(location.search));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [showOngoing, setShowOngoing] = useState(false);
  const [selected, setSelected] = useState<ListItem | null>(null);
  const today = dayKey(new Date().toISOString());

  useEffect(() => {
    fetch('./events.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventsFile>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const qs = filtersToSearch(filters);
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    setLimit(PAGE_SIZE);
  }, [filters]);

  const groups = useMemo(() => {
    if (!data) return [];
    const start = rangeBounds(filters, today)?.[0];
    return buildDayGroups(applyFilters(data.events, filters, today), today, start && start > today ? start : today);
  }, [data, filters, today]);
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
  const sourceName = (id: string) => data?.sources[id]?.name ?? id;

  if (error) return <main class="app"><p class="message">Tapahtumien lataus epäonnistui ({error}).</p></main>;
  if (!data) return <main class="app"><p class="message">Ladataan tapahtumia…</p></main>;

  return (
    <main class="app">
      <header class="app-header">
        <h1>Tapahtumat</h1>
        <p class="subtitle">Jyväskylän seudun tapahtumat yhdessä paikassa</p>
      </header>
      <FiltersBar filters={filters} onChange={setFilters} categories={categories} venues={venues} />
      {groups.length === 0 && <p class="message">Ei tapahtumia valituilla suodattimilla.</p>}
      {visible.groups.map((g) => (
        <section key={g.day} class="day">
          <h2 class="day-label">{g.label}</h2>
          {g.items.map((item) => (
            <EventCard key={item.event.id} item={item} sourceName={sourceName} onOpen={() => setSelected(item)} />
          ))}
          {g.ongoing.length > 0 && (
            <>
              <button type="button" class="ongoing-toggle" aria-expanded={showOngoing} onClick={() => setShowOngoing((v) => !v)}>
                {showOngoing ? 'Piilota käynnissä olevat' : `Käynnissä myös ${g.ongoing.length} muuta (näyttelyt ym.)`}
              </button>
              {showOngoing && g.ongoing.map((item) => (
                <EventCard key={item.event.id} item={item} sourceName={sourceName} onOpen={() => setSelected(item)} />
              ))}
            </>
          )}
        </section>
      ))}
      {visible.hasMore && (
        <button type="button" class="more" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Näytä lisää</button>
      )}
      <SourceStatusFooter sources={data.sources} generatedAt={data.generatedAt} />
      {selected && <EventDetail item={selected} sourceName={sourceName} onClose={() => setSelected(null)} />}
    </main>
  );
}
