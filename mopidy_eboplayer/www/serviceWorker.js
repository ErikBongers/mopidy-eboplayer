//#region mopidy_eboplayer/www/typescript/serviceWorker.ts
const sw = self;
const CACHE_NAME = "eboplayer-v1";
const ASSETS_TO_CACHE = [
	"index.html",
	"css/global.css",
	"css/webclient.css",
	"generated/bundle.js",
	"manifest.json",
	"images/icons/Album.svg",
	"images/icons/Artist.svg",
	"images/icons/eboplayer-192.png",
	"images/icons/eboplayer-512.png",
	"images/icons/Genre.svg",
	"images/icons/Google_Favicon_2025.svg",
	"images/icons/History.svg",
	"images/icons/IconView.svg",
	"images/icons/Info.svg",
	"images/icons/LineView.svg",
	"images/icons/Magnifier.svg",
	"images/icons/Playlist.svg",
	"images/icons/Radio.svg",
	"images/icons/Repeat.svg",
	"images/icons/RepeatOne.svg",
	"images/icons/Track.svg",
	"images/default_cover.png",
	"images/empty.png",
	"images/loader.gif"
];
sw.addEventListener("install", async (event) => {
	event.waitUntil((async () => {
		await (await caches.open(CACHE_NAME)).addAll(ASSETS_TO_CACHE);
		await sw.skipWaiting();
	})());
});
sw.addEventListener("activate", (event) => {
	event.waitUntil((async () => {
		let cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((cache) => {
			if (cache === CACHE_NAME) return void 0;
			return caches.delete(cache);
		}));
		await sw.clients.claim();
	})());
});
sw.addEventListener("fetch", (event) => {
	if (!event.request.url.startsWith(sw.location.origin) || event.request.method !== "GET") return;
	event.respondWith(caches.match(event.request).then((cachedResponse) => {
		if (cachedResponse) return cachedResponse;
		return fetch(event.request);
	}));
});

//#endregion
//# sourceMappingURL=serviceWorker.js.map