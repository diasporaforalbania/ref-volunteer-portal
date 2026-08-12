/* ============================================================================
   Service worker — VETËM për njoftimet në telefon.

   Qëllimisht NUK ruan asgjë në cache. Portali është një skedar i vetëm që
   ndryshon shpesh gjatë fushatës; një kopje e vjetër e ruajtur këtu do të
   vazhdonte t'u shfaqej vullnetarëve edhe pasi ndreqet një gabim. Prandaj
   dëgjuesi i `fetch` rri bosh: kërkesat shkojnë te rrjeti si gjithnjë, dhe ai
   ekziston vetëm sepse shfletuesit e kërkojnë që aplikacioni të instalohet.
   ============================================================================ */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { title: 'Referendumi', body: event.data ? event.data.text() : '' }; }

  event.waitUntil(self.registration.showNotification(d.title || 'Referendumi', {
    body:  d.body || '',
    icon:  'icon-192.png',
    // Stema vizatohet nga Androidi si siluetë njëngjyrëshe: po t'i jepje ikonën
    // e plotë, te shiriti i sipërm do të dilte thjesht një katror i mbushur.
    // `badge-96.png` i ka vetëm shkronjat, të bardha mbi sfond të tejdukshëm.
    badge: 'badge-96.png',
    lang:  'sq',
    // `tag` i njëjtë → njoftimi i ri zë vendin e të vjetrit, që telefoni të mos
    // mbushet me dhjetëra rreshta kur qendra publikon disa njoftime radhazi.
    tag:      d.tag || 'referendumi',
    renotify: true,
    data: { url: d.url || './' }
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
