export interface AccountConfig {
  supabaseUrl: string;
  anonKey: string;
  feedBaseUrl: string;
}

/** Tili-ominaisuudet ovat käytössä vain, jos kaikki kolme ympäristömuuttujaa on asetettu. */
export function accountConfig(): AccountConfig | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const feedBaseUrl = import.meta.env.VITE_FEED_BASE_URL;
  if (!supabaseUrl || !anonKey || !feedBaseUrl) return null;
  return { supabaseUrl, anonKey, feedBaseUrl };
}
