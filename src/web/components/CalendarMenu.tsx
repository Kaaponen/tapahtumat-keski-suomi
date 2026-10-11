import { useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import {
  addToCalendar, CALENDAR_LABELS, getCalendarPref, setCalendarPref, type CalendarKind,
} from '../logic/prefs';

const KINDS = Object.keys(CALENDAR_LABELS) as CalendarKind[];

export function CalendarChoices({ event, onDone }: { event: Event; onDone: () => void }) {
  const choose = (kind: CalendarKind) => {
    setCalendarPref(kind);
    addToCalendar(event, kind);
    onDone();
  };
  return (
    <div class="calendar-menu" role="menu">
      {KINDS.map((kind) => (
        <button key={kind} type="button" role="menuitem" onClick={() => choose(kind)}>
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

  const onClick = () => {
    const pref = getCalendarPref();
    if (!pref) {
      setOpen((o) => !o);
      return;
    }
    addToCalendar(event, pref);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  return (
    <div class="quick-add" onClick={(e) => e.stopPropagation()}>
      <button type="button" class="icon-button" aria-label="Lisää kalenteriin" onClick={onClick}>
        {done ? '✓' : '📅'}
      </button>
      {open && <CalendarChoices event={event} onDone={() => setOpen(false)} />}
    </div>
  );
}

/** Tapahtuman tiedoissa näkyvä "Lisää kalenteriin ▾" ja muistetun kalenterin vaihto. */
export function AddToCalendar({ event }: { event: Event }) {
  const [open, setOpen] = useState(false);
  const [pref, setPref] = useState(getCalendarPref());
  return (
    <div class="add-to-calendar">
      <button type="button" class="primary" onClick={() => setOpen((o) => !o)}>Lisää kalenteriin ▾</button>
      {open && <CalendarChoices event={event} onDone={() => { setOpen(false); setPref(getCalendarPref()); }} />}
      {pref && (
        <p class="pref-note">
          Pikapainike lisää: {CALENDAR_LABELS[pref]} ·{' '}
          <button type="button" class="link" onClick={() => { setCalendarPref(null); setPref(null); }}>Vaihda</button>
        </p>
      )}
    </div>
  );
}
