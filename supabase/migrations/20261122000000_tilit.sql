-- Käyttäjätilit: profiili, suosikkikategoriat, seuratut paikat, tähdet ja henkilökohtainen kalenterisyöte.
--
-- Turvamalli: selain käyttää tauluja supabase-js:llä kirjautuneena (RLS: vain omat rivit).
-- VPS:llä on vain anon-avain, ja anon saa kutsua ainoastaan feed_for_token-funktiota.

create extension if not exists pgcrypto with schema extensions;

-- Taulut -------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  home_city text,
  feed_token text unique not null,
  created_at timestamptz default now()
);

create table public.favorite_categories (
  user_id uuid references auth.users on delete cascade,
  category text,
  primary key (user_id, category)
);

create table public.followed_venues (
  user_id uuid references auth.users on delete cascade,
  venue text,
  in_calendar boolean not null default false,
  primary key (user_id, venue)
);

create table public.starred_events (
  user_id uuid references auth.users on delete cascade,
  event_id text,
  starred_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- Oikeudet: anon ei saa mitään tauluihin. Profiilia käyttäjä saa vain lukea ja
-- päivittää home_city-saraketta; rivin luo laukaisin ja tokenin vaihtaa
-- regenerate_feed_token.

revoke all on public.profiles, public.favorite_categories, public.followed_venues, public.starred_events
  from public, anon, authenticated;

grant select, update (home_city) on public.profiles to authenticated;
grant select, insert, update, delete on public.favorite_categories, public.followed_venues, public.starred_events
  to authenticated;

-- RLS ----------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.favorite_categories enable row level security;
alter table public.followed_venues enable row level security;
alter table public.starred_events enable row level security;

create policy "oma profiili: luku" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "oma profiili: päivitys" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "omat kategoriat: luku" on public.favorite_categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "omat kategoriat: lisäys" on public.favorite_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "omat kategoriat: päivitys" on public.favorite_categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "omat kategoriat: poisto" on public.favorite_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "omat paikat: luku" on public.followed_venues
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "omat paikat: lisäys" on public.followed_venues
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "omat paikat: päivitys" on public.followed_venues
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "omat paikat: poisto" on public.followed_venues
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "omat tähdet: luku" on public.starred_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "omat tähdet: lisäys" on public.starred_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "omat tähdet: päivitys" on public.starred_events
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "omat tähdet: poisto" on public.starred_events
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Profiilin luonti rekisteröitymisessä ---------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, feed_token)
  values (new.id, encode(extensions.gen_random_bytes(24), 'hex'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Funktiot -----------------------------------------------------------------

-- Kalenterisyötteen sisältö tokenilla: {"starred": [...], "venues": [...]} tai null.
create function public.feed_for_token(token text) returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'starred', coalesce(
      (select json_agg(s.event_id order by s.event_id)
         from public.starred_events s
        where s.user_id = p.user_id),
      '[]'::json),
    'venues', coalesce(
      (select json_agg(v.venue order by v.venue)
         from public.followed_venues v
        where v.user_id = p.user_id and v.in_calendar),
      '[]'::json)
  )
  from public.profiles p
  where p.feed_token = feed_for_token.token
$$;

-- Vaihtaa kutsujan syötetokenin; vanha lakkaa toimimasta heti.
create function public.regenerate_feed_token() returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh text;
begin
  update public.profiles
     set feed_token = encode(extensions.gen_random_bytes(24), 'hex')
   where user_id = auth.uid()
  returning feed_token into fresh;
  if fresh is null then
    raise exception 'profiilia ei löydy';
  end if;
  return fresh;
end;
$$;

-- Poistaa kutsujan tilin; cascade poistaa kaikki käyttäjän rivit.
create function public.delete_account() returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Supabase antaa oletuksena execute-oikeuden kaikille API-rooleille, joten
-- perutaan se myös anonilta ja authenticatedilta eikä vain publicilta.
revoke execute on function
  public.handle_new_user(),
  public.feed_for_token(text),
  public.regenerate_feed_token(),
  public.delete_account()
  from public, anon, authenticated;

grant execute on function public.feed_for_token(text) to anon, authenticated;
grant execute on function public.regenerate_feed_token() to authenticated;
grant execute on function public.delete_account() to authenticated;
