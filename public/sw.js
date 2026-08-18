/* ============================================================================
   Service worker — Njoftimet në telefon dhe Ruajtja e Hartës (Cache LRU)
   ============================================================================ */

const TILE_CACHE = 'osm-tiles-v1';
const MAX_TILES = 500;

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch (err) {
    console.warn('Error trimming tile cache:', err);
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Cache OpenStreetMap tiles with LRU eviction
  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.status === 200) {
            cache.put(event.request, res.clone());
            trimCache(TILE_CACHE, MAX_TILES);
          }
          return res;
        } catch {
          return new Response('', { status: 503, statusText: 'Offline Map Tile' });
        }
      })
    );
  }
});

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { title: 'Referendumi', body: event.data ? event.data.text() : '' }; }

  event.waitUntil(self.registration.showNotification(d.title || 'Referendumi', {
    body:  d.body || '',
    icon:  'icon-192.png',
    badge: 'badge-96.png',
    lang:  'sq',
    tag:   d.tag || 'referendumi',
    renotify: true,
    data:  { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
