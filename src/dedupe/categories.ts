const RULES: [string, RegExp][] = [
  ['Musiikki', /musiik|konsert|keik|music|kuoro|ooppera|jazz|rock|orkester/],
  ['Teatteri', /teatter|näytelm|musikaal|theat/],
  ['Stand up', /stand ?up|komiik/],
  ['Tanssi', /tanssi|baletti/],
  ['Näyttelyt', /näyttely|taide|galleria|museo/],
  ['Urheilu', /urheilu|liikunta|salibandy|jääkiekko|jalkapallo|ottelu|juoks|sport/],
  ['Lapset ja perheet', /lapsi|lapset|lapsille|perhe|nuoret|kids/],
  ['Ruoka ja juoma', /ruoka|viini|olut|food|pikkujoulu/],
  ['Messut', /messu|markkina/],
  ['Kurssit ja luennot', /kurssi|luento|työpaja|koulutus/],
];

export const CATEGORY_ORDER = [...RULES.map(([name]) => name), 'Muut'];

export function categorize(raw: string[]): string[] {
  const text = raw.join(' | ').toLowerCase();
  const found = RULES.filter(([, re]) => re.test(text)).map(([name]) => name);
  return found.length ? found : ['Muut'];
}
