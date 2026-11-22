import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

let db: PGlite;

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('./supabase-stub.sql'));
  await db.exec(read('../../supabase/migrations/20261122000000_tilit.sql'));
});

afterAll(async () => {
  await db?.close();
});

/** Creates a Supabase auth user (as the auth service would) and returns its id. */
async function createUser(): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), gen_random_uuid() || '@example.com') returning id`,
  );
  return rows[0].id;
}

/** Runs fn as a PostgREST request with the given role and JWT subject. */
async function as<T>(role: 'anon' | 'authenticated', sub: string | null, fn: () => Promise<T>): Promise<T> {
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

const asUser = <T>(id: string, fn: () => Promise<T>) => as('authenticated', id, fn);
const asAnon = <T>(fn: () => Promise<T>) => as('anon', null, fn);

async function tokenOf(id: string): Promise<string> {
  const { rows } = await db.query<{ feed_token: string }>(
    'select feed_token from public.profiles where user_id = $1', [id],
  );
  return rows[0].feed_token;
}

async function feedFor(token: string) {
  const { rows } = await db.query<{ feed: unknown }>('select public.feed_for_token($1) as feed', [token]);
  return rows[0].feed;
}

const TABLES = ['profiles', 'favorite_categories', 'followed_venues', 'starred_events'];

describe('tilit-tietokanta', () => {
  it('kirjautuminen luo profiilin ja 48-merkkisen tokenin', async () => {
    const a = await createUser();
    const { rows } = await asUser(a, () =>
      db.query<{ user_id: string; feed_token: string }>('select user_id, feed_token from public.profiles'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(a);
    expect(rows[0].feed_token).toMatch(/^[0-9a-f]{48}$/);
  });

  it('käyttäjä A ei näe käyttäjän B tähtiä, paikkoja eikä profiilia', async () => {
    const a = await createUser();
    const b = await createUser();
    await asUser(b, async () => {
      await db.query(`insert into public.starred_events (user_id, event_id) values ($1, 'e1')`, [b]);
      await db.query(`insert into public.followed_venues (user_id, venue, in_calendar) values ($1, 'Lutakko', true)`, [b]);
      await db.query(`insert into public.favorite_categories (user_id, category) values ($1, 'musiikki')`, [b]);
    });

    await asUser(a, async () => {
      for (const t of TABLES) {
        const { rows } = await db.query(`select * from public.${t} where user_id = $1`, [b]);
        expect(rows, t).toHaveLength(0);
      }
      const upd = await db.query(`update public.profiles set home_city = 'Turku' where user_id = $1`, [b]);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query(`delete from public.starred_events where user_id = $1`, [b]);
      expect(del.affectedRows).toBe(0);
      await expect(
        db.query(`insert into public.starred_events (user_id, event_id) values ($1, 'e2')`, [b]),
      ).rejects.toThrow(/row-level security/);
    });

    const { rows } = await db.query('select * from public.starred_events where user_id = $1', [b]);
    expect(rows).toHaveLength(1);
  });

  it('anon ei näe mitään taulua', async () => {
    await createUser();
    for (const t of TABLES) {
      await expect(asAnon(() => db.query(`select * from public.${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });

  it('anon voi kutsua vain feed_for_tokenia', async () => {
    const a = await createUser();
    const token = await tokenOf(a);
    const feed = await asAnon(() => feedFor(token));
    expect(feed).toEqual({ starred: [], venues: [] });
    await expect(asAnon(() => db.query('select public.regenerate_feed_token()'))).rejects.toThrow(/permission denied/);
    await expect(asAnon(() => db.query('select public.delete_account()'))).rejects.toThrow(/permission denied/);
    await expect(asUser(a, () => db.query('select public.handle_new_user()'))).rejects.toThrow(/permission denied/);
  });

  it('feed_for_token palauttaa tähdet ja vain kalenteriin valitut paikat', async () => {
    const a = await createUser();
    const b = await createUser();
    await asUser(a, async () => {
      await db.query(`insert into public.starred_events (user_id, event_id) values ($1, 'e1'), ($1, 'e2')`, [a]);
      await db.query(
        `insert into public.followed_venues (user_id, venue, in_calendar) values ($1, 'Lutakko', true), ($1, 'Paviljonki', false)`,
        [a],
      );
    });
    await asUser(b, () =>
      db.query(`insert into public.starred_events (user_id, event_id) values ($1, 'muu')`, [b]),
    );

    const token = await tokenOf(a);
    const feed = (await asAnon(() => feedFor(token))) as { starred: string[]; venues: string[] };
    expect([...feed.starred].sort()).toEqual(['e1', 'e2']);
    expect(feed.venues).toEqual(['Lutakko']);
  });

  it('feed_for_token palauttaa null tuntemattomalle tokenille', async () => {
    await createUser();
    expect(await asAnon(() => feedFor('0'.repeat(48)))).toBeNull();
    expect(await asAnon(() => feedFor(''))).toBeNull();
  });

  it('regenerate_feed_token mitätöi vanhan tokenin', async () => {
    const a = await createUser();
    const old = await tokenOf(a);
    const { rows } = await asUser(a, () =>
      db.query<{ token: string }>('select public.regenerate_feed_token() as token'),
    );
    const fresh = rows[0].token;
    expect(fresh).toMatch(/^[0-9a-f]{48}$/);
    expect(fresh).not.toBe(old);
    expect(await tokenOf(a)).toBe(fresh);
    expect(await asAnon(() => feedFor(old))).toBeNull();
    expect(await asAnon(() => feedFor(fresh))).toEqual({ starred: [], venues: [] });
  });

  it('käyttäjä ei voi päivittää feed_tokenia suoraan', async () => {
    const a = await createUser();
    const old = await tokenOf(a);
    await asUser(a, async () => {
      await expect(
        db.query(`update public.profiles set feed_token = 'arvattava' where user_id = $1`, [a]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query(`insert into public.profiles (user_id, feed_token) values ($1, 'x')`, [a]),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query('delete from public.profiles where user_id = $1', [a])).rejects.toThrow(/permission denied/);
      const upd = await db.query(`update public.profiles set home_city = 'Jyväskylä' where user_id = $1`, [a]);
      expect(upd.affectedRows).toBe(1);
    });
    expect(await tokenOf(a)).toBe(old);
  });

  it('delete_account poistaa käyttäjän kaikki rivit', async () => {
    const a = await createUser();
    const b = await createUser();
    for (const id of [a, b]) {
      await asUser(id, async () => {
        await db.query(`insert into public.starred_events (user_id, event_id) values ($1, 'e1')`, [id]);
        await db.query(`insert into public.followed_venues (user_id, venue) values ($1, 'Lutakko')`, [id]);
        await db.query(`insert into public.favorite_categories (user_id, category) values ($1, 'musiikki')`, [id]);
      });
    }

    await asUser(a, () => db.query('select public.delete_account()'));

    for (const t of TABLES) {
      const gone = await db.query(`select 1 from public.${t} where user_id = $1`, [a]);
      expect(gone.rows, t).toHaveLength(0);
      const kept = await db.query(`select 1 from public.${t} where user_id = $1`, [b]);
      expect(kept.rows, t).toHaveLength(1);
    }
    const users = await db.query('select id from auth.users where id = any($1::uuid[])', [[a, b]]);
    expect(users.rows).toEqual([{ id: b }]);
  });
});
