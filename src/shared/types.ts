/** Yhden lähteen palauttama tapahtuma ennen yhdistämistä. */
export interface RawEvent {
  source: string;
  sourceId: string;
  title: string;
  /** ISO 8601 aikavyöhykkeen kanssa, tai pelkkä päivämäärä YYYY-MM-DD kun allDay. */
  start: string;
  end?: string;
  allDay?: boolean;
  venue?: string;
  address?: string;
  city?: string;
  url: string;
  ticketUrl?: string;
  image?: string;
  description?: string;
  categories?: string[];
}

export interface SourceLink {
  source: string;
  url: string;
}

/** Yhdistetty tapahtuma, joka päätyy events.json-tiedostoon. */
export interface Event {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  venue?: string;
  address?: string;
  city?: string;
  url: string;
  ticketUrl?: string;
  image?: string;
  description?: string;
  categories: string[];
  sources: SourceLink[];
}

export interface SourceStatus {
  name: string;
  lastSuccess: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  count: number;
}

export interface EventsFile {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  events: Event[];
}

export interface FetchContext {
  getText(url: string): Promise<string>;
  getJson<T = unknown>(url: string): Promise<T>;
  log(message: string): void;
}

export interface Source {
  id: string;
  name: string;
  fetch(ctx: FetchContext): Promise<RawEvent[]>;
}
