import { dayKey, localTime } from '../shared/time';
import type { RawEvent } from '../shared/types';
import { venueKey } from './venues';

const NOISE_TOKENS = new Set([
  'loppuunmyyty', 'k18', 'k16', 'k15', 'k13', 'k12', 'k7',
  'jyväskylä', 'jyväskylässä', 'jyväskylän', 'paviljongissa', 'peurungassa',
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFC')
    .replace(/\bk-(\d{1,2})\b/g, 'k$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !NOISE_TOKENS.has(t))
    .join(' ');
}

export interface Normalized extends RawEvent {
  nTitle: string;
  vKey?: string;
  day: string;
  time: string | null;
}

export function normalizeEvent(e: RawEvent): Normalized {
  return {
    ...e,
    nTitle: normalizeTitle(e.title),
    vKey: venueKey(e.venue),
    day: dayKey(e.start),
    time: e.allDay ? null : localTime(e.start),
  };
}
