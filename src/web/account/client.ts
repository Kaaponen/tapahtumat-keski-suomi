import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountConfig } from './config';
import type { AccountUser, UserData } from './types';

export interface AccountApi {
  currentUser(): Promise<AccountUser | null>;
  onAuthChange(cb: (u: AccountUser | null) => void): () => void;
  signIn(provider: 'apple' | 'google'): Promise<void>;
  signOut(): Promise<void>;
  load(): Promise<UserData>;
  setStar(eventId: string, on: boolean): Promise<void>;
  addStars(ids: string[]): Promise<void>;
  setHomeCity(city: string | null): Promise<void>;
  setFavoriteCategories(categories: string[]): Promise<void>;
  setFollowedVenue(venue: string, follow: { inCalendar: boolean } | null): Promise<void>;
  regenerateFeedToken(): Promise<string>;
  deleteAccount(): Promise<void>;
}

const toUser = (u: User | null | undefined): AccountUser | null => (u ? { id: u.id, email: u.email ?? null } : null);

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message);
  return res;
}

export function createAccountApi(cfg: AccountConfig): AccountApi {
  const sb: SupabaseClient = createClient(cfg.supabaseUrl, cfg.anonKey);

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Ei kirjautunut');
    return id;
  }

  return {
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session?.user);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(provider) {
      check(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } }));
    },
    async signOut() {
      check(await sb.auth.signOut());
    },
    async load() {
      const id = await uid();
      const [profile, cats, venues, stars] = await Promise.all([
        sb.from('profiles').select('home_city, feed_token').eq('user_id', id).single(),
        sb.from('favorite_categories').select('category').eq('user_id', id),
        sb.from('followed_venues').select('venue, in_calendar').eq('user_id', id),
        sb.from('starred_events').select('event_id').eq('user_id', id),
      ]);
      const p = check(profile).data!;
      return {
        homeCity: p.home_city ?? null,
        feedToken: p.feed_token,
        favoriteCategories: (check(cats).data ?? []).map((r) => r.category as string),
        followedVenues: (check(venues).data ?? []).map((r) => ({ venue: r.venue as string, inCalendar: !!r.in_calendar })),
        starred: (check(stars).data ?? []).map((r) => r.event_id as string),
      };
    },
    async setStar(eventId, on) {
      const id = await uid();
      if (on) {
        check(await sb.from('starred_events').upsert({ user_id: id, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true }));
      } else {
        check(await sb.from('starred_events').delete().eq('user_id', id).eq('event_id', eventId));
      }
    },
    async addStars(ids) {
      if (ids.length === 0) return;
      const id = await uid();
      check(await sb.from('starred_events').upsert(ids.map((event_id) => ({ user_id: id, event_id })), { onConflict: 'user_id,event_id', ignoreDuplicates: true }));
    },
    async setHomeCity(city) {
      const id = await uid();
      check(await sb.from('profiles').update({ home_city: city }).eq('user_id', id));
    },
    async setFavoriteCategories(categories) {
      const id = await uid();
      const want = new Set(categories);
      const have = (check(await sb.from('favorite_categories').select('category').eq('user_id', id)).data ?? []).map((r) => r.category as string);
      const remove = have.filter((c) => !want.has(c));
      const add = [...want].filter((c) => !have.includes(c));
      if (remove.length) check(await sb.from('favorite_categories').delete().eq('user_id', id).in('category', remove));
      if (add.length) check(await sb.from('favorite_categories').insert(add.map((category) => ({ user_id: id, category }))));
    },
    async setFollowedVenue(venue, follow) {
      const id = await uid();
      if (!follow) {
        check(await sb.from('followed_venues').delete().eq('user_id', id).eq('venue', venue));
        return;
      }
      // Päivitys ensin: käyttäjä saa muuttaa vain in_calendar-saraketta, joten upsert ei kävisi.
      const updated = check(await sb.from('followed_venues').update({ in_calendar: follow.inCalendar }).eq('user_id', id).eq('venue', venue).select('venue')).data ?? [];
      if (updated.length === 0) {
        check(await sb.from('followed_venues').insert({ user_id: id, venue, in_calendar: follow.inCalendar }));
      }
    },
    async regenerateFeedToken() {
      const { data } = check(await sb.rpc('regenerate_feed_token'));
      return data as string;
    },
    async deleteAccount() {
      check(await sb.rpc('delete_account'));
      // Käyttöoikeustunniste olisi muuten voimassa vanhenemiseensa asti.
      await sb.auth.signOut({ scope: 'local' });
    },
  };
}
