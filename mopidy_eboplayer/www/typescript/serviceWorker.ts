/// <reference lib="webworker" />
import {ServiceWorkerMessage} from './messages';

interface ServiceWorkerMessageEvent extends ExtendableMessageEvent {
    readonly data: ServiceWorkerMessage;
}
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "eboplayer-cache";

const ASSETS_TO_CACHE = [
    'index.html',
    'css/global.css',
    'css/webclient.css',
    'generated/bundle.js',
    'manifest.json',
    'images/icons/Album.svg',
    'images/icons/Artist.svg',
    'images/icons/eboplayer-192.png',
    'images/icons/eboplayer-512.png',
    'images/icons/Genre.svg',
    'images/icons/Google_Favicon_2025.svg',
    'images/icons/History.svg',
    'images/icons/IconView.svg',
    'images/icons/Info.svg',
    'images/icons/LineView.svg',
    'images/icons/Magnifier.svg',
    'images/icons/Playlist.svg',
    'images/icons/Radio.svg',
    'images/icons/Repeat.svg',
    'images/icons/RepeatOne.svg',
    'images/icons/Track.svg',
    'images/default_cover.png',
    'images/empty.png',
    'images/loader.gif',
];

sw.addEventListener('install', async (event: Event) => {
    (event as ExtendableEvent).waitUntil((async () => {
        let cache = await caches.open(CACHE_NAME);
        await cache.addAll(ASSETS_TO_CACHE);
        await sw.skipWaiting(); // Force the waiting service worker to become active
    })()); //pass the resuting Promise, not the function.
});

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

sw.addEventListener('fetch', (event) => {
    // Skip cross-origin requests and non-GET requests (like WebSocket handshakes)
    if (!event.request.url.startsWith(sw.location.origin) || event.request.method !== 'GET') {
        return;
    }
    const url = new URL(event.request.url);

    if (url.pathname.endsWith('bundle.js')) {
        console.log('getting bundle.js');
        event.respondWith(
            networkFirst(event)()
        );
        return;
    }

    event.respondWith(
        cacheFirst(event)()
    );
});

function networkFirst(event: FetchEvent) {
    console.log('networkFirst...');

    return async () => {
        try {
            console.log('networkFirst: fetching...');
            const networkResponse = await fetch(event.request);

            if (networkResponse.status === 200) {
                console.log('networkFirst: got via network first, saving in cache');
                const cache = await caches.open(CACHE_NAME);
                // noinspection ES6MissingAwait
                cache.put(event.request, networkResponse.clone());
            } else {
                return await getCached(new Error(`networkFirst: response status ${networkResponse.status}`));
            }
            return networkResponse;
        } catch (error) {
            return await getCached(error);
        }
    };

    async function getCached(error: unknown) {
        console.log('networkFirst: got error, returning cached response');
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        throw error;
    }
}

function cacheFirst(event: FetchEvent) {
    return async () => {
        // Look in all caches (helps bridge migration windows)
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
            const networkResponse = await fetch(event.request);

            if (networkResponse.status === 200) {
                const cache = await caches.open(CACHE_NAME);
                // noinspection ES6MissingAwait
                cache.put(event.request, networkResponse.clone());
            }

            return networkResponse;
        } catch (error) {
            if (event.request.mode === 'navigate') {
                const rootCache = await caches.match('/');
                if (rootCache) return rootCache;
            }
            throw error;
        }
    };
}

sw.addEventListener('message', async (event: ServiceWorkerMessageEvent) => {
    if (event.data?.type === "updateCache") {
        console.log(`Updating cache from ${event.data.oldVersion} to ${event.data.newVersion}`);
        const newCache = await caches.open(CACHE_NAME);
        try {
            await newCache.addAll(ASSETS_TO_CACHE);
            console.log('Core offline assets successfully migrated to new cache.');
        } catch (err) {
            console.error('Failed to pre-cache essential files on version change:', err);
        }

        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(name => {
                if (name !== CACHE_NAME) {
                    return caches.delete(name);
                }
                return;
            })
        );
    }
});
