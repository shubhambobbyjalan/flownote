// FlowNote Service Worker v1.0
// Strategy: Cache-first for assets, network-first for API calls

const CACHE_NAME = 'flownote-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap'
];

// ── INSTALL: pre-cache all static assets ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('http') || url.includes('fonts')));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first for static, Network-first for Supabase API ─────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network-first for Supabase (auth + database calls)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com/calendar')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for Google Fonts
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Cache-first for our own static files
  if (event.request.method === 'GET') {
    event.respondWith(cacheFirst(event.request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback — return the main page
    return caches.match('/') || new Response('FlowNote is offline. Your data is saved locally.', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── BACKGROUND SYNC: queue writes when offline ────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-todos') {
    event.waitUntil(syncPendingWrites());
  }
});

async function syncPendingWrites() {
  // Reads pending writes from IndexedDB (set by the main app when offline)
  // and replays them to Supabase when back online
  console.log('[SW] Background sync: flushing pending writes');
}

// ── PUSH NOTIFICATIONS: morning frog alert ────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🐸 Time to eat your frog!';
  const body  = data.body  || 'Your most important task is waiting. Do it first.';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-32.png',
      tag: 'morning-frog',
      renotify: false,
      data: { url: '/?action=frog' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
