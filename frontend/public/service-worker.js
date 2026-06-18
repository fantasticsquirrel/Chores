/* global self, clients */

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Family Manager', body: event.data.text() };
    }
  }

  const title = payload.title || 'Family Manager';
  const options = {
    body: payload.body || 'You have a new chore reminder.',
    data: { url: payload.link_url || '/chore/notifications' },
    badge: '/chore/favicon.svg',
    icon: '/chore/favicon.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/chore/notifications';
  event.waitUntil(clients.openWindow(url));
});
