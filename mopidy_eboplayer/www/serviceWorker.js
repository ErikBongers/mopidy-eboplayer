//#region mopidy_eboplayer/www/typescript/def.ts
const EBOBACK_PATH = "/eboback/data/";
const EBOBACK_IMAGES_PATH = "/eboback/image/";
const EBOPLAYER_PATH = "/eboplayer/action/";

//#endregion
//#region mopidy_eboplayer/www/typescript/serviceWorker.ts
const sw = self;
const ASSETS_CACHE_NAME = "assets-cache";
const DATA_CACHE_NAME = "data-cache";
const ASSETS_TO_CACHE = [
	"/eboplayer/index.html",
	"/eboplayer/css/global.css",
	"/eboplayer/css/webclient.css",
	"/eboplayer/generated/bundle.js",
	"/eboplayer/manifest.json",
	"/eboplayer/images/icons/Album.svg",
	"/eboplayer/images/icons/Artist.svg",
	"/eboplayer/images/icons/eboplayer-192.png",
	"/eboplayer/images/icons/eboplayer-512.png",
	"/eboplayer/images/icons/Genre.svg",
	"/eboplayer/images/icons/Google_Favicon_2025.svg",
	"/eboplayer/images/icons/History.svg",
	"/eboplayer/images/icons/IconView.svg",
	"/eboplayer/images/icons/Info.svg",
	"/eboplayer/images/icons/LineView.svg",
	"/eboplayer/images/icons/Magnifier.svg",
	"/eboplayer/images/icons/Playlist.svg",
	"/eboplayer/images/icons/Radio.svg",
	"/eboplayer/images/icons/Repeat.svg",
	"/eboplayer/images/icons/RepeatOne.svg",
	"/eboplayer/images/icons/Track.svg",
	"/eboplayer/images/default_cover.png",
	"/eboplayer/images/empty.png",
	"/eboplayer/images/loader.gif"
];
let assetsSet = new Set(ASSETS_TO_CACHE);
sw.addEventListener("install", async (event) => {
	event.waitUntil((async () => {
		await (await caches.open(ASSETS_CACHE_NAME)).addAll(ASSETS_TO_CACHE);
		await sw.skipWaiting();
	})());
});
sw.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		let cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((cache) => {
			if (cache === ASSETS_CACHE_NAME) return void 0;
			return caches.delete(cache);
		}));
		await sw.clients.claim();
	})());
});
sw.addEventListener("fetch", (event) => {
	if (!event.request.url.startsWith(sw.location.origin) || event.request.method !== "GET") return;
	const url = new URL(event.request.url);
	if (url.pathname.includes(EBOPLAYER_PATH) || url.pathname.includes(EBOBACK_PATH) || url.pathname.includes(EBOBACK_IMAGES_PATH)) {
		event.respondWith(networkFirst(event, DATA_CACHE_NAME)());
		return;
	}
	if (url.pathname.endsWith("bundle.js")) {
		console.log("getting bundle.js");
		event.respondWith(networkFirst(event, ASSETS_CACHE_NAME)());
		return;
	}
	event.respondWith(cacheFirst(event, ASSETS_CACHE_NAME)());
});
function networkFirst(event, cacheName) {
	return async () => {
		try {
			console.log("networkFirst: fetching...");
			const networkResponse = await fetch(event.request);
			if (networkResponse.status === 200) await saveToCache(cacheName, event, networkResponse);
			else return await getCached(/* @__PURE__ */ new Error(`networkFirst: response status ${networkResponse.status}`));
			return networkResponse;
		} catch (error) {
			return await getCached(error);
		}
	};
	async function getCached(error) {
		console.log("networkFirst: got error, returning cached response");
		const cachedResponse = await (await caches.open(cacheName)).match(event.request);
		if (cachedResponse) return cachedResponse;
		throw error;
	}
}
function cacheFirst(event, cacheName) {
	return async () => {
		const cachedResponse = await caches.match(event.request);
		if (cachedResponse) return cachedResponse;
		try {
			const networkResponse = await fetch(event.request);
			if (networkResponse.status === 200) await saveToCache(cacheName, event, networkResponse);
			return networkResponse;
		} catch (error) {
			if (event.request.mode === "navigate") {
				const rootCache = await caches.match("/");
				if (rootCache) return rootCache;
			}
			throw error;
		}
	};
}
async function saveToCache(cacheName, event, networkResponse) {
	(await caches.open(cacheName)).put(event.request, networkResponse.clone());
	if (cacheName == ASSETS_CACHE_NAME) {
		let url = new URL(event.request.url);
		if (!assetsSet.has(url.pathname)) console.warn(`serviceWorker.saveToCache(): static asset not in pre-load list: ${url.pathname}`);
	}
}
sw.addEventListener("message", async (event) => {
	if (event.data?.type === "updateCache") {
		console.log(`Updating cache from ${event.data.oldVersion} to ${event.data.newVersion}`);
		const newCache = await caches.open(ASSETS_CACHE_NAME);
		try {
			await newCache.addAll(ASSETS_TO_CACHE);
			console.log("Core offline assets successfully migrated to new cache.");
		} catch (err) {
			console.error("Failed to pre-cache essential files on version change:", err);
		}
		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((name) => {
			if (name !== ASSETS_CACHE_NAME && name !== DATA_CACHE_NAME) return caches.delete(name);
		}));
	}
});

//#endregion
//# sourceMappingURL=serviceWorker.js.map