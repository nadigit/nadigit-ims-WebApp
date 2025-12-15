const POS_CACHE = 'pos-shell-v1';
const POS_API_CACHE = 'pos-api-v1';
const POS_DATA_CACHE = 'pos-data-v1'; // For shops, customers, quick products

// Cache duration (24 hours for data, 1 hour for API responses)
const DATA_CACHE_DURATION = 24 * 60 * 60 * 1000;
const API_CACHE_DURATION = 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== POS_CACHE && key !== POS_API_CACHE && key !== POS_DATA_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle our webconsole scope
  if (!url.pathname.startsWith('/webconsole') && !url.pathname.startsWith('/api')) {
    return;
  }

  // Navigation requests to POS route: network-first, fallback to cache
  if (req.mode === 'navigate' && url.pathname.includes('/pos')) {
    event.respondWith(networkFirstForShell(req));
    return;
  }

  // Static assets (CSS, JS, images): cache-first
  if (url.pathname.startsWith('/webconsole/assets')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // POS APIs: network-first with cache fallback
  if (url.pathname.startsWith('/api/pos')) {
    event.respondWith(networkFirstForApi(req));
    return;
  }

  // Data APIs (shops, customers, quick products): cache with TTL
  if (url.pathname.startsWith('/api/organizations/shops') || 
      url.pathname.startsWith('/api/customers/')) {
    event.respondWith(cacheWithTTL(req, POS_DATA_CACHE, DATA_CACHE_DURATION));
    return;
  }
});

// Background sync for pending sales
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-sales') {
    console.log('[SW] Background sync: syncing pending sales');
    event.waitUntil(syncPendingSales());
  }
});

async function networkFirstForShell(req) {
  try {
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      const cache = await caches.open(POS_CACHE);
      cache.put(req, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Network failed, trying cache for shell:', req.url);
    const cache = await caches.open(POS_CACHE);
    const cached = await cache.match(req);
    if (cached) {
      return cached;
    }
    // Fallback to root index if specific POS route not cached
    const indexReq = new Request('/webconsole/');
    const indexCached = await cache.match(indexReq);
    if (indexCached) {
      return indexCached;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(POS_CACHE);
  const cached = await cache.match(req);
  if (cached) {
    return cached;
  }
  try {
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      cache.put(req, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.error('[SW] Failed to fetch asset:', req.url, err);
    throw err;
  }
}

async function networkFirstForApi(req) {
  try {
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      const cache = await caches.open(POS_API_CACHE);
      // Store with timestamp for cache expiration
      const cacheResponse = networkResponse.clone();
      const cacheData = {
        response: cacheResponse,
        timestamp: Date.now()
      };
      // Store as JSON with response clone
      const headers = new Headers();
      networkResponse.headers.forEach((v, k) => headers.set(k, v));
      headers.set('sw-cached-at', Date.now().toString());
      const cachedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      cache.put(req, cachedResponse);
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Network failed, trying cache for API:', req.url);
    const cache = await caches.open(POS_API_CACHE);
    const cached = await cache.match(req);
    if (cached) {
      // Check if cache is still valid (1 hour)
      const cachedAt = cached.headers.get('sw-cached-at');
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt);
        if (age < API_CACHE_DURATION) {
          return cached;
        } else {
          console.log('[SW] Cache expired for:', req.url);
          cache.delete(req);
        }
      } else {
        return cached; // Old cache without timestamp, use it anyway
      }
    }
    throw err;
  }
}

async function cacheWithTTL(req, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  
  if (cached) {
    const cachedAt = cached.headers.get('sw-cached-at');
    if (cachedAt) {
      const age = Date.now() - parseInt(cachedAt);
      if (age < ttl) {
        console.log('[SW] Serving from cache:', req.url);
        return cached;
      } else {
        console.log('[SW] Cache expired, fetching fresh:', req.url);
        cache.delete(req);
      }
    } else {
      // Old cache without timestamp, use it but refresh in background
      refreshInBackground(req, cache, cacheName);
      return cached;
    }
  }
  
  // Not in cache or expired, fetch fresh
  try {
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      const headers = new Headers();
      networkResponse.headers.forEach((v, k) => headers.set(k, v));
      headers.set('sw-cached-at', Date.now().toString());
      const cachedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      cache.put(req, cachedResponse);
    }
    return networkResponse;
  } catch (err) {
    // If network fails and we have old cache, use it
    if (cached) {
      console.log('[SW] Network failed, using stale cache:', req.url);
      return cached;
    }
    throw err;
  }
}

async function refreshInBackground(req, cache, cacheName) {
  try {
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      const headers = new Headers();
      networkResponse.headers.forEach((v, k) => headers.set(k, v));
      headers.set('sw-cached-at', Date.now().toString());
      const cachedResponse = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      cache.put(req, cachedResponse);
      console.log('[SW] Background refresh completed:', req.url);
    }
  } catch (err) {
    console.log('[SW] Background refresh failed:', req.url, err);
  }
}

async function syncPendingSales() {
  // This will be called by the app when it detects pending sales
  // The actual sync logic is in the POS component
  console.log('[SW] Background sync triggered');
  return Promise.resolve();
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      )
    );
  }
});
