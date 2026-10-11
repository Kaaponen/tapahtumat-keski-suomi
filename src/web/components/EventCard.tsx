import type { ListItem } from '../logic/grouping';
import { formatTime, seriesSummary } from '../logic/format';
import { QuickAddButton } from './CalendarMenu';
import { EventImage } from './EventImage';

/**
 * Kortin nimi on oikea painike, jonka napautusalue venytetään koko kortin kokoiseksi (CSS ::after).
 * Näin 📅-painike ei ole toisen painikkeen sisällä.
 */
export function EventCard({ item, sourceName, onOpen }: {
  item: ListItem;
  sourceName: (id: string) => string;
  onOpen: () => void;
}) {
  const e = item.event;
  return (
    <article class="card">
      <EventImage event={e} class="card-image" lazy />
      <div class="card-body">
        <h3 class="card-title">
          <button type="button" class="card-open" onClick={onOpen}>{e.title}</button>
        </h3>
        <p class="card-meta">
          {formatTime(e)}
          {e.venue ? ` · ${e.venue}` : ''}
          {e.city && (!e.venue || (e.city !== 'Jyväskylä' && e.city !== e.venue)) ? ` · ${e.city}` : ''}
        </p>
        {item.series.length > 1 && <p class="card-series">{seriesSummary(item.series)}</p>}
        <p class="card-tags">
          {e.categories.filter((c) => c !== 'Muut').map((c) => <span key={c} class="tag">{c}</span>)}
          {e.sources.map((s) => <span key={s.source} class="source">{sourceName(s.source)}</span>)}
        </p>
      </div>
      <QuickAddButton event={e} />
    </article>
  );
}
