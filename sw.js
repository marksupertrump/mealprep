// Service worker: l'app funziona offline dopo la prima apertura. Cambia VERSION per forzare l'aggiornamento.
const VERSION = 'mealprep-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'api.js', 'store.js', 'core/foods.js', 'core/settings.js', 'core/planner.js', 'core/shopping.js', 'core/ics.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.endsWith('recipes-pack.json')) return;
  // rete prima (per avere sempre l'ultima versione), cache se offline
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
