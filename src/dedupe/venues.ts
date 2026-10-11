/** Tunnetut paikat: eri kirjoitusasut -> sama avain. Täydennä tarvittaessa. */
const KNOWN: [string, RegExp][] = [
  ['paviljonki', /paviljonk/],
  ['peurunka', /peurunk/],
  ['kaupunginteatteri', /kaupunginteatteri/],
  ['lutakko', /lutakko/],
  ['rockneck', /rockneck/],
  ['ilokivi', /ilokivi/],
  ['vakiopaine', /vakiopaine/],
  ['poppari', /poppari/],
];

const NOISE = new Set(['jyväskylä', 'jyväskylän', 'jyväskylässä']);

export function venueKey(venue?: string): string | undefined {
  if (!venue?.trim()) return undefined;
  const s = venue.toLowerCase();
  for (const [key, re] of KNOWN) if (re.test(s)) return key;
  const words = s
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !NOISE.has(w));
  return words.join(' ') || undefined;
}
