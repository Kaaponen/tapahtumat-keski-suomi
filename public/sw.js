// Service worker: sovellus aukeaa ja näyttää viimeksi haetut tapahtumat myös ilman verkkoa.
// - Sivu (index.html) ja events.json: verkko ensin, välimuisti varalla.
// - Vite-buildin tiedostot (assets/, nimissä hash): välimuisti ensin. Sivun viittaamat tiedostot ja
//   niiden omat viittaukset (esim. dynaamisesti ladattava tilimoduuli) esiladataan ja säilytetään.
// - Muiden palvelimien kuvat jätetään selaimen hoidettaviksi.

const CACHE = 'tapahtumat-v3';
const SHELL = ['./', './events.json', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Esiladataan sivun viittaamat JS/CSS ja niiden viittaukset, jotta ensimmäinen offline-avaus toimii.
      const html = await (await cache.match('./')).text();
      await assetClosure(cache, html);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Vain sovelluksen pääsivu (scope-juuri tai index.html, kyselyparametrit sallitaan) on shell.
  // Muut navigoinnit (esim. tietosuoja.html) menevät suoraan verkkoon eikä shell-välimuistiin kosketa.
  const root = new URL(self.registration.scope).pathname;
  const isShell = url.pathname === root || url.pathname === root + 'index.html';
  if (req.mode === 'navigate') {
    if (isShell) event.respondWith(networkFirst(req, './', (cache, html) => event.waitUntil(pruneAssets(cache, html))));
  } else if (url.pathname.endsWith('/events.json')) {
    event.respondWith(networkFirst(req, './events.json'));
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req, key, onFresh) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) {
      await cache.put(key, res.clone());
      if (onFresh) onFresh(cache, await res.clone().text());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

// Poistetaan vanhojen buildien tiedostot, joihin uusin index.html (suoraan tai välillisesti) ei enää viittaa.
async function pruneAssets(cache, html) {
  let current;
  try {
    current = await assetClosure(cache, html, false);
  } catch {
    return; // Verkkovirhe: ei karsita, ettei mitään tarpeellista katoa.
  }
  for (const req of await cache.keys()) {
    if (req.url.includes('/assets/') && !current.has(req.url)) await cache.delete(req);
  }
}

// Sivun viittaamat assets/-tiedostot ja JS/CSS-tiedostojen omat viittaukset. Sivun omat puuttuvat
// tiedostot haetaan aina välimuistiin; niiden viittaamat vain, jos fetchRefs (asennus). Karsinnassa
// viittaukset säilytetään, jos ne ovat jo välimuistissa, mutta niitä ei ladata (sivu lataa tarvittaessa).
async function assetClosure(cache, html, fetchRefs = true) {
  const scope = self.registration.scope;
  const found = new Set();
  let queue = assetUrls(html).map((u) => new URL(u, scope).href);
  for (let round = 0; queue.length > 0 && round < 5; round++) {
    const next = [];
    for (const url of queue) {
      if (found.has(url) || !url.includes('/assets/')) continue;
      const res = round === 0 || fetchRefs ? await cached(cache, url) : await cache.match(url);
      // Sivun omat tiedostot ovat pakollisia; sisältä löytynyt merkkijono voi olla muukin kuin
      // assets/-tiedosto (esim. './sw.js') tai lataamaton, joten puuttuva ohitetaan.
      if (!res) {
        if (round === 0) throw new Error(`Puuttuu ${url}`);
        continue;
      }
      found.add(url);
      if (!/\.(js|css)$/.test(new URL(url).pathname)) continue;
      const text = await res.text();
      for (const ref of referencedUrls(text)) {
        next.push(new URL(ref, ref.startsWith('assets/') ? scope : url).href);
      }
    }
    queue = next;
  }
  return found;
}

// Välimuistista tai verkosta; null, jos palvelin vastaa virheellä.
async function cached(cache, url) {
  const hit = await cache.match(url);
  if (hit) return hit;
  const res = await fetch(url); // verkkovirhe heitetään eteenpäin
  if (!res.ok) return null;
  await cache.put(url, res.clone());
  return res;
}

function assetUrls(html) {
  return [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
}

// Viittaukset JS/CSS-tiedoston sisällä: `./client-abc.js`, `assets/x.css`, url(./fontti.woff2) jne.
function referencedUrls(text) {
  const re = /["'`(]((?:\.\/|assets\/)[\w.-]+\.(?:js|css|woff2?|png|svg|webp|jpg))["'`)]/g;
  return [...text.matchAll(re)].map((m) => m[1]);
}
