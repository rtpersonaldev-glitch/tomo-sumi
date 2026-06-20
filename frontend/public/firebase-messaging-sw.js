// Firebase Cloud Messaging Service Worker
// pushイベントを直接ハンドルしてバックグラウンド通知を表示する

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = {};
  }

  const notification = data.notification ?? {};
  const title = notification.title ?? '通知';
  const options = {
    body: notification.body ?? '',
    icon: '/vite.svg',
    badge: '/vite.svg',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
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
