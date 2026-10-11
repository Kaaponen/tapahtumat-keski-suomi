import type { Filters, Range } from '../logic/filters';

const RANGES: [Range, string][] = [
  ['all', 'Kaikki'],
  ['today', 'Tänään'],
  ['weekend', 'Viikonloppu'],
  ['week', '7 päivää'],
  ['custom', 'Valitse päivät'],
];

export function FiltersBar({ filters, onChange, categories, venues }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  venues: string[];
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div class="filters">
      <input
        type="search"
        placeholder="Hae tapahtumia…"
        value={filters.q ?? ''}
        onInput={(e) => set({ q: e.currentTarget.value || undefined })}
      />
      <div class="chips">
        {RANGES.map(([range, label]) => (
          <button
            key={range}
            type="button"
            class={filters.range === range ? 'chip active' : 'chip'}
            onClick={() => set({ range })}
          >
            {label}
          </button>
        ))}
      </div>
      {filters.range === 'custom' && (
        <div class="custom-range">
          <input type="date" value={filters.from ?? ''} onInput={(e) => set({ from: e.currentTarget.value || undefined })} />
          <span>–</span>
          <input type="date" value={filters.to ?? ''} onInput={(e) => set({ to: e.currentTarget.value || undefined })} />
        </div>
      )}
      <div class="selects">
        <select value={filters.category ?? ''} onChange={(e) => set({ category: e.currentTarget.value || undefined })}>
          <option value="">Kaikki kategoriat</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.venue ?? ''} onChange={(e) => set({ venue: e.currentTarget.value || undefined })}>
          <option value="">Kaikki paikat</option>
          {venues.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}
