// service-worker.js

const CACHE_NAME = 'mrc-chess-tournament-cache-v1';
const urlsToCache = [
  '/', // Caches the root path, typically index.html
  '/index.html',
  '/tournament-detail.html',
  '/admin-panel.html',
  '/script.js',
  '/style.css',
  '/manifest.json',
  // Add paths to your icon files here
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // You might also want to cache your audio file for celebration
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  // External libraries (if you want to cache them for offline use)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Install event: Caches all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activates the service worker immediately
      .catch(error => {
        console.error('Failed to cache assets during install:', error);
      })
  );
});

// Activate event: Cleans up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Takes control of pages immediately
  );
});

// Fetch event: Intercepts network requests
self.addEventListener('fetch', event => {
  // We only want to handle GET requests for navigation and static assets
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(response => {
        // Cache hit - return response
        if (response) {
          console.log('Serving from cache:', event.request.url);
          return response;
        }

        // No cache hit - fetch from network
        console.log('Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and can only be consumed once. We must clone it so that
            // both the browser and the cache can consume it.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('Fetch failed; network is probably offline:', error);
            // Optional: If you have an offline.html, you can return it here
            // return caches.match('/offline.html');
          });
      })
    );
  }
});
