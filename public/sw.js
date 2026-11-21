// Service worker: sovellus aukeaa ja näyttää viimeksi haetut tapahtumat myös ilman verkkoa.
// - Sivu (index.html) ja events.json: verkko ensin, välimuisti varalla.
// - Vite-buildin tiedostot (assets/, nimissä hash): välimuisti ensin.
// - Muiden palvelimien kuvat jätetään selaimen hoidettaviksi.

const CACHE = 'tapahtumat-v1';
const SHELL = ['./', './events.json', './manifest.webmanifest', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Esiladataan sivun viittaamat JS/CSS, jotta ensimmäinen offline-avaus toimii.
      const html = await (await cache.match('./')).text();
      await cache.addAll(assetUrls(html));
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

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './', pruneAssets));
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
      if (onFresh) await onFresh(cache, await res.clone().text());
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

// Poistetaan vanhojen buildien tiedostot, joihin uusin index.html ei enää viittaa.
async function pruneAssets(cache, html) {
  const current = new Set(assetUrls(html).map((u) => new URL(u, self.registration.scope).href));
  for (const req of await cache.keys()) {
    if (req.url.includes('/assets/') && !current.has(req.url)) await cache.delete(req);
  }
}

function assetUrls(html) {
  return [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+)"/g)].map((m) => m[1]);
}
