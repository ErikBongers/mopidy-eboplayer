/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'eboplayer-v1';
const ASSETS_TO_CACHE = [
    '/index.html',
    '/css/global.css',
    '/css/webclient.css',
    '/generated/bundle.js',
    '/manifest.json',
    '/images/icons/Album.svg',
    '/images/icons/Artist.svg',
    '/images/icons/eboplayer-192.png',
    '/images/icons/eboplayer-512.png',
    '/images/icons/Genre.svg',
    '/images/icons/Google_Favicon_2025.svg',
    '/images/icons/History.svg',
    '/images/icons/IconView.svg',
    '/images/icons/Info.svg',
    '/images/icons/LineView.svg',
    '/images/icons/Magnifier.svg',
    '/images/icons/Playlist.svg',
    '/images/icons/Radio.svg',
    '/images/icons/Repeat.svg',
    '/images/icons/RepeatOne.svg',
    '/images/icons/Track.svg',
    '/images/default_cover.png',
    '/images/empty.png',
    '/images/loader.gif',
];
// 1. Install Event: Cache all static assets
sw.addEventListener('install', async (event: Event) => {
    (event as ExtendableEvent).waitUntil((async () => {
        let cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS_TO_CACHE);
        await sw.skipWaiting(); // Force the waiting service worker to become active
    })()); //pass the resuting Promise, not the function.
});

// 2. Activate Event: Clean up old caches if the version changes
sw.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        let cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map((cache) => {
                if (cache === CACHE_NAME)
                    return undefined;
                return caches.delete(cache);
            })
        );
        await sw.clients.claim();
    })());
});

// 3. Fetch Event: Intercept requests and serve from cache if offline
sw.addEventListener('fetch', (event) => {
    // Skip cross-origin requests and non-GET requests (like WebSocket handshakes)
    if (!event.request.url.startsWith(sw.location.origin) || event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // Return the cached asset
            }
            return fetch(event.request); // Fallback to network if not cached
        })
    );
});
