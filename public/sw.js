// Service Worker for Push Notifications
const CACHE_NAME = 'spark-app-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle Push Events
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'Spark Notification',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'spark-notification',
    requireInteraction: false,
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (error) {
      console.error('Error parsing push payload:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions || [
        {
          action: 'view',
          title: 'View',
          icon: '/icons/view.png'
        }
      ],
      timestamp: notificationData.timestamp || Date.now(),
      silent: notificationData.silent || false
    }
  );

  event.waitUntil(promiseChain);
});

// Handle Notification Click Events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  
  let url = '/';

  // Determine URL based on notification data
  if (notificationData.url) {
    url = notificationData.url;
  } else if (notificationData.sparkId) {
    url = `/spark/${notificationData.sparkId}`;
  } else if (notificationData.type === 'achievement_unlocked') {
    url = '/achievements';
  }

  // Handle different actions
  if (action === 'view' || action === 'open_spark') {
    // Open the main app
  } else if (action === 'accept') {
    // Handle collaboration invite acceptance
    url = `${url}?action=accept`;
  } else if (action === 'decline') {
    // Handle collaboration invite decline
    url = `${url}?action=decline`;
  }

  // Open or focus the app window
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    // Check if app is already open
    for (const client of clientList) {
      if (client.url.includes(self.location.origin)) {
        // Focus existing window and navigate
        return client.focus().then(() => {
          if (client.url !== url) {
            return client.navigate(url);
          }
        });
      }
    }

    // Open new window
    if (clients.openWindow) {
      return clients.openWindow(url);
    }
  });

  event.waitUntil(promiseChain);
});

// Handle Background Sync
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event);

  if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Sync notifications when back online
async function syncNotifications() {
  try {
    // This would typically sync with your server
    console.log('Syncing notifications...');
    
    // You could implement offline notification queuing here
    // and sync when connectivity is restored
  } catch (error) {
    console.error('Failed to sync notifications:', error);
  }
}

// Handle fetch events (basic caching strategy)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Return offline page if available
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
      })
  );
});

// Handle message events from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic Background Sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'notification-check') {
      event.waitUntil(checkForNewNotifications());
    }
  });
}

async function checkForNewNotifications() {
  try {
    // This would check for new notifications from your server
    console.log('Checking for new notifications...');
    
    // Implementation would depend on your backend API
  } catch (error) {
    console.error('Failed to check for new notifications:', error);
  }
}