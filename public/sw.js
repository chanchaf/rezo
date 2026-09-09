// Service worker REZO — uniquement pour les notifications push (pas de cache offline ici).
// Doit rester à la racine (`/sw.js`) : la portée d'un service worker est limitée à son
// dossier et en-dessous, donc le mettre ailleurs empêcherait de contrôler toute l'app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'REZO', body: '', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch (err) {
    // payload non-JSON : on garde le titre/texte par défaut
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
