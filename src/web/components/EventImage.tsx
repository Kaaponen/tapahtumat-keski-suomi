import { useEffect, useState } from 'preact/hooks';
import type { Event } from '../../shared/types';
import { categoryIcon } from '../logic/categoryIcon';

/** Tapahtuman kuva; puuttuvan tai latautumattoman kuvan tilalla näytetään kategorian kuvake. */
export function EventImage({ event, class: className, lazy = false }: {
  event: Event;
  class: string;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [event.image]);

  if (!event.image || failed) {
    return (
      <div class={`${className} placeholder`} aria-hidden="true">
        {categoryIcon(event.categories)}
      </div>
    );
  }
  return (
    <img
      class={className}
      src={event.image}
      alt=""
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
