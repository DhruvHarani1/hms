/* AIFDMS Hostel — web push service worker */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'AIFDMS Hostel', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'AIFDMS Hostel';
  const options = {
    body: payload.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
