// Service Worker combining push notifications and PWA caching
const CACHE_NAME = 'spark-app-v1';
const STATIC_CACHE = 'spark-static-v1';
const API_CACHE = 'spark-api-v1';

// Critical static assets to cache
const STATIC_ASSETS = [
  '/',
  '/app/workspaces',
  '/profile',
  '/manifest.json',
  '/favicon.ico',
  '/logo.svg',
  '/_next/static/css/app/globals.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache with network-first strategy
const API_ROUTES = [
  '/api/workspaces',
  '/api/ideas',
  '/api/auth/session',
  '/api/user/profile'
];

// Offline fallback pages
const FALLBACK_PAGES = {
  '/': '/offline.html',
  '/app/workspaces': '/offline-workspaces.html'
};

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests with network-first strategy
  if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(request.url) || request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// Check if request is for API endpoint
function isApiRequest(url) {
  return API_ROUTES.some(route => url.includes(route)) || url.includes('/api/');
}

// Check if request is for static asset
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => url.includes(ext)) || 
         url.includes('/_next/static/') || 
         STATIC_ASSETS.some(asset => url.includes(asset));
}

// Network-first strategy for API requests
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw new Error('Network and cache failed');
  } catch (error) {
    console.log('Service Worker: Network request failed, trying cache:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API calls
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'You are currently offline. Please check your connection.'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the response
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network request failed');
  } catch (error) {
    console.log('Service Worker: Static request failed:', error);
    
    // Try to serve fallback page for navigation requests
    if (request.mode === 'navigate') {
      const url = new URL(request.url);
      const fallbackPage = FALLBACK_PAGES[url.pathname] || FALLBACK_PAGES['/'];
      
      if (fallbackPage) {
        const fallbackResponse = await caches.match(fallbackPage);
        if (fallbackResponse) {
          return fallbackResponse;
        }
      }
      
      // Generic offline fallback for navigation
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Spark - Offline</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                text-align: center; 
                padding: 2rem; 
                background: #000;
                color: #fff;
              }
              .container { 
                max-width: 400px; 
                margin: 0 auto; 
                padding: 2rem;
                border-radius: 8px;
                background: #111;
              }
              .icon { 
                font-size: 4rem; 
                margin-bottom: 1rem; 
              }
              h1 { 
                margin: 1rem 0; 
                color: #3b82f6;
              }
              p { 
                margin: 1rem 0; 
                color: #9ca3af;
              }
              button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⚡</div>
              <h1>You're Offline</h1>
              <p>Spark is not available right now. Please check your internet connection.</p>
              <button onclick="window.location.reload()">Try Again</button>
            </div>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // For non-navigation requests, return a generic error
    return new Response('Offline', { status: 503 });
  }
}

// Handle Push Events (from original)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'Spark Notification',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
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

// Handle Notification Click Events (from original)
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

// Handle background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncData());
  } else if (event.tag === 'notification-sync') {
    event.waitUntil(syncNotifications());
  }
});

async function syncData() {
  try {
    // Sync pending data when online
    console.log('Service Worker: Syncing data...');
    // Implementation for syncing offline changes would go here
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}

// Sync notifications when back online (from original)
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