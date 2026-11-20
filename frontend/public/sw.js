/* Vetrina: recebe os avisos de preço (Web Push) mesmo com a loja fechada. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Vetrina', {
    body: d.corpo || '',
    icon: '/icon-192.png',
    badge: '/icon-badge.png',
    image: d.imagem || undefined,
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/loja' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/loja', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    for (const j of janelas) if (j.url === url && 'focus' in j) return j.focus();
    return self.clients.openWindow(url);
  }));
});
