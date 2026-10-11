import { useEffect, useRef, useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import { dayKey } from '../../shared/time';
import type { ListItem } from '../logic/grouping';
import { formatTime, shortDate } from '../logic/format';
import { AddToCalendar } from './CalendarMenu';

/** Estää taustasivun rullauksen; palauttaa funktion, joka purkaa eston. */
function lockBodyScroll(): () => void {
  const root = document.documentElement;
  const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
  const scrollbar = window.innerWidth - root.clientWidth;
  root.style.overflow = 'hidden';
  if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
  return () => {
    root.style.overflow = previous.overflow;
    root.style.paddingRight = previous.paddingRight;
  };
}

/**
 * Tapahtuman tiedot natiivissa <dialog>-elementissä: showModal() pitää fokuksen ikkunassa,
 * piilottaa taustan ruudunlukijalta ja sulkeutuu Escillä. Sulkiessa fokus palaa avanneeseen painikkeeseen.
 */
export function EventDetail({ item, sourceName, onClose }: {
  item: ListItem;
  sourceName: (id: string) => string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<Event>(item.event);
  const [imageFailed, setImageFailed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    dialog.showModal();
    return () => {
      unlock();
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  useEffect(() => setImageFailed(false), [current.image]);

  const e = current;
  return (
    <dialog
      ref={dialogRef}
      class="detail"
      aria-labelledby="detail-title"
      onCancel={(ev) => { ev.preventDefault(); onClose(); }}
      onClick={(ev) => ev.target === dialogRef.current && onClose()}
    >
      <div class="detail-content">
        <button type="button" class="close" aria-label="Sulje" onClick={onClose}>✕</button>
        {e.image && !imageFailed && (
          <img class="detail-image" src={e.image} alt="" onError={() => setImageFailed(true)} />
        )}
        <h2 id="detail-title">{e.title}</h2>
        <p class="detail-when">{shortDate(dayKey(e.start))} · {formatTime(e)}</p>
        {(e.venue || e.address) && (
          <p class="detail-where">{[e.venue, e.address, e.city].filter(Boolean).join(', ')}</p>
        )}
        <AddToCalendar event={e} />
        {e.ticketUrl && <p><a href={e.ticketUrl} target="_blank" rel="noopener">Liput →</a></p>}
        {e.description && <p class="detail-description">{e.description}</p>}
        {item.series.length > 1 && (
          <div class="detail-series" role="group" aria-labelledby="detail-series-title">
            <h3 id="detail-series-title">Kaikki esitykset</h3>
            {item.series.map((s) => (
              <button
                key={s.id}
                type="button"
                class={s.id === e.id ? 'chip active' : 'chip'}
                aria-pressed={s.id === e.id}
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
    </dialog>
  );
}
