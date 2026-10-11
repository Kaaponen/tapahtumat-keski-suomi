const ICONS: Record<string, string> = {
  Musiikki: '🎵',
  Teatteri: '🎭',
  'Stand up': '🎤',
  Tanssi: '💃',
  Näyttelyt: '🖼️',
  Urheilu: '⚽',
  'Lapset ja perheet': '🧸',
  'Ruoka ja juoma': '🍽️',
  Messut: '🛍️',
  'Kurssit ja luennot': '🎓',
};

const DEFAULT_ICON = '📅';

/** Kuvan paikkamerkin kuvake tapahtuman ensimmäisen tunnetun kategorian mukaan. */
export function categoryIcon(categories: string[]): string {
  for (const c of categories) if (ICONS[c]) return ICONS[c];
  return DEFAULT_ICON;
}
