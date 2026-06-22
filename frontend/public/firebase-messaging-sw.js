// Firebase Cloud Messaging Service Worker

self.addEventListener('push', (event) => {
  console.log('[SW] push event fired', event.data ? event.data.text() : 'no data');

  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = {};
  }

  console.log('[SW] push data:', JSON.stringify(data));

  // WebpushNotification format: data.notification.{title,body}
  // Fallback: data.{title,body}
  const notification = data.notification ?? {};
  const title = notification.title ?? data.title ?? '通知';
  const body  = notification.body  ?? data.body  ?? '';

  const options = {
    body,
    icon: '/vite.svg',
    badge: '/vite.svg',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] showNotification OK:', title))
      .catch((err) => console.error('[SW] showNotification FAILED:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/');
      })
  );
});
