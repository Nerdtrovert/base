// Base Service Worker for Web Push Notifications

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated');
  event.waitUntil(self.clients.claim());
});

// Listen to incoming push events from the backend
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received', event);

  let data = {
    title: 'Base',
    body: 'New notification received.',
    url: '/'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      // Fallback if payload isn't JSON
      data = {
        title: 'Base',
        body: event.data.text(),
        url: '/'
      };
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    // Use tag to replace existing notifications of the same type to avoid cluttering
    tag: data.title.toLowerCase().replace(/\s+/g, '-'),
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle click on notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with the same URL, focus it if so
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
