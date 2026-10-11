import { useEffect, useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import { dayKey } from '../../shared/time';
import type { ListItem } from '../logic/grouping';
import { formatTime, shortDate } from '../logic/format';
import { AddToCalendar } from './CalendarMenu';

export function EventDetail({ item, sourceName, onClose }: {
  item: ListItem;
  sourceName: (id: string) => string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<Event>(item.event);

  useEffect(() => {
    const onKey = (k: KeyboardEvent) => k.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const e = current;
  return (
    <div class="overlay" onClick={onClose}>
      <div class="detail" role="dialog" aria-modal="true" aria-label={e.title} onClick={(ev) => ev.stopPropagation()}>
        <button type="button" class="close" aria-label="Sulje" onClick={onClose}>✕</button>
        {e.image && <img class="detail-image" src={e.image} alt="" />}
        <h2>{e.title}</h2>
        <p class="detail-when">{shortDate(dayKey(e.start))} · {formatTime(e)}</p>
        {(e.venue || e.address) && (
          <p class="detail-where">{[e.venue, e.address, e.city].filter(Boolean).join(', ')}</p>
        )}
        <AddToCalendar event={e} />
        {e.ticketUrl && <p><a href={e.ticketUrl} target="_blank" rel="noopener">Liput →</a></p>}
        {e.description && <p class="detail-description">{e.description}</p>}
        {item.series.length > 1 && (
          <div class="detail-series">
            <h3>Kaikki esitykset</h3>
            {item.series.map((s) => (
              <button
                key={s.id}
                type="button"
                class={s.id === e.id ? 'chip active' : 'chip'}
                onClick={() => setCurrent(s)}
              >
                {shortDate(dayKey(s.start))} {formatTime(s)}
              </button>
            ))}
          </div>
        )}
        <p class="detail-sources">
          Lähteet:{' '}
          {e.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ', '}
              <a href={s.url} target="_blank" rel="noopener">{sourceName(s.source)}</a>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
