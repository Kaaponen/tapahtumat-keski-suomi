import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { Event } from '../../shared/types';
import {
  addToCalendar, CALENDAR_LABELS, getCalendarPref, setCalendarPref, type CalendarKind,
} from '../logic/prefs';

const KINDS = Object.keys(CALENDAR_LABELS) as CalendarKind[];

/** Sulkee avoimen valikon Escillä tai valikon ulkopuolelle napautettaessa; Esc palauttaa fokuksen painikkeeseen. */
function useDismiss(
  open: boolean,
  close: () => void,
  container: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (ev: PointerEvent) => {
      if (!container.current?.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      // Estää samalla Escin sulkemasta tapahtuman tietoikkunaa.
      ev.preventDefault();
      ev.stopPropagation();
      close();
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
}

export function CalendarChoices({ id, event, onDone }: { id: string; event: Event; onDone: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const choose = (kind: CalendarKind) => {
    setCalendarPref(kind);
    addToCalendar(event, kind);
    onDone();
  };
  return (
    <div id={id} class="calendar-menu" role="group" aria-label="Valitse kalenteri">
      {KINDS.map((kind, i) => (
        <button key={kind} ref={i === 0 ? first : undefined} type="button" onClick={() => choose(kind)}>
          {CALENDAR_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}

/** Kortin pikapainike: muistetulla kalenterilla yksi napautus, muuten valikko. */
export function QuickAddButton({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useDismiss(open, () => setOpen(false), container, trigger);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(timer);
  }, [done]);

  const onClick = () => {
    const pref = getCalendarPref();
    if (!pref) {
      setOpen((o) => !o);
      return;
    }
    addToCalendar(event, pref);
    setDone(true);
  };

  return (
    <div class="quick-add" ref={container}>
      <button
        ref={trigger}
        type="button"
        class="icon-button"
        aria-label={done ? `Lisätty kalenteriin: ${event.title}` : `Lisää kalenteriin: ${event.title}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onClick}
      >
        <span aria-hidden="true">{done ? '✓' : '📅'}</span>
      </button>
      {open && <CalendarChoices id={menuId} event={event} onDone={() => { setOpen(false); trigger.current?.focus(); }} />}
    </div>
  );
}

/** Tapahtuman tiedoissa näkyvä "Lisää kalenteriin ▾" ja muistetun kalenterin vaihto. */
export function AddToCalendar({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState(getCalendarPref());
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useDismiss(open, () => setOpen(false), container, trigger);

  return (
    <div class="add-to-calendar" ref={container}>
      <button
        ref={trigger}
        type="button"
        class="primary"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Lisää kalenteriin <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <CalendarChoices
          id={menuId}
          event={event}
          onDone={() => { setOpen(false); setPref(getCalendarPref()); trigger.current?.focus(); }}
        />
      )}
      {pref && (
        <p class="pref-note">
          Pikapainike lisää: {CALENDAR_LABELS[pref]} ·{' '}
          <button type="button" class="link" onClick={() => { setCalendarPref(null); setPref(null); }}>Vaihda</button>
        </p>
      )}
    </div>
  );
}
