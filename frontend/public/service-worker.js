/* global self, clients, URL */

const FALLBACK_URL = '/chore/notifications';

function safeNotificationUrl(value) {
  try {
    const candidate = new URL(value || FALLBACK_URL, self.location.origin);
    if (candidate.origin !== self.location.origin || !candidate.pathname.startsWith('/chore/')) {
      return new URL(FALLBACK_URL, self.location.origin).href;
    }
    return candidate.href;
  } catch {
    return new URL(FALLBACK_URL, self.location.origin).href;
  }
}

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
    body: payload.body || 'You have a new notification.',
    data: { url: safeNotificationUrl(payload.link_url) },
    badge: '/chore/favicon.svg',
    icon: '/chore/favicon.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (target) {
      await target.navigate(url);
      return target.focus();
    }
    return clients.openWindow(url);
  })());
});
