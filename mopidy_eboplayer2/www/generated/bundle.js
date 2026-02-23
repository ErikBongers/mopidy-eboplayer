//#region mopidy_eboplayer2/www/typescript/eventEmitter.ts
var EventEmitter = class {
	listeners = [];
	supervisors = [];
	emit(eventName, ...data) {
		this.listeners.filter(({ name }) => name === eventName).forEach(({ callback }) => {
			setTimeout(() => callback.call(this, ...data), 0);
		});
		this.supervisors.forEach((callback) => {
			setTimeout(() => callback.call(this, ...data), 0);
		});
	}
	on(name, callback) {
		if (typeof name === "string" && typeof callback === "function") {
			this.listeners.push({
				name,
				callback
			});
			return;
		}
		if (typeof name === "function") this.supervisors.push(name);
	}
	off(eventName, callback) {
		this.removeListener(eventName, callback);
	}
	destroy() {
		this.listeners.length = 0;
	}
	removeAllListeners(eventName) {
		if (!eventName) {
			this.listeners.length = 0;
			return;
		}
		this.listeners = this.listeners.filter((listener) => !(listener.name === eventName));
	}
	removeListener(eventName, callback) {
		this.listeners = this.listeners.filter((listener) => !(listener.name === eventName && listener.callback === callback));
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/jsonrpc.ts
let JsonRpc;
(function(_JsonRpc) {
	function isSuccess$1(response) {
		return Object.hasOwnProperty.call(response, "result");
	}
	_JsonRpc.isSuccess = isSuccess$1;
	function isFailure$1(response) {
		return Object.hasOwnProperty.call(response, "error");
	}
	_JsonRpc.isFailure = isFailure$1;
	function isJsonRpcId(input) {
		switch (typeof input) {
			case "string": return true;
			case "number": return input % 1 != 0;
			case "object": if (input === null) {
				console.warn("Use of null ID in JSONRPC 2.0 is discouraged.");
				return true;
			} else return false;
			default: return false;
		}
	}
	_JsonRpc.isJsonRpcId = isJsonRpcId;
})(JsonRpc || (JsonRpc = {}));

//#endregion
//#region mopidy_eboplayer2/www/typescript/jsonRpcController.ts
var isSuccess = JsonRpc.isSuccess;
var isFailure = JsonRpc.isFailure;
function snakeToCamel(name) {
	return name.replace(/(_[a-z])/g, (match) => match.toUpperCase().replace("_", ""));
}
var JsonRpcController = class JsonRpcController extends EventEmitter {
	_pendingRequests;
	_webSocket;
	currentDelay;
	webSocketUrl;
	backoffDelayMin;
	backoffDelayMax;
	constructor(webSocketUrl, backoffDelayMin, backoffDelayMax) {
		super();
		this.webSocketUrl = webSocketUrl;
		this._pendingRequests = {};
		this._webSocket = null;
		this.currentDelay = backoffDelayMin;
		this.backoffDelayMin = backoffDelayMin;
		this.backoffDelayMax = backoffDelayMax;
		this.hookUpEvents();
	}
	hookUpEvents() {
		this.on("websocket:close", this.onWebSocketClose);
		this.on("websocket:error", this.handleWebSocketError);
		this.on("websocket:incomingMessage", this.handleMessage);
	}
	connect() {
		if (this._webSocket) {
			if (this._webSocket.readyState === WebSocket.OPEN) return;
			this._webSocket.close();
		}
		this._webSocket = new WebSocket(this.webSocketUrl);
		this._webSocket.onclose = (close) => {
			this.emit("websocket:close", close);
		};
		this._webSocket.onerror = (error) => {
			this.emit("websocket:error", error);
		};
		this._webSocket.onopen = () => {
			this.emit("websocket:open");
			this.currentDelay = this.backoffDelayMin;
		};
		this._webSocket.onmessage = (message) => {
			this.emit("websocket:incomingMessage", message);
		};
	}
	onWebSocketClose(closeEvent) {
		Object.keys(this._pendingRequests).forEach((requestId) => {
			const { reject } = this._pendingRequests[requestId];
			delete this._pendingRequests[requestId];
			const error = new ConnectionError("WebSocket closed");
			error.closeEvent = closeEvent;
			reject(error);
		});
		this._reconnect();
	}
	close() {
		this.eventOff("state:offline", this._reconnect);
		if (this._webSocket) this._webSocket.close();
	}
	eventOff(eventName, callback) {
		if (!eventName) {
			this.removeAllListeners();
			return;
		}
		if (!callback) {
			this.removeAllListeners(eventName);
			return;
		}
		this.removeListener(eventName, callback);
	}
	handleWebSocketError(error) {
		console.warn("WebSocket error:", error.stack || error);
	}
	send(message, type = "rpc") {
		switch (this._webSocket?.readyState) {
			case WebSocket.CONNECTING: return Promise.reject(new ConnectionError("WebSocket is still connecting"));
			case WebSocket.CLOSING: return Promise.reject(new ConnectionError("WebSocket is closing"));
			case WebSocket.CLOSED: return Promise.reject(new ConnectionError("WebSocket is closed"));
			default:
				if (type === "fireAndForget") {
					this._webSocket?.send(JSON.stringify(message));
					return Promise.resolve();
				}
				return new Promise((resolve, reject) => {
					const jsonRpcMessage = {
						...message,
						jsonrpc: "2.0",
						id: this._nextRequestId()
					};
					this._pendingRequests[jsonRpcMessage.id] = {
						resolve,
						reject
					};
					this._webSocket?.send(JSON.stringify(jsonRpcMessage));
					this.emit("websocket:outgoingMessage", jsonRpcMessage);
				});
		}
	}
	handleMessage(message) {
		try {
			const data = JSON.parse(message.data);
			if (Object.hasOwnProperty.call(data, "id")) this.handleRpcResponse(data);
			else if (Object.hasOwnProperty.call(data, "event")) this.handleEvent(data);
			else console.warn(`Unknown message type received. Message was: ${message.data}`);
		} catch (error) {
			if (error instanceof SyntaxError) console.warn(`WebSocket message parsing failed. Message was: ${message.data}`);
			else throw error;
		}
	}
	handleRpcResponse(responseMessage) {
		if (!Object.hasOwnProperty.call(this._pendingRequests, responseMessage.id)) {
			console.warn("Unexpected response received. Message was:", responseMessage);
			return;
		}
		const { resolve, reject } = this._pendingRequests[responseMessage.id];
		delete this._pendingRequests[responseMessage.id];
		if (isSuccess(responseMessage)) resolve(responseMessage.result);
		else if (isFailure(responseMessage)) {
			const error = new ServerError(responseMessage.error.message);
			error.code = responseMessage.error.code;
			error.data = responseMessage.error.data;
			reject(error);
			console.warn("Server returned error:", responseMessage.error);
		} else {
			const error = new OtherError("Response without 'result' or 'error' received");
			error.data = { response: responseMessage };
			reject(error);
			console.warn("Response without 'result' or 'error' received. Message was:", responseMessage);
		}
	}
	handleEvent(eventMessage) {
		const data = { ...eventMessage };
		delete data.event;
		const eventName = `event:${snakeToCamel(eventMessage.event)}`;
		this.emit("event", [eventName, data]);
		this.emit(eventName, data);
	}
	static idCounter = -1;
	_nextRequestId() {
		return ++JsonRpcController.idCounter;
	}
	_reconnect() {
		setTimeout(() => {
			this.emit("state", ["reconnectionPending", { timeToAttempt: this.currentDelay }]);
			this.emit("reconnectionPending", { timeToAttempt: this.currentDelay });
			setTimeout(() => {
				this.emit("state", "reconnecting");
				this.emit("reconnecting");
				this.connect();
			}, this.currentDelay);
			this.currentDelay *= 2;
			if (this.currentDelay > this.backoffDelayMax) this.currentDelay = this.backoffDelayMax;
		}, 0);
	}
};
var ConnectionError = class extends Error {
	closeEvent;
	constructor(message) {
		super(message);
		this.name = "ConnectionError";
	}
};
var ServerError = class extends Error {
	code;
	data;
	constructor(message) {
		super(message);
		this.name = "ServerError";
	}
};
var OtherError = class extends Error {
	data;
	constructor(message) {
		super(message);
		this.name = "OtherError";
	}
};

//#endregion
//#region mopidy_eboplayer2/www/js/mopidy.ts
let models;
(function(_models) {
	class TlTrack {
		tlid;
		track;
	}
	_models.TlTrack = TlTrack;
	class Track {
		uri;
		name;
		artists;
		album;
		composers;
		performers;
		genre;
		track_no;
		disc_no;
		date;
		length;
		bitrate;
		comment;
		musicbrainz_id;
		last_modified;
	}
	_models.Track = Track;
	class SearchResult {
		uri;
		tracks;
		artists;
		albums;
	}
	_models.SearchResult = SearchResult;
	class Artist {
		uri;
		name;
		sortname;
		musicbrainz_id;
	}
	_models.Artist = Artist;
	class Album {
		uri;
		name;
		artists;
		num_tracks;
		num_discs;
		date;
		musicbrainz_id;
	}
	_models.Album = Album;
	class Image {
		uri;
		width;
		height;
	}
	_models.Image = Image;
	class Playlist {
		uri;
		name;
		tracks;
		last_modified;
		length;
	}
	_models.Playlist = Playlist;
	class Ref {
		uri;
		name;
		type;
	}
	_models.Ref = Ref;
})(models || (models = {}));
var Mopidy = class {
	_options;
	rpcController;
	constructor(options) {
		this._options = this._configure(options);
		this.rpcController = new JsonRpcController(this._options.webSocketUrl, this._options.backoffDelayMin, this._options.backoffDelayMax);
		this._delegateEvents();
		if (this._options.autoConnect) this.connect();
	}
	connect() {
		this.rpcController.connect();
	}
	on(name, callback) {
		this.rpcController?.on(name, callback);
	}
	_configure(options) {
		let defaultOptions = {
			backoffDelayMin: 1e3,
			backoffDelayMax: 64e3,
			autoConnect: true,
			webSocketUrl: this.resolveWebSocketUrl(options)
		};
		return {
			webSocketUrl: options.webSocketUrl ?? defaultOptions.webSocketUrl,
			autoConnect: options.autoConnect ?? defaultOptions.autoConnect,
			backoffDelayMin: options.backoffDelayMin ?? defaultOptions.backoffDelayMin,
			backoffDelayMax: options.backoffDelayMax ?? defaultOptions.backoffDelayMax
		};
	}
	resolveWebSocketUrl(options) {
		if (options.webSocketUrl) return options.webSocketUrl;
		let protocol = typeof document !== "undefined" && document.location.protocol === "https:" ? "wss://" : "ws://";
		let currentHost = typeof document !== "undefined" && document.location.host || "localhost";
		return `${protocol}${currentHost}/mopidy/ws`;
	}
	_delegateEvents() {
		this.rpcController.on("websocket:close", (closeEvent) => this.onWebSocketClose(closeEvent));
		this.rpcController.on("websocket:open", () => this._onWebsocketOpen());
	}
	onWebSocketClose(closeEvent) {
		this.rpcController.emit("state", "state:offline");
		this.rpcController.emit("state:offline");
	}
	close() {
		if (this.rpcController) this.rpcController.close();
	}
	send(method, params) {
		if (params) return this.rpcController?.send({
			method,
			params
		});
		else return this.rpcController?.send({ method });
	}
	_onWebsocketOpen() {
		this.rpcController.emit("state", "state:online");
		this.rpcController.emit("state:online");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/global.ts
function stretchLeft(x, min, max) {
	return x * (max + min) / max - min;
}
function quadratic100(x) {
	x = stretchLeft(x, -5, 100);
	return x * x / 100;
}
function inverseQuadratic100(y) {
	let x = Math.floor(Math.sqrt(y * 100));
	return stretchLeft(x, 5, 100);
}
function getHostAndPort() {
	let hostDefs = getHostAndPortDefs();
	return hostDefs.altHost ?? hostDefs.host;
}
function getBaseUrl() {
	return `http://${getHostAndPort()}`;
}
function getHostAndPortDefs() {
	let altHostName = document.body.dataset.hostname ?? null;
	if (altHostName?.startsWith("{{")) altHostName = null;
	if (!altHostName) altHostName = localStorage.getItem("eboplayer.hostName");
	return {
		host: document.location.host,
		altHost: altHostName
	};
}
function isStream(track) {
	return !track.last_modified;
}
function unreachable(x) {
	throw new Error("This error will never be thrown. It is used for type safety.");
}
function arrayToggle(arr, item) {
	if (arr.includes(item)) return arr.filter((i) => i !== item);
	else return [...arr, item];
}
function getDefaultImageUrl(refType, defaultImageUrl) {
	if (defaultImageUrl) return defaultImageUrl;
	switch (refType) {
		case "album": return "images/icons/Album.svg";
		case "artist": return "images/icons/Artist.svg";
		case "playlist": return "images/icons/Playlist.svg";
		case "track": return "images/icons/Album.svg";
		case "radio": return "images/icons/Radio.svg";
		case "genre": return "images/icons/Genre.svg";
		default: unreachable(refType);
	}
}
function escapeGoogleSearchString(albumName) {
	return albumName.replaceAll("+", "%2B").replaceAll("\n", "+").replaceAll(" ", "+").replaceAll("'", "%27").replaceAll("&", "%26").replaceAll("(", "%28").replaceAll(")", "%29").replaceAll(":", "%3A").replaceAll("!", "%21").replaceAll("?", "%3F").replaceAll("|", "%7C").replaceAll("=", "%3D");
}
function searchOnGoogle(albumName) {
	let escaped = escapeGoogleSearchString(albumName);
	window.open("https://www.google.com/search?q=" + escaped, "_blank")?.focus();
}
function searchImageOnGoogle(albumName) {
	let escaped = escapeGoogleSearchString(albumName);
	window.open("https://www.google.com/search?tbm=isch&q=" + escaped, "_blank")?.focus();
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/refs.ts
var SearchResultParent = class {
	type;
	item;
	weight;
	defaultImageUrl;
	constructor(type, item, weight, defaultImageUrl) {
		this.type = type;
		this.item = item;
		this.weight = weight;
		this.defaultImageUrl = defaultImageUrl;
	}
	getImageUrl() {
		if (this.item.idMaxImage) return getBaseUrl() + "/eboback/image/" + this.item.idMaxImage;
		return this.defaultImageUrl ?? "--no default image url--";
	}
};
var RefSearchResult = class extends SearchResultParent {
	cache;
	constructor(item, weight, cache, defaultImageUrl) {
		super("ref", item, weight, getDefaultImageUrl(item.refType, defaultImageUrl));
		this.cache = cache;
	}
};
var GenreSearchResult = class extends SearchResultParent {
	cache;
	constructor(item, weight, cache, imageUrl) {
		super("genreReplacement", item, weight, "images/icons/Genre.svg");
		this.cache = cache;
	}
	getExpandedModel() {
		return this.cache.getGenreReplacementCached(this.item.name ?? "???");
	}
};
const EmptySearchResults = {
	refs: [],
	availableRefTypes: /* @__PURE__ */ new Set()
};
var Refs = class {
	searchResults;
	get browseFilter() {
		return this._browseFilter;
	}
	constructor() {
		this.searchResults = {
			refs: [],
			availableRefTypes: /* @__PURE__ */ new Set()
		};
	}
	set browseFilter(value) {
		this._browseFilter = value;
	}
	_browseFilter;
	async calculateWeight(result, browseFilter, thresholdDate) {
		if (!browseFilter.isNoTypeSelected()) {
			if (result instanceof RefSearchResult) {
				if (result.item.refType == "album" && !browseFilter.album || result.item.refType == "track" && !browseFilter.track || result.item.refType == "artist" && !browseFilter.artist || result.item.refType == "playlist" && !browseFilter.playlist || result.item.refType == "radio" && !browseFilter.radio) return;
			}
			if (result instanceof GenreSearchResult && !browseFilter.genre) return;
		}
		if (result.item.name?.toLowerCase().startsWith(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (result.item.name?.toLowerCase().includes(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (!browseFilter.searchText) result.weight += 1;
		if (result.weight == 0) return;
		if (browseFilter.addedSince == 0) return;
		if (!(result instanceof RefSearchResult)) {
			result.weight = 0;
			return;
		}
		if (browseFilter.addedSince == 0) return;
		if ((browseFilter.album || browseFilter.isNoTypeSelected()) && result.item.refType == "album") this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
		if ((browseFilter.track || browseFilter.isNoTypeSelected()) && result.item.refType == "track") this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
		if (browseFilter.addedSince > 0 && result.item.refType != "album" && result.item.refType != "track") result.weight = 0;
	}
	calculateDateFilter(modifiedDate, result, browseFilter, thresholdDate) {
		if (!modifiedDate) return;
		modifiedDate /= 1e3;
		if (thresholdDate > modifiedDate) result.weight = 0;
	}
	setFilter(browseFilter) {
		this._browseFilter = browseFilter;
	}
	async applyFilter(searchResults) {
		searchResults.forEach((result) => {
			result.weight = 0;
		});
		let currentPosixDate = Math.floor(Date.now() / 1e3);
		let addedSinceInSeconds = this.browseFilter.addedSince * 60 * 60 * 24;
		let thresholdDate = currentPosixDate - addedSinceInSeconds;
		for (const result of searchResults) await this.calculateWeight(result, this.browseFilter, thresholdDate);
		return searchResults.filter((result) => result.weight > 0).sort((a, b) => {
			if (b.weight === a.weight) return a.item.name?.localeCompare(b.item.name ?? "") ?? 0;
			return b.weight - a.weight;
		});
	}
	getSearchResults() {
		return this.searchResults;
	}
	getAvailableRefTypes(refs) {
		return refs.map((r) => r instanceof RefSearchResult ? r.item.refType : "genre").reduce((typeSet, val) => typeSet.add(val), /* @__PURE__ */ new Set());
	}
	static toRefType(ref) {
		if (!["directory", "track"].includes(ref.type)) return ref.type;
		if (ref.uri.startsWith("eboback:stream:")) return "radio";
		if (ref.uri.startsWith("eboback:directory?genre")) return "genre";
		return ref.type;
	}
	static async transformRefsToSearchResults(cache, refs) {
		let refMap = await cache.getAllRefsMapCached();
		let results = refs.map(async (ref) => {
			let refType = SomeRefs.toRefType(ref);
			if (refType == "genre") {
				let expandedRef$1 = {
					refType,
					name: ref.name ?? "???",
					uri: ref.uri,
					lastModified: null,
					idMaxImage: null,
					idMinImage: null
				};
				return new GenreSearchResult(expandedRef$1, -1, cache);
			}
			let expandedRef = refMap.get(ref.uri);
			if (!expandedRef) expandedRef = {
				refType,
				name: ref.name ?? "???",
				uri: ref.uri,
				lastModified: null,
				idMaxImage: null,
				idMinImage: null
			};
			return new RefSearchResult(expandedRef, -1, cache);
		});
		return Promise.all(results);
	}
	static async reduceResults(results) {
		let resultsWithoutGenreDefs = results.filter((result) => !(result instanceof GenreSearchResult));
		let onlyGenreDefResults = results.filter((result) => result instanceof GenreSearchResult);
		let onlyWithoutReplacementResults = (await Promise.all(onlyGenreDefResults.map(async (r) => {
			return {
				result: r,
				genreReplacement: await r.getExpandedModel()
			};
		}))).filter((r) => r.genreReplacement != null && r.genreReplacement.replacement == null).map((r) => r.result);
		let onlyWithoutReplacementResultsMap = /* @__PURE__ */ new Map();
		onlyWithoutReplacementResults.forEach((result) => {
			onlyWithoutReplacementResultsMap.set(result.item.name ?? "???", result);
		});
		for (const result of onlyGenreDefResults) {
			let name;
			let def = await result.getExpandedModel();
			if (def?.replacement != null) name = def.replacement;
			else name = result.item.name ?? "???";
			if (!onlyWithoutReplacementResultsMap.has(name)) onlyWithoutReplacementResultsMap.set(name, result);
		}
		return [...resultsWithoutGenreDefs, ...Array.from(onlyWithoutReplacementResultsMap.values())];
	}
};
async function createAllRefs(cache, allRefs) {
	return new AllRefs(cache, allRefs);
}
function filterRefsToResult(refs, refType, cache) {
	return refs.filter((ref) => ref.refType == refType).map((expandedRef) => {
		return new RefSearchResult(expandedRef, 0, cache);
	});
}
var AllRefs = class extends Refs {
	allRefs;
	tracks;
	albums;
	artists;
	genres;
	radios;
	playlists;
	availableRefTypes;
	constructor(cache, allRefs) {
		super();
		this.allRefs = allRefs;
		this.tracks = filterRefsToResult(allRefs, "track", cache);
		this.albums = filterRefsToResult(allRefs, "album", cache);
		this.artists = filterRefsToResult(allRefs, "artist", cache);
		this.radios = filterRefsToResult(allRefs, "radio", cache);
		this.genres = allRefs.filter((ref) => ref.refType == "genre").map((expandedRef) => {
			return new GenreSearchResult(expandedRef, 0, cache);
		});
		this.playlists = filterRefsToResult(allRefs, "playlist", cache);
		this.availableRefTypes = /* @__PURE__ */ new Set();
		this.getAvailableRefTypes(this.tracks).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.albums).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.artists).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.radios).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.genres).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.playlists).forEach((type) => this.availableRefTypes.add(type));
	}
	async filter() {
		this.searchResults = {
			refs: await this.applyFilter(this.prefillWithTypes(this.browseFilter)),
			availableRefTypes: this.availableRefTypes
		};
	}
	prefillWithTypes(browseFilter) {
		let refs = [];
		if (browseFilter.album || browseFilter.isNoTypeSelected()) refs.push(...this.albums);
		if (browseFilter.artist || browseFilter.isNoTypeSelected()) refs.push(...this.artists);
		if (browseFilter.track || browseFilter.isNoTypeSelected()) refs.push(...this.tracks);
		if (browseFilter.genre || browseFilter.isNoTypeSelected()) refs.push(...this.genres);
		if (browseFilter.radio || browseFilter.isNoTypeSelected()) refs.push(...this.radios);
		if (browseFilter.playlist || browseFilter.isNoTypeSelected()) refs.push(...this.playlists);
		return refs;
	}
};
var SomeRefs = class extends Refs {
	allresults;
	availableRefTypes;
	constructor(results) {
		super();
		this.allresults = results;
		this.availableRefTypes = this.getAvailableRefTypes(this.allresults);
	}
	async filter() {
		this.searchResults = {
			refs: await this.applyFilter(this.allresults),
			availableRefTypes: this.availableRefTypes
		};
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/util/idStack.ts
var IdStack = class extends Array {
	resetTo(id) {
		let index = this.findIndex((breadCrumb, index$1, obj) => {
			return breadCrumb.id == id;
		});
		this.splice(index + 1);
	}
	getLast() {
		return this[this.length - 1];
	}
	get(id) {
		return this.find((crumb) => crumb.id == id);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/breadCrumb.ts
var BreadCrumb = class BreadCrumb {
	id;
	label;
	data;
	type;
	static nextId = 1;
	constructor(label, value, type) {
		this.label = label;
		this.data = value;
		this.id = BreadCrumb.nextId++;
		this.type = type;
	}
};
var BreadCrumbStack = class extends IdStack {};

//#endregion
//#region mopidy_eboplayer2/www/typescript/modelTypes.ts
var BrowseFilterBreadCrumb = class extends BreadCrumb {
	constructor(label, filter, type) {
		super(label, filter, type);
	}
};
var BreadCrumbHome = class extends BrowseFilterBreadCrumb {
	constructor() {
		super("Home", null, "home");
	}
};
var BreadCrumbBrowseFilter = class extends BrowseFilterBreadCrumb {
	constructor(label, filter) {
		super(label, filter, "browseFilter");
	}
};
var BreadCrumbRef = class extends BrowseFilterBreadCrumb {
	constructor(label, ref) {
		super(label, ref, "ref");
	}
};
function isBreadCrumbForAlbum(breadCrumb) {
	return breadCrumb.data.type == "album";
}
var BrowseFilter = class {
	searchText;
	album;
	track;
	radio;
	artist;
	playlist;
	genre;
	addedSince;
	constructor() {
		this.searchText = "";
		this.track = false;
		this.artist = false;
		this.genre = false;
		this.radio = false;
		this.playlist = false;
		this.album = false;
		this.addedSince = 0;
	}
	isNoTypeSelected() {
		return !(this.album || this.track || this.radio || this.artist || this.playlist || this.genre);
	}
	isAllTypesSelected() {
		return this.album && this.track && this.radio && this.artist && this.playlist && this.genre;
	}
	getSelectedFilters() {
		return [
			"album",
			"track",
			"radio",
			"artist",
			"playlist",
			"genre"
		].filter((key) => this[key] == true);
	}
	isEmpty() {
		return (this.isNoTypeSelected() || this.isAllTypesSelected()) && this.searchText == "";
	}
};
const TrackNone = { type: "none" };
var ExpandedFileTrackModel = class {
	track;
	album;
	controller;
	constructor(track, album, controller) {
		this.track = track;
		this.album = album;
		this.controller = controller;
	}
	get bigImageUrl() {
		return getBaseUrl() + "/eboback/image/" + this.track.ref.idMaxImage;
	}
	async isFavorite() {
		return await this.controller.isFavorite(this.track.ref.uri);
	}
};
var ExpandedStreamModel = class {
	stream;
	controller;
	constructor(stream, controller) {
		this.stream = stream;
		this.controller = controller;
	}
	get bigImageUrl() {
		return getBaseUrl() + "/eboback/image/" + (this.stream.ref?.idMaxImage ?? "-- no expanded ref or image --");
	}
	isFavorite() {
		return this.controller.isFavorite(this.stream.ref.uri);
	}
	getStreamLinesHistory() {
		return this.controller.cache.getExpandedStreamLines(this.stream.ref.uri);
	}
};
var ExpandedAlbumModel = class {
	album;
	meta;
	controller;
	constructor(album, controller, meta) {
		this.album = album;
		this.controller = controller;
		this.meta = meta;
	}
	get bigImageUrl() {
		if (this.album.ref.idMaxImage) return getBaseUrl() + "/eboback/image/" + this.album.ref.idMaxImage;
		return getDefaultImageUrl(this.album.ref.refType);
	}
	async isFavorite() {
		return await this.controller.isFavorite(this.album.ref.uri);
	}
	async getTrackModels() {
		let trackModels = [];
		for (let trackUri of this.album.tracks) {
			let model = await this.controller.cache.lookupTrackCached(trackUri);
			if (model) trackModels.push(model);
		}
		return trackModels;
	}
	async isTrackFavorite(uri) {
		return this.controller.isFavorite(uri);
	}
	async getGenreReplacements() {
		let trackModels = await this.getTrackModels();
		let genreDefPromises = [...new Set(trackModels.filter((track) => track.track.genre != void 0).map((track) => track.track.genre))].map(async (genre) => (await this.controller.cache.getGenreReplacementsCached()).get(genre)).filter((genre) => genre != void 0);
		return Promise.all(genreDefPromises);
	}
	async getArtists() {
		let trackModels = await this.getTrackModels();
		let artistMap = /* @__PURE__ */ new Map();
		trackModels.map((track) => track.track.artists ?? []).flat().forEach((artist) => artistMap.set(artist.name, artist));
		return [...artistMap.values()];
	}
	async getComposers() {
		let trackModels = await this.getTrackModels();
		let artistMap = /* @__PURE__ */ new Map();
		trackModels.map((track) => track.track.composers ?? []).flat().forEach((artist) => artistMap.set(artist.name, artist));
		return [...artistMap.values()];
	}
	async getAllDetails() {
		let all = await Promise.all([
			this.getTrackModels(),
			this.getArtists(),
			this.getComposers(),
			this.getGenreReplacements()
		]);
		return {
			tracks: all[0],
			artists: all[1],
			composers: all[2],
			genreDefs: all[3]
		};
	}
};
function isInstanceOfExpandedStreamModel(model) {
	if (!model) return false;
	return "stream" in model;
}
function isInstanceOfExpandedTrackModel(model) {
	if (!model) return false;
	return "track" in model;
}
let ConnectionState = /* @__PURE__ */ function(ConnectionState$1) {
	ConnectionState$1[ConnectionState$1["Offline"] = 0] = "Offline";
	ConnectionState$1[ConnectionState$1["Online"] = 1] = "Online";
	return ConnectionState$1;
}({});
let MessageType = /* @__PURE__ */ function(MessageType$1) {
	MessageType$1[MessageType$1["None"] = 0] = "None";
	MessageType$1[MessageType$1["Info"] = 1] = "Info";
	MessageType$1[MessageType$1["Warning"] = 2] = "Warning";
	MessageType$1[MessageType$1["Error"] = 3] = "Error";
	return MessageType$1;
}({});
const NoStreamTitles = {
	uri: "",
	active_titles: []
};
let AlbumDataType = /* @__PURE__ */ function(AlbumDataType$1) {
	AlbumDataType$1[AlbumDataType$1["None"] = 0] = "None";
	AlbumDataType$1[AlbumDataType$1["Loading"] = 1] = "Loading";
	AlbumDataType$1[AlbumDataType$1["Loaded"] = 2] = "Loaded";
	AlbumDataType$1[AlbumDataType$1["StreamLinesLoaded"] = 3] = "StreamLinesLoaded";
	return AlbumDataType$1;
}({});
const AlbumNone = { type: AlbumDataType.None };
let Views = /* @__PURE__ */ function(Views$1) {
	Views$1["NowPlaying"] = "#NowPlaying";
	Views$1["Browse"] = "#Browse";
	Views$1["Album"] = "#Album";
	Views$1["Settings"] = "#Settings";
	Views$1["WhatsNew"] = "#WhatsNew";
	Views$1["Remembered"] = "#Remembered";
	Views$1["Genres"] = "#Genres";
	Views$1["Radio"] = "#Radio";
	return Views$1;
}({});

//#endregion
//#region mopidy_eboplayer2/www/typescript/events.ts
function createEvent(event, detail) {
	return new CustomEvent(event, {
		detail,
		bubbles: true,
		composed: true,
		cancelable: true
	});
}
var EboEventTargetClass = class extends EventTarget {
	dispatchEboEvent(key, args) {
		return super.dispatchEvent(createEvent(key, args));
	}
	addEboEventListener(type, listener, options) {
		super.addEventListener(type, listener, options);
	}
};
function addEboEventListener(target, type, listener, options) {
	target.addEventListener(type, listener, options);
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/model.ts
var BrowseFilterBreadCrumbStack = class extends BreadCrumbStack {};
var Model = class extends EboEventTargetClass {
	currentTrack = null;
	selectedTrack = null;
	volume;
	connectionState = ConnectionState.Offline;
	currentMessage = {
		type: MessageType.None,
		message: ""
	};
	tempMessage = {
		type: MessageType.None,
		message: ""
	};
	playbackMode = {
		repeat: false,
		random: false,
		consume: false,
		single: false
	};
	playState = null;
	activeStreamLines;
	history;
	trackList = [];
	libraryCache = /* @__PURE__ */ new Map();
	imageCache = /* @__PURE__ */ new Map();
	metaCache = /* @__PURE__ */ new Map();
	currentBrowseFilter = new BrowseFilter();
	filterBreadCrumbStack = new BrowseFilterBreadCrumbStack();
	genreReplacements = /* @__PURE__ */ new Map();
	genreDefs = [];
	currentProgramTitle = "";
	allRefs = null;
	currentRefs = null;
	view = Views.NowPlaying;
	albumToView = null;
	remembers = null;
	scanStatus = "";
	allRefsMap = null;
	favorites = null;
	radioToView = null;
	streamLinesHistory = /* @__PURE__ */ new Map();
	favoritesPlaylistName = null;
	constructor() {
		super();
		this.initializeBreadcrumbStack();
	}
	getScanStatus = () => this.scanStatus;
	getCurrentProgramTitle() {
		return this.currentProgramTitle;
	}
	setCurrentProgramTitle(title) {
		this.currentProgramTitle = title;
		this.dispatchEboEvent("programTitleChanged.eboplayer", {});
	}
	setGenreReplacements(defs) {
		this.genreReplacements = /* @__PURE__ */ new Map();
		for (let def of defs) this.genreReplacements.set(def.ref.name ?? "???", def);
		this.dispatchEboEvent("genreReplacementsChanged.eboplayer", {});
	}
	getGenreReplacements = () => this.genreReplacements;
	pushBreadCrumb(crumb, dispatch = "dispatch") {
		this.filterBreadCrumbStack.push(crumb);
		if (dispatch == "dispatch") this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
	}
	popBreadCrumb() {
		let crumb = this.filterBreadCrumbStack.pop();
		this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
		return crumb;
	}
	getBreadCrumbs = () => this.filterBreadCrumbStack;
	resetBreadCrumbsTo(id) {
		this.filterBreadCrumbStack.resetTo(id);
		this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
	}
	initializeBreadcrumbStack() {
		this.filterBreadCrumbStack.length = 0;
		this.filterBreadCrumbStack.push(new BreadCrumbHome());
	}
	clearBreadCrumbs() {
		this.initializeBreadcrumbStack();
		this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
	}
	setAllRefs(refs) {
		this.allRefs = refs;
		this.allRefsMap = new Map(refs.allRefs.map((res) => [res.uri, res]));
	}
	getCurrentSearchResults() {
		return this.currentRefs?.getSearchResults() ?? EmptySearchResults;
	}
	getAllRefs = () => this.allRefs;
	getAllRefsMap = () => this.allRefsMap;
	async filterCurrentRefs() {
		if (!this.currentRefs) return;
		this.currentRefs.browseFilter = this.currentBrowseFilter;
		await this.currentRefs.filter();
		this.dispatchEboEvent("refsFiltered.eboplayer", {});
	}
	getImageFromCache(uri) {
		return this.imageCache.get(uri);
	}
	addImageToCache(uri, image) {
		this.imageCache.set(uri, image);
	}
	addImagesToCache(map) {
		for (let [uri, image] of map) this.addImageToCache(uri, image);
	}
	setConnectionState(state) {
		this.connectionState = state;
		if (this.connectionState == ConnectionState.Online) this.clearMessage();
		else this.setErrorMessage("Offline");
		this.dispatchEboEvent("connectionChanged.eboplayer", {});
	}
	getConnectionState = () => this.connectionState;
	getCachedInfo(uri) {
		return this.libraryCache.get(uri) ?? null;
	}
	getCurrentBrowseFilter = () => this.currentBrowseFilter;
	setCurrentBrowseFilter(browseFilter) {
		this.currentBrowseFilter = browseFilter;
		this.dispatchEboEvent("modelBrowseFilterChanged.eboplayer", {});
	}
	setBrowseFilterBreadCrumbs(breadCrumbStack) {
		this.filterBreadCrumbStack.length = 0;
		this.filterBreadCrumbStack.push(...breadCrumbStack);
		this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
	}
	getCurrentTrack() {
		return this.currentTrack;
	}
	setCurrentTrack(track) {
		if (track?.type == "none") {
			this.currentTrack = null;
			return;
		}
		this.currentTrack = track?.track?.uri ?? null;
		if (this.currentTrack) this.addToLibraryCache(this.currentTrack, track);
		this.dispatchEboEvent("currentTrackChanged.eboplayer", {});
	}
	getSelectedTrack = () => this.selectedTrack;
	setSelectedTrack(uri) {
		if (uri == "") this.selectedTrack = null;
		else this.selectedTrack = uri;
		this.dispatchEboEvent("selectedTrackChanged.eboplayer", {});
	}
	setVolume(volume) {
		this.volume = volume;
		this.dispatchEboEvent("volumeChanged.eboplayer", {});
	}
	setMessage(message) {
		this.currentMessage = message;
		this.dispatchEboEvent("messageChanged.eboplayer", {});
	}
	getCurrentMessage = () => this.currentMessage;
	setTempMessage(message) {
		this.tempMessage = message;
		this.dispatchEboEvent("tempMessageChanged.eboplayer", {});
		window.setTimeout(() => this.clearTempMessage(), 3 * 1e3);
	}
	getTempMessage = () => this.tempMessage;
	clearTempMessage() {
		this.tempMessage = {
			type: MessageType.None,
			message: ""
		};
		this.dispatchEboEvent("tempMessageChanged.eboplayer", {});
	}
	clearMessage() {
		this.setMessage({
			type: MessageType.None,
			message: ""
		});
	}
	setInfoMessage(message) {
		this.setMessage({
			type: MessageType.Info,
			message
		});
	}
	setWarningMessage(message) {
		this.setMessage({
			type: MessageType.Warning,
			message
		});
	}
	setErrorMessage(message) {
		this.setMessage({
			type: MessageType.Error,
			message
		});
	}
	setPlaybackMode(state) {
		this.playbackMode = { ...state };
		this.dispatchEboEvent("playbackModeChanged.eboplayer", {});
	}
	getPlaybackMode = () => this.playbackMode;
	getVolume = () => this.volume;
	getPlayState() {
		return this.playState;
	}
	setPlayState(state) {
		this.playState = state;
		this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
	}
	setActiveStreamLines(streamTitles) {
		this.activeStreamLines = streamTitles;
		this.dispatchEboEvent("activeStreamLinesChanged.eboplayer", {});
	}
	getActiveStreamLines = () => this.activeStreamLines;
	setHistory(history) {
		this.history = history;
		this.dispatchEboEvent("historyChanged.eboplayer", {});
	}
	getHistory = () => this.history;
	setTrackList(trackList) {
		this.trackList = trackList;
		this.dispatchEboEvent("trackListChanged.eboplayer", {});
	}
	addToTrackList(trackList) {
		this.trackList.push(...trackList);
		this.dispatchEboEvent("trackListChanged.eboplayer", {});
	}
	getTrackList = () => this.trackList;
	addToLibraryCache(uri, item) {
		if (!this.libraryCache.has(uri)) this.libraryCache.set(uri, item);
	}
	addToMetaCache(albumUri, item) {
		if (!this.metaCache.has(albumUri)) this.metaCache.set(albumUri, { meta: item });
	}
	getFromMetaCache(albumUri) {
		return this.metaCache.get(albumUri);
	}
	updateLibraryCache(uri, item) {
		this.libraryCache.set(uri, item);
	}
	addItemsToLibraryCache(items) {
		for (let item of items) if (item.type == "album") {
			if (item.albumInfo) this.updateLibraryCache(item.albumInfo.uri, item);
		} else this.updateLibraryCache(item.track.uri, item);
	}
	getFromLibraryCache(uri) {
		return this.libraryCache.get(uri) ?? null;
	}
	setCurrentRefs(refs) {
		this.currentRefs = refs;
		this.dispatchEboEvent("currentRefsLoaded.eboplayer", {});
	}
	setView(view) {
		this.view = view;
		this.dispatchEboEvent("viewChanged.eboplayer", {});
	}
	getView = () => this.view;
	setAlbumToView(uri, selectedTrackUri) {
		this.albumToView = {
			albumUri: uri,
			selectedTrackUri
		};
		this.dispatchEboEvent("albumToViewChanged.eboplayer", {});
	}
	getAlbumToView = () => this.albumToView;
	setRemembers(remembers) {
		this.remembers = remembers;
		this.dispatchEboEvent("remembersChanged.eboplayer", {});
	}
	getRemembers = () => this.remembers;
	setScanStatus(status) {
		this.scanStatus = status;
		this.dispatchEboEvent("scanStatusChanged.eboplayer", { text: status });
	}
	getGenreDefs = () => this.genreDefs;
	setGenreDefs(genreDefs) {
		this.genreDefs = genreDefs;
		this.dispatchEboEvent("genreDefsChanged.eboplayer", {});
	}
	getFavorites = () => this.favorites;
	setFavorites(favorites) {
		if (favorites == null) {
			this.favorites = null;
			return;
		}
		this.favorites = new Set(favorites);
		this.dispatchEboEvent("favoritesChanged.eboplayer", {});
	}
	getRadioToView = () => this.radioToView;
	setRadioToView(radioUri) {
		this.radioToView = radioUri;
		this.dispatchEboEvent("currentRadioChanged.eboplayer", {});
	}
	getStreamLinesHistory(streamUri) {
		return this.streamLinesHistory.get(streamUri) ?? null;
	}
	setStreamLinesHistory(streamUri, history) {
		this.streamLinesHistory.set(streamUri, history);
		this.dispatchEboEvent("streamLinesHistoryChanged.eboplayer", { "uri": streamUri });
	}
	setFavoritesPlaylistName(name) {
		this.favoritesPlaylistName = name;
	}
	getFavoritesPlaylistName = () => this.favoritesPlaylistName;
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/view.ts
var View = class {
	state;
	_children = [];
	constructor(state) {
		this.state = state;
	}
	addChildren(...children) {
		this._children.push(...children);
	}
	get children() {
		return this._children;
	}
	bindRecursive() {
		this.children.forEach((child) => child.bindRecursive());
		this.bind();
	}
};
var ComponentView = class extends View {
	component;
	constructor(state, component) {
		super(state);
		this.component = component;
	}
	on(type, listener, options) {
		this.component.addEboEventListener(type, listener, options);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/headerView.ts
var HeaderView = class extends View {
	bind() {
		this.state.getModel().addEboEventListener("messageChanged.eboplayer", () => {
			this.onMessageChanged();
		});
		this.state.getModel().addEboEventListener("tempMessageChanged.eboplayer", () => {
			this.onMessageChanged();
		});
	}
	onMessageChanged() {
		let msg = this.state.getModel().getCurrentMessage();
		let tempMsg = this.state.getModel().getTempMessage();
		if (tempMsg.type != MessageType.None) msg = tempMsg;
		let headerSpan = document.getElementById("contentHeadline");
		headerSpan.innerText = msg.message;
		switch (msg.type) {
			case MessageType.Error:
				headerSpan.classList.add("warning");
				break;
			default:
				headerSpan.classList.remove("warning", "error");
				break;
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/commands.ts
var Commands = class {
	mopidy;
	core;
	constructor(mopidy) {
		this.mopidy = mopidy;
		this.core = new Core(mopidy);
	}
};
var Core = class {
	mopidy;
	history;
	library;
	mixer;
	playback;
	playlists;
	tracklist;
	constructor(mopidy) {
		this.mopidy = mopidy;
		this.history = new Core_History(mopidy);
		this.library = new Core_Library(mopidy);
		this.mixer = new Core_Mixer(mopidy);
		this.playback = new Core_Playback(mopidy);
		this.playlists = new Core_Playlists(mopidy);
		this.tracklist = new Core_Tracklist(mopidy);
	}
	getUriSchemes() {
		return this.mopidy.send("core.get_uri_schemes");
	}
	getVersion() {
		return this.mopidy.send("core.get_version");
	}
};
var Core_History = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	getHistory() {
		return this.mopidy.send("core.history.get_history");
	}
	getLength() {
		return this.mopidy.send("core.history.get_length");
	}
};
var Core_Library = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	browse(uri) {
		return this.mopidy.send("core.library.browse", { uri });
	}
	getDistinct(field, query) {
		return this.mopidy.send("core.library.get_distinct", {
			field,
			query
		});
	}
	getImages(uris) {
		return this.mopidy.send("core.library.get_images", { uris });
	}
	lookup(uris) {
		return this.mopidy.send("core.library.lookup", { uris });
	}
	refresh(uri) {
		return this.mopidy.send("core.library.refresh", { uri });
	}
	search(query, uris, exact = false) {
		return this.mopidy.send("core.library.search", {
			query,
			uris,
			exact
		});
	}
};
var Core_Mixer = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	getMute() {
		return this.mopidy.send("core.mixer.get_mute");
	}
	getVolume() {
		return this.mopidy.send("core.mixer.get_volume");
	}
	setMute(mute) {
		return this.mopidy.send("core.mixer.set_mute", { mute });
	}
	setVolume(volume) {
		return this.mopidy.send("core.mixer.set_volume", { volume });
	}
};
var Core_Playback = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	getCurrentTlTrack() {
		return this.mopidy.send("core.playback.get_current_tl_track");
	}
	getCurrentTlid() {
		return this.mopidy.send("core.playback.get_current_tlid");
	}
	getCurrentTrack() {
		return this.mopidy.send("core.playback.get_current_track");
	}
	getState() {
		return this.mopidy.send("core.playback.get_state");
	}
	getStreamTitle() {
		return this.mopidy.send("core.playback.get_stream_title");
	}
	getTimePosition() {
		return this.mopidy.send("core.playback.get_time_position");
	}
	next() {
		return this.mopidy.send("core.playback.next");
	}
	pause() {
		return this.mopidy.send("core.playback.pause");
	}
	play(tl_track, tlid) {
		return this.mopidy.send("core.playback.play", {
			tl_track,
			tlid
		});
	}
	previous() {
		return this.mopidy.send("core.playback.previous");
	}
	resume() {
		return this.mopidy.send("core.playback.resume");
	}
	seek(time_position) {
		return this.mopidy.send("core.playback.seek", { time_position });
	}
	setState(new_state) {
		return this.mopidy.send("core.playback.set_state", { new_state });
	}
	stop() {
		return this.mopidy.send("core.playback.stop");
	}
};
var Core_Playlists = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	asList() {
		return this.mopidy.send("core.playlists.as_list");
	}
	create(name, uri_scheme) {
		return this.mopidy.send("core.playlists.create", {
			name,
			uri_scheme
		});
	}
	delete(uri) {
		return this.mopidy.send("core.playlists.delete", { uri });
	}
	getItems(uri) {
		return this.mopidy.send("core.playlists.get_items", { uri });
	}
	getUriSchemes() {
		return this.mopidy.send("core.playlists.get_uri_schemes");
	}
	lookup(uri) {
		return this.mopidy.send("core.playlists.lookup", { uri });
	}
	refresh(uri_scheme) {
		return this.mopidy.send("core.playlists.refresh", { uri_scheme });
	}
	save(playlist) {
		return this.mopidy.send("core.playlists.save", { playlist });
	}
};
var Core_Tracklist = class {
	mopidy;
	constructor(mopidy) {
		this.mopidy = mopidy;
	}
	add(tracks, at_position, uris) {
		return this.mopidy.send("core.tracklist.add", {
			tracks,
			at_position,
			uris
		});
	}
	clear() {
		return this.mopidy.send("core.tracklist.clear");
	}
	eotTrack(tl_track) {
		return this.mopidy.send("core.tracklist.eot_track", { tl_track });
	}
	filter(criteria) {
		return this.mopidy.send("core.tracklist.filter", { criteria });
	}
	getConsume() {
		return this.mopidy.send("core.tracklist.get_consume");
	}
	getEotTlid() {
		return this.mopidy.send("core.tracklist.get_eot_tlid");
	}
	getLength() {
		return this.mopidy.send("core.tracklist.get_length");
	}
	getNextTlid() {
		return this.mopidy.send("core.tracklist.get_next_tlid");
	}
	getPreviousTlid() {
		return this.mopidy.send("core.tracklist.get_previous_tlid");
	}
	getRandom() {
		return this.mopidy.send("core.tracklist.get_random");
	}
	getRepeat() {
		return this.mopidy.send("core.tracklist.get_repeat");
	}
	getSingle() {
		return this.mopidy.send("core.tracklist.get_single");
	}
	getTlTracks() {
		return this.mopidy.send("core.tracklist.get_tl_tracks");
	}
	getTracks() {
		return this.mopidy.send("core.tracklist.get_tracks");
	}
	getVersion() {
		return this.mopidy.send("core.tracklist.get_version");
	}
	index(tl_track, tlid) {
		return this.mopidy.send("core.tracklist.index", {
			tl_track,
			tlid
		});
	}
	move(start, end, to_position) {
		return this.mopidy.send("core.tracklist.move", {
			start,
			end,
			to_position
		});
	}
	nextTrack(tl_track) {
		return this.mopidy.send("core.tracklist.next_track", { tl_track });
	}
	previousTrack(tl_track) {
		return this.mopidy.send("core.tracklist.previous_track", { tl_track });
	}
	remove(criteria) {
		return this.mopidy.send("core.tracklist.remove", { criteria });
	}
	setConsume(value) {
		return this.mopidy.send("core.tracklist.set_consume", { value });
	}
	setRandom(value) {
		return this.mopidy.send("core.tracklist.set_random", { value });
	}
	setRepeat(value) {
		return this.mopidy.send("core.tracklist.set_repeat", { value });
	}
	setSingle(value) {
		return this.mopidy.send("core.tracklist.set_single", { value });
	}
	shuffle(start, end) {
		return this.mopidy.send("core.tracklist.shuffle", {
			start,
			end
		});
	}
	slice(start, end) {
		return this.mopidy.send("core.tracklist.slice", {
			start,
			end
		});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/functionsvars.ts
function jsonParse(data, defaultValue) {
	try {
		return JSON.parse(data);
	} catch (e) {
		console.error(e);
		return defaultValue;
	}
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/proxies/localStorageProxy.ts
const CURRENT_BROWSE_FILTERS__KEY = "currentBrowseFilters";
const BROWSE_FILTERS_BREADCRUMBS_KEY = "browseFiltersBreadCrumbs";
var LocalStorageProxy = class {
	model;
	constructor(model) {
		this.model = model;
	}
	loadCurrentBrowseFilter() {
		let browseFilterString = localStorage.getItem(CURRENT_BROWSE_FILTERS__KEY);
		if (browseFilterString) {
			let browseFilterObject = jsonParse(browseFilterString, this.model.getCurrentBrowseFilter());
			let browseFilter = new BrowseFilter();
			Object.assign(browseFilter, browseFilterObject);
			this.model.setCurrentBrowseFilter(browseFilter);
			return;
		}
		console.error("Could not load or parse browse filter bread crumbs from local storage. Using default bread crumbs.");
	}
	loadBrowseFiltersBreadCrumbs() {
		let breadCrumbsString = localStorage.getItem(BROWSE_FILTERS_BREADCRUMBS_KEY);
		if (breadCrumbsString) {
			let breadCrumbsArray = jsonParse(breadCrumbsString, this.model.getBreadCrumbs());
			let breadCrumbs = new BrowseFilterBreadCrumbStack();
			breadCrumbsArray.map((crumb) => {
				switch (crumb.type) {
					case "browseFilter":
						let browseFilter = new BrowseFilter();
						Object.assign(browseFilter, crumb.data);
						return new BreadCrumbBrowseFilter(crumb.label, browseFilter);
					case "ref": return new BreadCrumbRef(crumb.label, crumb.data);
					case "home": return new BreadCrumbHome();
				}
			}).forEach((crumb) => breadCrumbs.push(crumb));
			if (breadCrumbs.length == 0) breadCrumbs.push(new BreadCrumbHome());
			else if (breadCrumbs[0].type != "home") breadCrumbs.unshift(new BreadCrumbHome());
			this.model.setBrowseFilterBreadCrumbs(breadCrumbs);
			return;
		}
		console.error("Could not load or parse browse filters from local storage. Using default filters.");
	}
	saveCurrentBrowseFilter(browseFilter) {
		let obj = JSON.stringify(browseFilter);
		localStorage.setItem(CURRENT_BROWSE_FILTERS__KEY, obj);
	}
	saveBrowseFilterBreadCrumbs(breadCrumbs) {
		let obj = JSON.stringify(breadCrumbs);
		localStorage.setItem(BROWSE_FILTERS_BREADCRUMBS_KEY, obj);
	}
	saveAlbumBeingEdited(albumUri) {
		localStorage.setItem("albumBeingEdited", albumUri ?? "");
	}
	saveRadioBeingEdited(albumUri) {
		localStorage.setItem("radioBeingEdited", albumUri ?? "");
	}
	getAlbumBeingEdited() {
		let albumUri = localStorage.getItem("albumBeingEdited") ?? "";
		if (albumUri == "") return null;
		return albumUri;
	}
	saveLineOrIconPreference(lineOrIcon) {
		localStorage.setItem("lineOrIconPreference", lineOrIcon);
	}
	getLineOrIconPreference() {
		return localStorage.getItem("lineOrIconPreference") ?? "line";
	}
	setLastViewed(view, uri) {
		let lastViewed = {
			view,
			uri
		};
		localStorage.setItem("lastViewed", JSON.stringify(lastViewed));
	}
	getLastViewed() {
		let lastViewed = localStorage.getItem("lastViewed");
		if (!lastViewed) return null;
		return JSON.parse(lastViewed);
	}
	setHideBrowseInfoButton(hide) {
		localStorage.setItem("hideBrowseInfoButton", hide.toString());
	}
	getHideBrowseInfoButton() {
		return localStorage.getItem("hideBrowseInfoButton") == "true";
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/proxies/webProxy.ts
var WebProxy = class {
	ebobackBase;
	eboplayerBase;
	constructor(hostAndPort) {
		this.ebobackBase = `http://${hostAndPort}/eboback/data/`;
		this.eboplayerBase = `http://${hostAndPort}/eboplayer2/`;
	}
	playerUrl(relPath) {
		return new URL(this.eboplayerBase + relPath);
	}
	ebobackUrl(relPath) {
		return new URL(this.ebobackBase + relPath);
	}
	async fetchActiveStreamLines(uri) {
		let url = this.playerUrl(`stream/activeLines`);
		url.searchParams.set("uri", uri);
		return await (await fetch(url)).json();
	}
	async fetchAllStreamLines(uri) {
		let url = this.playerUrl(`stream/allLines`);
		url.searchParams.set("uri", uri);
		return await (await fetch(url)).json();
	}
	async fetchMetaDatas(albumUris) {
		let url = this.ebobackUrl(`get_album_metas`);
		let data = new FormData();
		data.append("uris", albumUris.join(","));
		let text = await (await fetch(url, {
			method: "POST",
			body: data
		})).text();
		if (text) return JSON.parse(text);
		return {};
	}
	async fetchMetaData(albumUri) {
		let url = this.ebobackUrl(`get_album_meta`);
		url.searchParams.set("uri", albumUri);
		let text = await (await fetch(url)).text();
		if (text) return JSON.parse(text);
		return null;
	}
	async addRefToPlaylist(playlistUri, itemUri, refType, sequence) {
		let url = this.ebobackUrl(`add_ref_to_playlist`);
		let data = new FormData();
		data.append("playlist_uri", playlistUri);
		data.append("item_uri", itemUri);
		data.append("ref_type", refType);
		data.append("sequence", sequence.toString());
		return await (await fetch(url, {
			method: "POST",
			body: data
		})).json();
	}
	async fetchGenreReplacements() {
		let url = this.ebobackUrl(`get_genre_replacements`);
		return await (await fetch(url)).json();
	}
	async fetchGenreDefs() {
		let url = this.ebobackUrl(`get_genre_defs`);
		return await (await fetch(url)).json();
	}
	async remember(text) {
		let url = this.ebobackUrl(`save_remember`);
		return await (await fetch(url, {
			method: "POST",
			body: text
		})).json();
	}
	async deleteRemember(id) {
		let url = this.ebobackUrl(`delete_remember`);
		return await (await fetch(url, {
			method: "POST",
			body: id
		})).json();
	}
	async fetchRemembers() {
		let url = this.ebobackUrl(`get_remembers`);
		return await (await fetch(url)).json();
	}
	async fetchHistory() {
		let url = this.ebobackUrl(`get_history`);
		return await (await fetch(url)).json();
	}
	async fetchAllRefs() {
		let url = this.ebobackUrl(`get_all_refs`);
		return await (await fetch(url)).json();
	}
	async updateAlbumData(albumUri) {
		let url = this.ebobackUrl(`update_album_data`);
		url.searchParams.set("album_uri", albumUri);
		await fetch(url);
		return null;
	}
	async uploadAlbumImages(albumUri, imageUrl) {
		let url = this.ebobackUrl(`upload_album_image`);
		url.searchParams.set("album_uri", albumUri);
		url.searchParams.set("image_url", imageUrl);
		await fetch(url);
		return null;
	}
	async setAlbumGenre(albumUri, genre) {
		let url = this.ebobackUrl(`set_album_genre`);
		url.searchParams.set("album_uri", albumUri);
		url.searchParams.set("genre", genre);
		await fetch(url);
		return null;
	}
	async createPlaylist(name) {
		let url = this.ebobackUrl(`create_playlist`);
		url.searchParams.set("playlist_name", name);
		return (await (await fetch(url)).json()).playlist_uri;
	}
	async toggleFavorite(uri) {
		let url = this.ebobackUrl(`toggle_favorite`);
		url.searchParams.set("uri", uri);
		return (await (await fetch(url)).json()).is_favorite;
	}
	async getFavorites() {
		let url = this.ebobackUrl(`get_favorite_uris`);
		return await (await fetch(url)).json();
	}
	async getFavoritesPlaylistName() {
		let url = this.ebobackUrl(`get_favorites_playlist_name`);
		return await (await fetch(url)).text();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/controllers/viewController.ts
var ViewController = class extends Commands {
	model;
	localStorageProxy;
	controller;
	constructor(model, mopidy, controller) {
		super(mopidy);
		this.model = model;
		this.localStorageProxy = new LocalStorageProxy(model);
		this.controller = controller;
	}
	setInitialView() {
		let lastViewed = this.controller.localStorageProxy.getLastViewed();
		if (!lastViewed) {
			this.setView(Views.NowPlaying);
			return;
		}
		switch (lastViewed.view) {
			case Views.Album:
				if (location.hash == Views.Album) {
					this.gotoAlbum(lastViewed.uri);
					return;
				}
				break;
			case Views.Radio:
				if (location.hash == Views.Radio) {
					this.gotoRadio(lastViewed.uri);
					return;
				}
				break;
			default:
				this.setView(location.hash != "" ? location.hash : Views.NowPlaying);
				return;
		}
		this.setView(Views.NowPlaying);
	}
	gotoAlbum(uri) {
		this.controller.getExpandedAlbumModel(uri).then(() => {
			this.showAlbum(uri, null);
		});
	}
	gotoRadio(uri) {
		this.controller.getExpandedTrackModel(uri).then(() => {
			this.showRadio(uri);
		});
	}
	setView(view) {
		this.model.setView(view);
	}
	showAlbum(albumUri, selectedTrackUri) {
		this.localStorageProxy.setLastViewed(Views.Album, albumUri);
		this.model.setAlbumToView(albumUri, selectedTrackUri);
		this.model.setView(Views.Album);
	}
	showRadio(radioUri) {
		this.localStorageProxy.setLastViewed(Views.Radio, radioUri);
		this.model.setRadioToView(radioUri);
		this.model.setView(Views.Radio);
	}
	async browseToArtist(args) {
		await this.controller.clearBreadCrumbs();
		await this.controller.diveIntoBrowseResult(args.name, args.uri, args.type, false);
		this.setView(Views.Browse);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/controllers/controller.ts
const LIBRARY_PROTOCOL = "eboback:";
var Controller = class extends Commands {
	model;
	mopidyProxy;
	webProxy;
	localStorageProxy;
	eboWsFrontCtrl;
	eboWsBackCtrl;
	player;
	cache;
	viewController;
	constructor(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopdyProxy, player, cache) {
		super(mopidy);
		this.cache = cache;
		this.model = model;
		this.player = player;
		this.mopidyProxy = mopdyProxy;
		this.webProxy = new WebProxy(getHostAndPort());
		this.localStorageProxy = new LocalStorageProxy(model);
		this.eboWsFrontCtrl = eboWsFrontCtrl;
		this.eboWsBackCtrl = eboWsBackCtrl;
		this.viewController = new ViewController(model, mopidy, this);
	}
	async getInitialData(views) {
		this.model.setVolume(await this.mopidyProxy.fetchVolume());
		await this.setCurrentTrackAndFetchDetails(await this.mopidyProxy.fetchCurrentTlTrack());
		this.model.setPlayState(await this.mopidyProxy.fetchPlayState());
		this.model.setPlaybackMode(await this.mopidyProxy.getPlaybackFlags());
		this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
		await this.fetchAllAlbums();
		this.localStorageProxy.loadCurrentBrowseFilter();
		this.localStorageProxy.loadBrowseFiltersBreadCrumbs();
		await this.fetchRefsForCurrentBreadCrumbs();
		await this.filterBrowseResults();
		await this.cache.getGenreReplacementsCached();
		await this.cache.getRemembersCached();
		await this.cache.getGenreDefs();
		await this.cache.getFavorites();
		await this.updateStreamLines();
	}
	initialize(views) {
		this.mopidy.on("state:online", async () => {
			this.model.setConnectionState(ConnectionState.Online);
			await this.getInitialData(views);
			this.model.setHistory(await this.webProxy.fetchHistory());
			this.viewController.setInitialView();
		});
		this.mopidy.on("state:offline", () => {
			this.model.setConnectionState(ConnectionState.Offline);
		});
		this.mopidy.on("event:optionsChanged", async () => {
			this.model.setPlaybackMode(await this.mopidyProxy.getPlaybackFlags());
		});
		this.mopidy.on("event:trackPlaybackStarted", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
		});
		this.mopidy.on("event:trackPlaybackEnded", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
		});
		this.mopidy.on("event:trackPlaybackResumed", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
		});
		this.mopidy.on("event:playlistsLoaded", () => {});
		this.mopidy.on("event:playlistChanged", (data) => {});
		this.mopidy.on("event:playlistDeleted", (data) => {});
		this.mopidy.on("event:volumeChanged", (data) => {
			this.model.setVolume(data.volume);
		});
		this.mopidy.on("event:muteChanged", (_data) => {});
		this.mopidy.on("event:playbackStateChanged", async (data) => {
			await this.onPlaybackStateChanged(data);
		});
		this.mopidy.on("event:tracklistChanged", async () => {
			this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
			await this.setCurrentTrackAndFetchDetails(await this.mopidyProxy.fetchCurrentTrack());
		});
		this.mopidy.on("event:seeked", () => {});
		this.mopidy.on((data) => {
			if (data instanceof MessageEvent) try {
				if ((JSON.parse(data.data).event ?? "") == "stream_title_changed") return;
			} catch (e) {}
			if (typeof data == "object") {
				if ((data.title && Object.keys(data).length) == 1) return;
			}
			if (data instanceof Array) {
				if (data.length && data[0] == "event:streamTitleChanged") return;
			}
			console.log(data);
		});
		this.eboWsFrontCtrl.on("event:streamHistoryChanged", (data) => {
			let streamTitles = data.stream_titles;
			this.model.setActiveStreamLines(streamTitles);
			this.model.setStreamLinesHistory(streamTitles.uri, null);
		});
		this.eboWsFrontCtrl.on("event:programTitleChanged", (data) => {
			this.model.setCurrentProgramTitle(data.program_title);
		});
		this.eboWsBackCtrl.on((data) => {
			console.log(data);
		});
		this.eboWsBackCtrl.on("event:scanStarted", (data) => {
			this.model.setScanStatus(`${data.message}\n`);
		});
		this.eboWsBackCtrl.on("event:scanStatus", (data) => {
			this.model.setScanStatus(this.model.getScanStatus() + data.message + "\n");
		});
		this.eboWsBackCtrl.on("event:scanFinished", (data) => {
			this.model.setScanStatus(this.model.getScanStatus() + "Scan completed.");
			this.model.dispatchEboEvent("scanFinished.eboplayer", {});
		});
	}
	async fetchAllAlbums() {
		let albumRefs = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=album");
		return await this.cache.lookupAlbumsCached(albumRefs.map((ref) => ref.uri));
	}
	async onPlaybackStateChanged(data) {
		this.model.setPlayState(data.new_state);
		await this.updateStreamLines();
	}
	async setCurrentTrackAndFetchDetails(data) {
		if (!data) {
			this.model.setCurrentTrack(TrackNone);
			return;
		}
		let trackModel = await this.cache.lookupTrackCached(data.track.uri);
		this.model.setCurrentTrack(trackModel);
		if (!this.model.selectedTrack) {
			let uri = trackModel?.track?.uri;
			this.model.setSelectedTrack(uri ?? null);
		}
		await this.updateStreamLines();
	}
	async updateStreamLines() {
		if (this.model.getPlayState() != "playing") {
			this.model.setActiveStreamLines(NoStreamTitles);
			return;
		}
		if (this.model.currentTrack == null) {
			this.model.setActiveStreamLines(NoStreamTitles);
			return;
		}
		if ((await this.cache.lookupTrackCached(this.model.currentTrack))?.type == "stream") {
			let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack);
			this.model.setActiveStreamLines(lines);
		} else this.model.setActiveStreamLines(NoStreamTitles);
	}
	async setAndSaveBrowseFilter(filter, applyFilter = "apply") {
		this.localStorageProxy.saveCurrentBrowseFilter(filter);
		this.model.setCurrentBrowseFilter(filter);
		if (applyFilter == "apply") await this.filterBrowseResults();
	}
	async diveIntoBrowseResult(label, uri, type, addTextFilterBreadcrumb) {
		if (type == "track") {
			let track = await this.getExpandedTrackModel(uri);
			if (track.album?.albumInfo?.uri) this.viewController.showAlbum(track.album?.albumInfo?.uri, uri);
			return;
		}
		if (type == "album") this.viewController.gotoAlbum(uri);
		if (type == "radio") this.getExpandedTrackModel(uri).then(() => {
			this.viewController.showRadio(uri);
		});
		if (addTextFilterBreadcrumb) {
			let browseFilter = this.model.getCurrentBrowseFilter();
			if (!browseFilter.isEmpty()) {
				let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
				this.model.pushBreadCrumb(breadCrumb1, "noDispatch");
			}
		}
		let breadCrumb2 = new BreadCrumbRef(label, {
			type,
			name: label,
			uri
		});
		this.model.pushBreadCrumb(breadCrumb2);
		this.localStorageProxy.saveBrowseFilterBreadCrumbs(this.model.getBreadCrumbs());
		let newBrowseFilter = new BrowseFilter();
		switch (type) {
			case "artist":
				newBrowseFilter.album = true;
				break;
			case "genre":
				newBrowseFilter.radio = true;
				newBrowseFilter.playlist = true;
				newBrowseFilter.artist = true;
				newBrowseFilter.album = true;
				newBrowseFilter.track = true;
				newBrowseFilter.genre = true;
				break;
			case "playlist":
				newBrowseFilter.playlist = true;
				newBrowseFilter.artist = true;
				newBrowseFilter.album = true;
				newBrowseFilter.track = true;
				newBrowseFilter.radio = true;
				break;
		}
		await this.setAndSaveBrowseFilter(newBrowseFilter, "dontApply");
		await this.fetchRefsForCurrentBreadCrumbs();
		await this.filterBrowseResults();
	}
	async setWhatsNewFilter() {
		await this.clearBreadCrumbs();
		let browseFilter = new BrowseFilter();
		browseFilter.addedSince = 1;
		this.localStorageProxy.saveCurrentBrowseFilter(browseFilter);
		this.model.setCurrentBrowseFilter(browseFilter);
	}
	async clearBreadCrumbs() {
		this.model.resetBreadCrumbsTo(this.model.getBreadCrumbs()[0].id);
	}
	async resetToBreadCrumb(id) {
		let breadCrumb = this.model.getBreadCrumbs().get(id);
		let breadCrumbs = this.model.getBreadCrumbs();
		if (breadCrumb instanceof BreadCrumbBrowseFilter) {
			this.model.resetBreadCrumbsTo(id);
			let browseFilter = this.model.popBreadCrumb()?.data;
			await this.setAndSaveBrowseFilter(browseFilter);
			this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
			await this.fetchRefsForCurrentBreadCrumbs();
			await this.filterBrowseResults();
		} else if (breadCrumb instanceof BreadCrumbRef) {
			if (isBreadCrumbForAlbum(breadCrumb)) {
				this.viewController.showAlbum(breadCrumb.data.uri, null);
				return;
			}
			this.model.resetBreadCrumbsTo(id);
			this.model.popBreadCrumb();
			await this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
		} else if (breadCrumb instanceof BreadCrumbHome) {
			this.model.resetBreadCrumbsTo(id);
			await this.setAndSaveBrowseFilter(new BrowseFilter());
			this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
			await this.fetchRefsForCurrentBreadCrumbs();
			await this.filterBrowseResults();
		}
	}
	async getExpandedTrackModel(trackUri) {
		if (!trackUri) return null;
		let track = await this.cache.lookupTrackCached(trackUri);
		if (track?.type == "stream") return new ExpandedStreamModel(track, this);
		if (track) {
			let uri = track?.track?.album?.uri;
			let album = null;
			if (uri) album = (await this.cache.lookupAlbumsCached([uri]))[0];
			return new ExpandedFileTrackModel(track, album, this);
		}
		throw new Error("trackUri not found in library");
	}
	async getExpandedAlbumModel(albumUri) {
		let album = (await this.cache.lookupAlbumsCached([albumUri]))[0];
		let meta = await this.cache.getMetaDataCached(albumUri) ?? null;
		return new ExpandedAlbumModel(album, this, meta);
	}
	setSelectedTrack(uri) {
		this.model.setSelectedTrack(uri);
	}
	async fetchAllRefs() {
		let allRefs = await this.webProxy.fetchAllRefs();
		return createAllRefs(this.cache, allRefs);
	}
	async filterBrowseResults() {
		await this.model.filterCurrentRefs();
	}
	async fetchRefsForCurrentBreadCrumbs() {
		let lastCrumb = this.model.getBreadCrumbs().getLast();
		if (!lastCrumb) {
			await this.setAllRefsAsCurrent();
			return;
		}
		if (lastCrumb instanceof BreadCrumbHome) {
			await this.setAllRefsAsCurrent();
			return;
		}
		if (lastCrumb instanceof BreadCrumbBrowseFilter) {
			await this.setAllRefsAsCurrent();
			return;
		}
		if (lastCrumb instanceof BreadCrumbRef) {
			if (lastCrumb.data.type == "playlist") {
				let playlistItems = await this.mopidyProxy.fetchPlaylistItems(lastCrumb.data.uri);
				playlistItems.forEach((ref) => {
					if (!ref.name || ref.name == "") {
						ref.name = ref.uri.replace(LIBRARY_PROTOCOL + "track:", "").replaceAll("%20", " ");
						ref.name = ref.name.split(".").slice(0, -1).join(".");
					}
				});
				let results$1 = await Refs.transformRefsToSearchResults(this.cache, playlistItems);
				this.model.setCurrentRefs(new SomeRefs(results$1));
				return;
			}
			let refs = await this.mopidyProxy.browse(lastCrumb.data.uri);
			let results = await Refs.transformRefsToSearchResults(this.cache, refs);
			this.model.setCurrentRefs(new SomeRefs(results));
			return;
		}
	}
	async setAllRefsAsCurrent() {
		this.model.setCurrentRefs(await this.cache.getAllRefsCached());
	}
	async addCurrentSearchResultsToPlayer() {
		let results = this.model.getCurrentSearchResults();
		await this.player.add(results.refs.map((r) => r.item.uri));
	}
	async createPlaylist(name) {
		return this.webProxy.createPlaylist(name);
	}
	async addRefToPlaylist(playlistUri, itemUri, refType, sequence) {
		return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
	}
	async remember(s) {
		await this.webProxy.remember(s);
		this.model.setRemembers(null);
	}
	async startScan() {
		await this.eboWsBackCtrl.send({ method: "start_scan" }, "fireAndForget");
	}
	async deleteRemember(id) {
		await this.webProxy.deleteRemember(id);
		this.model.setRemembers(null);
	}
	async setRepeat(repeat) {
		await this.mopidyProxy.setRepeat(repeat);
	}
	async setSingle(single) {
		await this.mopidyProxy.setSingle(single);
	}
	async saveAlbumGenre(albumUri, genre) {
		await this.webProxy.setAlbumGenre(albumUri, genre);
	}
	async toggleFavorite(uri) {
		await this.webProxy.toggleFavorite(uri);
		this.model.setFavorites(null);
		await this.cache.getFavorites();
	}
	async isFavorite(uri) {
		if (!uri) return false;
		return (await this.cache.getFavorites()).has(uri);
	}
	async gotoFavorites() {
		let favoritesName = await this.cache.getFavoritePlaylistName();
		let allRefs = await this.cache.getAllRefsCached();
		console.log(allRefs);
		let favoritesRef = allRefs.playlists.find((res) => res.item.name == favoritesName);
		console.log(favoritesRef);
		if (!favoritesRef) return;
		await this.clearBreadCrumbs();
		await this.diveIntoBrowseResult(favoritesName, favoritesRef.item.uri, "playlist", false);
		this.viewController.setView(Views.Browse);
	}
	showTempMessage(message, type) {
		this.model.setTempMessage({
			message,
			type
		});
	}
};
var controller_default = Controller;

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/playerBarView.ts
var PlayerBarView = class extends ComponentView {
	constructor(state, component) {
		super(state, component);
	}
	bind() {
		this.state.getModel().addEboEventListener("playbackStateChanged.eboplayer", async () => {
			await this.onPlaybackStateChanged();
		});
		this.state.getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
			await this.onCurrentTrackChanged();
		});
		this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onSelectedTrackChanged();
		});
		this.state.getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", () => {
			this.onActiveStreamLinesChanged();
		});
		this.state.getModel().addEboEventListener("playbackModeChanged.eboplayer", () => {
			this.onPlaybackModeChanged();
		});
		this.component.addEboEventListener("playPressed.eboplayer", async () => {
			await this.state.getController().mopidyProxy.sendPlay();
		});
		this.component.addEboEventListener("stopPressed.eboplayer", async () => {
			await this.state.getController().mopidyProxy.sendStop();
		});
		this.component.addEboEventListener("pausePressed.eboplayer", async () => {
			await this.state.getController().mopidyProxy.sendPause();
		});
		this.component.addEboEventListener("buttonBarAlbumImgClicked.eboplayer", () => {
			this.onButtonBarImgClicked();
		});
		this.state.getModel().addEboEventListener("volumeChanged.eboplayer", () => {
			this.onVolumeChanged();
		});
		this.component.addEboEventListener("changingVolume.eboplayer", async (ev) => {
			let value = ev.detail.volume;
			await this.state.getController().mopidyProxy.sendVolume(value);
		});
		this.component.addEboEventListener("optionSelected.eboplayer", async (ev) => {
			await this.changeRepeat(ev.detail.selected);
		});
		this.state.getModel().addEboEventListener("viewChanged.eboplayer", () => {
			this.showHideInfo();
		});
	}
	onVolumeChanged() {
		let volume = this.state.getModel().getVolume();
		this.component.setAttribute("volume", volume.toString());
	}
	async onPlaybackStateChanged() {
		let playState = this.state.getModel().getPlayState();
		this.component.setAttribute("play_state", playState ?? "stopped");
		await this.updateComponent();
	}
	async onCurrentTrackChanged() {
		await this.updateComponent();
	}
	async onSelectedTrackChanged() {
		await this.updateComponent();
	}
	async updateComponent() {
		let track = this.state.getModel().getCurrentTrack();
		if (!track) {
			this.component.setAttribute("text", "");
			this.component.setAttribute("allow_play", "false");
			this.component.setAttribute("allow_prev", "false");
			this.component.setAttribute("allow_next", "false");
			this.component.setAttribute("image_url", "");
			this.component.setAttribute("stop_or_pause", "stop");
		} else {
			let trackModel = await this.state.getController().getExpandedTrackModel(track);
			if (isInstanceOfExpandedStreamModel(trackModel)) {
				let active_titles = "";
				let activeStreamLines = this.state.getModel().getActiveStreamLines();
				if (activeStreamLines) active_titles = activeStreamLines.active_titles.join("\n");
				this.component.setAttribute("text", active_titles);
				this.component.setAttribute("allow_play", "true");
				this.component.setAttribute("allow_prev", "false");
				this.component.setAttribute("allow_next", "false");
				this.component.setAttribute("image_url", trackModel.bigImageUrl);
				this.component.setAttribute("stop_or_pause", "stop");
			} else if (isInstanceOfExpandedTrackModel(trackModel)) {
				this.component.setAttribute("text", trackModel.track.track.name ?? "--no name--");
				this.component.setAttribute("allow_play", "true");
				this.component.setAttribute("allow_prev", "false");
				this.component.setAttribute("allow_next", "false");
				this.component.setAttribute("image_url", trackModel.bigImageUrl);
				this.component.setAttribute("stop_or_pause", "pause");
			}
		}
		this.showHideInfo();
	}
	showHideInfo() {
		let currentTrack = this.state.getModel().getCurrentTrack();
		let selectedTrack = this.state.getModel().getSelectedTrack();
		let currentView = this.state.getModel().getView();
		let show_info = false;
		if (selectedTrack && currentTrack != selectedTrack) show_info = true;
		if (currentView != Views.NowPlaying) show_info = true;
		this.component.setAttribute("show_info", show_info.toString());
	}
	onButtonBarImgClicked() {
		this.state.getController().setSelectedTrack(this.state.getModel().getCurrentTrack());
		this.state.getController().viewController.setView(Views.NowPlaying);
	}
	onActiveStreamLinesChanged() {
		let lines = this.state.getModel().getActiveStreamLines();
		this.component.setAttribute("text", lines.active_titles.join("\n"));
	}
	async changeRepeat(selected) {
		switch (selected) {
			case "repeat":
				await this.state.getController().setRepeat(true);
				await this.state.getController().setSingle(false);
				break;
			case "single":
				await this.state.getController().setRepeat(false);
				await this.state.getController().setSingle(true);
				break;
			case "repeatSingle":
				await this.state.getController().setRepeat(true);
				await this.state.getController().setSingle(true);
				break;
			case null:
			case "justPlay":
				await this.state.getController().setRepeat(false);
				await this.state.getController().setSingle(false);
				break;
			default: unreachable(selected);
		}
	}
	onPlaybackModeChanged() {
		let modes = this.state.getModel().getPlaybackMode();
		let option = "justPlay";
		if (modes.repeat) if (modes.single) option = "repeatSingle";
		else option = "repeat";
		this.component.playMode = option;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/Batching.ts
var Batching = class {
	constructor(task) {
		this.task = task;
	}
	requested = false;
	async schedule() {
		if (!this.requested) {
			this.requested = true;
			this.requested = await false;
			this.execute();
		}
	}
	execute() {
		this.task();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/EboComponent.ts
var EboComponent = class EboComponent extends HTMLElement {
	get isRendered() {
		return this._isRendered;
	}
	static globalCss = [];
	static cssCache = /* @__PURE__ */ new Map();
	shadow;
	styleTemplate;
	divTemplate;
	connected = false;
	_isRendered = false;
	static NO_TAG_NAME = "todo: override in subclass";
	static tagName = EboComponent.NO_TAG_NAME;
	renderBatching;
	updateBatching;
	cssNeeded = [];
	constructor(styleText, htmlText) {
		super();
		if (styleText) {
			this.styleTemplate = document.createElement("template");
			this.styleTemplate.innerHTML = styleText;
		}
		if (htmlText) {
			this.divTemplate = document.createElement("template");
			this.divTemplate.innerHTML = htmlText;
		}
		this.renderBatching = new Batching(this.doRender.bind(this));
		this.updateBatching = new Batching(this.doUpdate.bind(this));
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		this.attributeReallyChangedCallback(name, oldValue, newValue);
	}
	static setGlobalCss(text) {
		this.globalCss = text.map((text$1) => {
			let css = new CSSStyleSheet();
			css.replaceSync(text$1);
			return css;
		});
	}
	addEboEventListener(type, listener, options) {
		super.addEventListener(type, listener, options);
	}
	dispatchEboEvent(key, args) {
		return super.dispatchEvent(createEvent(key, args));
	}
	connectedCallback() {
		this.shadow = this.attachShadow({ mode: "open" });
		this.fetchCssAndCache().then(() => {
			this.connected = true;
			this.onConnected();
			this.requestRender();
		});
	}
	async fetchCssAndCache() {
		let fetches = [];
		this.cssNeeded.forEach((url) => {
			if (!EboComponent.cssCache.has(url)) fetches.push(fetch(url).then((res) => res.text()));
		});
		(await Promise.all(fetches)).forEach((text, i) => {
			let css = new CSSStyleSheet();
			css.replaceSync(text);
			EboComponent.cssCache.set(this.cssNeeded[i], css);
		});
	}
	onConnected() {}
	requestUpdate() {
		this.updateBatching.schedule();
	}
	doUpdate() {
		if (!this.connected) return;
		if (!this._isRendered) return;
		this.update(this.shadow);
	}
	update(shadow) {}
	requestRender() {
		this.renderBatching.schedule();
	}
	doRender() {
		if (!this.shadow) return;
		this.shadow.innerHTML = "";
		let css = [...EboComponent.globalCss];
		css = css.concat(this.cssNeeded.map((name) => EboComponent.cssCache.get(name)));
		this.shadow.adoptedStyleSheets = css;
		if (this.styleTemplate) this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
		if (this.divTemplate) this.shadow.appendChild(this.divTemplate.content.cloneNode(true));
		this.render(this.shadow);
		this._isRendered = true;
	}
	render(shadow) {
		this.requestUpdate();
	}
	getShadow() {
		return this.shadow;
	}
	setClassFromBoolAttribute(el, attName) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
	setTextFromAttribute(attName) {
		let el = this.shadow.getElementById(attName);
		if (!el) {
			console.warn(`Element with id "${attName}" not found.`);
			return;
		}
		if (this[attName]) el.textContent = this[attName];
		else el.textContent = "";
	}
	updateStringProperty(name, newValue) {
		this[name] = newValue;
	}
	updateBoolProperty(name, newValue) {
		if (newValue == null) {
			this[name] = false;
			return;
		}
		if (newValue == "") {
			this[name] = true;
			return;
		}
		if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
		this[name] = newValue == "true";
	}
	static define(comp) {
		if (comp.tagName == EboComponent.NO_TAG_NAME) throw "Component class should have tagName defined.";
		customElements.define(comp.tagName, comp);
	}
	addShadowEventListener(id, type, listener) {
		this.shadow.getElementById(id)?.addEventListener(type, listener);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboProgressBar.ts
var EboProgressBar = class EboProgressBar extends EboComponent {
	static tagName = "ebo-progressbar";
	static observedAttributes = [
		"position",
		"min",
		"max",
		"button",
		"active"
	];
	position = 51;
	min = 0;
	max = 100;
	active = false;
	button = true;
	static styleText = `
        <style>
        .movingGradient {
            background-color: #555;
        }
        .active .movingGradient {
            --darkGradient: #555;
            background: linear-gradient(to right, var(--darkGradient),
            #2a84a5, var(--darkGradient), #ffffff,
                var(--darkGradient), #ca497c, var(--darkGradient), #9e9c2d, var(--darkGradient), #ee7752, var(--darkGradient),
                #2a84a5
            );
            background-size: 1100% 1100%;  /*Must be a multiple of the number of colors above for a smooth transistion and the last color must be the first*/
            animation: gradient 15s forwards infinite linear;
            animation-timing-function: linear;
            animation-direction: normal;
        }
        .button #button {
                background-color: white;
                width: 3px; 
                display: inline-block;
                box-shadow: 0 0 5px white, 0 0 5px white,  0 0 5px white, 0 0 5px white, 0 0 15px white;
        }
        @keyframes gradient {
            0% {
                background-position: 0% 50%;
            }
            100% {
                background-position: 100% 50%;
            }
        }
        </style>
    `;
	static htmlText = `
        <div style="
            background-color: #444; 
            height: 1px; 
            display: flex; 
            ">
            <div class="movingGradient" style="
                height: 1px;
                display: inline-block;">
            </div>
            <div id="button"></div>
        </div>
        `;
	constructor() {
		super(EboProgressBar.styleText, EboProgressBar.htmlText);
		this.requestRender();
	}
	attributeReallyChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case "position":
			case "min":
			case "max":
				let test = parseInt(newValue);
				if (isNaN(test)) throw `"${name}" attribute should be a number. Current value: "${newValue}"`;
				this[name] = test;
				break;
			case "active":
			case "button":
				this.updateBoolProperty(name, newValue);
				break;
		}
		if (!(this.min <= this.position && this.position <= this.max)) throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
		this.requestRender();
	}
	render(shadow) {
		let percent = (this.position - this.min) / (this.max - this.min) * 100;
		let styleElement = shadow.appendChild(document.createElement("style"));
		styleElement.innerHTML = `.movingGradient { width: ${percent}%; } `;
		this.setClassFromBoolAttribute(shadow.firstElementChild, "button");
		this.setClassFromBoolAttribute(shadow.firstElementChild, "active");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/timelineView.ts
var TimelineView = class extends View {
	clickedRow;
	constructor(state) {
		super(state);
	}
	bind() {
		this.state.getModel().addEboEventListener("historyChanged.eboplayer", () => {
			this.rebuildTimeline().then((r) => {});
		});
		this.state.getModel().addEboEventListener("trackListChanged.eboplayer", () => {
			this.rebuildTimeline().then((r) => {});
		});
		this.state.getModel().addEboEventListener("currentTrackChanged.eboplayer", () => {
			this.onCurrentTrackChanged();
		});
		this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", () => {
			this.onSelectedTrackChanged();
		});
	}
	async rebuildTimeline() {
		let history = this.state.getModel().getHistory() ?? [];
		let trackList = this.state.getModel().getTrackList() ?? [];
		let body = document.getElementById("timelineTable").tBodies[0];
		body.innerHTML = "";
		if (history.length > 0 && trackList.length > 0 && history[0].uri == trackList[0].track.uri) history.shift();
		for (let i = history.length - 1; i >= 0; i--) this.insertHistoryLine(history[i], body);
		for (let track of trackList) this.insertTrackLine(track.track.name ?? "--no name--", track.track.uri, body, [], track.tlid);
		let uris = trackList.map((tl) => tl.track.uri);
		uris = [...new Set(uris)];
		await this.setCurrentTrack();
		body.querySelectorAll("tr").forEach((tr) => {
			tr.addEventListener("dblclick", (ev) => {
				this.onRowDoubleClicked(ev);
			});
			tr.addEventListener("click", (ev) => {
				this.onRowClicked(ev);
			});
		});
	}
	onRowClicked(ev) {
		let row = ev.currentTarget;
		this.setRowsClass(row, ["clicked"]);
		this.state.getController().setSelectedTrack(row.dataset.uri);
	}
	async onRowDoubleClicked(ev) {
		this.clickedRow = ev.currentTarget;
		if (this.clickedRow.dataset.tlid) await this.state.getPlayer().play(parseInt(this.clickedRow.dataset.tlid));
		else await this.state.getPlayer().clearAndPlay([this.clickedRow.dataset.uri]);
	}
	setRowsClass(rowOrSelector, classes) {
		document.getElementById("timelineTable").querySelectorAll(`tr`).forEach((tr) => tr.classList.remove(...classes));
		if (rowOrSelector instanceof HTMLTableRowElement) rowOrSelector.classList.add(...classes);
		else document.getElementById("timelineTable").querySelectorAll(rowOrSelector).forEach((tr) => tr.classList.add(...classes));
	}
	setSelectedTrack() {
		let selectedTrackUri = this.state.getModel().getSelectedTrack();
		this.setRowsClass(`tr[data-uri="${selectedTrackUri}"]`, ["selected"]);
	}
	async setCurrentTrack() {
		let timelineTable = document.getElementById("timelineTable");
		let focusTrack = await this.state.getController().cache.lookupTrackCached(this.state.getModel().getCurrentTrack());
		if (!focusTrack) {
			focusTrack = await this.state.getController().cache.lookupTrackCached(this.state.getModel().getSelectedTrack());
			if (!focusTrack) return;
		}
		let currentUri = focusTrack.track.uri;
		let trs = [...timelineTable.querySelectorAll(`tr[data-uri="${currentUri}"]`)];
		if (trs.length == 0) return;
		let tr = trs[trs.length - 1];
		if (this.clickedRow?.dataset?.uri != focusTrack.track.uri) tr.scrollIntoView({ block: "nearest" });
		timelineTable.querySelectorAll("tr").forEach((tr$1) => tr$1.classList.remove("current", "textGlow"));
		tr.classList.add("current", "textGlow");
	}
	insertHistoryLine(line, body) {
		this.insertTrackLine(line.name, line.uri, body, ["historyLine"], void 0, line.album, line.artist);
	}
	insertTrackLine(title, uri, body, classes = [], tlid, album, artist) {
		let tr = document.createElement("tr");
		body.appendChild(tr);
		tr.classList.add("trackLine", ...classes);
		if (!uri.startsWith("eboback")) tr.classList.add("italic");
		tr.dataset.uri = uri;
		if (tlid) tr.dataset.tlid = tlid.toString();
		this.setTrackLineContent(tr, title, artist, album);
		body.insertAdjacentHTML("beforeend", `
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);
	}
	setTrackLineContent(tr, title, artist = "⚬⚬⚬", album = "⚬⚬⚬") {
		tr.innerHTML = `
    <td>
        <h1>${title}</h1>
        <small>${artist ?? "⚬⚬⚬"} • ${album ?? "⚬⚬⚬"}</small>
    </td>
    <td>
        <button><i class="fa fa fa-ellipsis-v"></i></button>
    </td>
            `;
	}
	onCurrentTrackChanged() {
		this.setCurrentTrack();
	}
	onSelectedTrackChanged() {
		this.setSelectedTrack();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/timeLineDetailsView.ts
var TimeLineDetailsView = class extends ComponentView {
	streamLines;
	programTitle = "";
	uri = null;
	track;
	constructor(state, component) {
		super(state, component);
	}
	bind() {
		this.state.getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
			await this.onCurrentOrSelectedChanged();
		});
		this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onCurrentOrSelectedChanged();
		});
		this.state.getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", (ev) => {
			this.onStreamLinesChanged();
		});
		this.state.getModel().addEboEventListener("programTitleChanged.eboplayer", (ev) => {
			this.onProgramTitleChanged();
		});
	}
	async onCurrentOrSelectedChanged() {
		let currentTrackUri = this.state.getModel().getCurrentTrack();
		let selectedTrackUri = this.state.getModel().getSelectedTrack();
		await this.setUri(selectedTrackUri ?? currentTrackUri);
	}
	onStreamLinesChanged() {
		let selectedTrackUri = this.state.getModel().getSelectedTrack();
		let currentTrackUri = this.state.getModel().getCurrentTrack();
		this.streamLines = "";
		if (selectedTrackUri == currentTrackUri) {
			let linesObject = this.state.getModel().getActiveStreamLines();
			if (this.uri && linesObject?.uri == this.uri) this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
		}
		this.component.setAttribute("stream_lines", this.streamLines);
	}
	async setUri(uri) {
		this.uri = uri;
		this.track = await this.state.getController().getExpandedTrackModel(uri);
		this.setComponentData();
	}
	setComponentData() {
		let name = "no current track";
		let info = "";
		let position;
		let button;
		let imageUrl;
		if (!this.track) {
			name = "no current track";
			info = "";
			position = "0";
			button = "false";
			imageUrl = "";
		} else if (isInstanceOfExpandedStreamModel(this.track)) {
			name = this.track.stream.name;
			position = "100";
			button = "false";
			imageUrl = this.track.bigImageUrl;
		} else {
			name = this.track.track.title;
			if (this.programTitle) name = this.programTitle + " -  " + name;
			info = this.track.album?.albumInfo?.name ?? "--no name--";
			position = "60";
			button = "true";
			imageUrl = this.track.bigImageUrl;
			let artists = this.track.track.track.artists?.map((a) => a.name).join(", ") ?? "";
			let composers = this.track.track.track.composers?.map((c) => c.name)?.join(", ") ?? "";
			if (artists) info += "<br>" + artists;
			if (composers) info += "<br>" + composers;
		}
		this.component.setAttribute("name", name);
		this.component.setAttribute("info", info);
		this.component.setAttribute("position", position);
		this.component.setAttribute("button", button);
		this.component.setAttribute("img", imageUrl);
		this.onStreamLinesChanged();
	}
	onProgramTitleChanged() {
		this.programTitle = this.state.getModel().getCurrentProgramTitle();
		this.setComponentData();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/album/eboAlbumTracksComp.ts
var EboAlbumTracksComp = class EboAlbumTracksComp extends EboComponent {
	get selected_track_uris() {
		return this._selected_track_uris;
	}
	set selected_track_uris(value) {
		this._selected_track_uris = value;
		this.requestUpdate();
	}
	static tagName = "ebo-album-tracks-view";
	static observedAttributes = ["img"];
	set activeTrackUri(value) {
		this._activeTrackUri = value;
		this.highLightActiveTrack();
	}
	get albumInfo() {
		return this._albumInfo;
	}
	set albumInfo(value) {
		if (value != this._albumInfo) {
			this._albumInfo = value;
			this.requestRender();
		}
	}
	_activeTrackUri = null;
	_albumInfo = null;
	_selected_track_uris = [];
	constructor() {
		super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);
		this.albumInfo = null;
		this.requestRender();
	}
	static styleText = `
            <style>
                :host { 
                    display: flex;
                    text-align: start;
                } 
                #wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                .info {
                    font-size: .7em;
                }
                #tableScroller {
                    overflow: scroll;
                    scrollbar-width: none;
                    height: 100%;    
                }
                #tracksTable {
                    width: 100%;
                    border-collapse: collapse;
                    tr {
                        border-bottom: 1px solid #ffffff80;
                    }
                }
                .selected {
                    background-color: var(--selected-background);
                }
            </style>
        `;
	static htmlText = `
            <div id="wrapper">
                <div id="tableScroller">
                    <table id="tracksTable">
                        <colgroup>
                            <col span="1" style="width: auto;">
                            <col span="1" style="width: 1em;">                        
                            <col span="1" style="width: 1em;">                        
                        </colgroup>
                        <tbody>
                        </tbody>                
                    </table>
                </div>          
            </div>
            <dialog popover id="albumTrackPopup">
              Tadaaa....
            </dialog>        
        `;
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestUpdate();
	}
	async render(shadow) {
		let tbody = shadow.getElementById("tracksTable").tBodies[0];
		tbody.innerHTML = "";
		if (this.albumInfo) (await this.albumInfo.getTrackModels()).forEach((track) => {
			let tr = tbody.appendChild(document.createElement("tr"));
			let tdData = tr.appendChild(document.createElement("td"));
			tr.dataset.uri = track.track.uri;
			tdData.innerText = track.track.name ?? "--no name--";
			let tdHeart = tr.appendChild(document.createElement("td"));
			tdHeart.innerHTML = `
                    <ebo-button toggle class="heartButton">
                        <i slot="off" class="fa fa-heart-o"></i>
                        <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>
                    </ebo-button>
                `;
			let tdButton = tr.appendChild(document.createElement("td"));
			tdButton.innerHTML = `
                    <ebo-menu-button >
                        <div class="flexColumn">
                            <button id="" class="roundBorder trackButton">Set genre</button>
                            <button id="" class="roundBorder trackButton">Add to playlist</button>
                            <button id="" class="roundBorder trackButton">Rename</button>
                            <button id="" class="roundBorder trackButton">Artist ></button>
                            <button id="" class="roundBorder trackButton">Album ></button>
                            <div class="flexRow">
                                <button id="addTrack" class="roundBorder trackButton">
                                    <i class="fa fa-plus"></i>
                                </button>
                                <button id="playTrack" class="roundBorder trackButton">
                                    <i class="fa fa-play"></i>
                                </button>
                            </div>
                        </div>  
                    </ebo-menu-button>`;
			tdButton.querySelector("#addTrack")?.addEventListener("click", (ev) => {
				ev.target.closest("ebo-menu-button").closeMenu();
				this.dispatchEboEvent("addTrackClicked.eboplayer", { uri: track.track.uri });
			});
			tdButton.querySelector("#playTrack")?.addEventListener("click", (ev) => {
				ev.target.closest("ebo-menu-button").closeMenu();
				this.dispatchEboEvent("playTrackClicked.eboplayer", { uri: track.track.uri });
			});
			tr.addEventListener("click", (ev) => {
				tr.classList.toggle("selected");
				this.dispatchEboEvent("trackClicked.eboplayer", { uri: tr.dataset.uri });
			});
			tdHeart.querySelector("ebo-button.heartButton").addEboEventListener("pressedChange.eboplayer", (ev) => {
				this.dispatchEboEvent("favoriteToggle.eboplayer", { "uri": track.track.uri });
			});
		});
		this.highLightActiveTrack();
		this.requestUpdate();
	}
	highLightActiveTrack() {
		if (!this._activeTrackUri) return;
		let tr = this.getShadow().querySelector(`tr[data-uri="${this._activeTrackUri}"]`);
		if (tr) tr.classList.add("current", "textGlow");
	}
	async update(shadow) {
		shadow.querySelectorAll("tr").forEach((tr) => {
			if (this._selected_track_uris.includes(tr.dataset.uri)) tr.classList.add("selected");
			else tr.classList.remove("selected");
		});
		await this.updateFavorites();
	}
	getSelectedUris() {
		return [...this.getShadow().querySelectorAll("tr.selected")].map((tr) => {
			return tr.dataset.uri;
		}).filter((uri) => uri != null && uri != "" && uri != void 0);
	}
	async updateFavorites() {
		let trs = this.getShadow().querySelectorAll("#tracksTable tr");
		for (const tr of trs) {
			let isFavorite = await this.albumInfo?.isTrackFavorite(tr.dataset.uri) ?? false;
			tr.querySelector("ebo-button.heartButton").toggleAttribute("pressed", isFavorite);
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboListButtonBar.ts
function ListButtonState_AllHidden() {
	return {
		add: "hide",
		play: "hide",
		edit: "hide",
		replace: "hide",
		save: "hide",
		new_playlist: "hide",
		line_or_icon: "hide"
	};
}
var EboListButtonBar = class EboListButtonBar extends EboComponent {
	get btn_states() {
		return this._btn_states;
	}
	set btn_states(value) {
		this._btn_states = value;
		this.requestUpdate();
	}
	static tagName = "ebo-list-button-bar";
	static observedAttributes = [
		"list_source",
		"uri",
		"use_selected_color"
	];
	_btn_states = ListButtonState_AllHidden();
	list_source;
	uri;
	use_selected_color = false;
	static styleText = `
        <style>
            #buttons {
                display: flex;
                flex-direction: row;
                margin-bottom: .5em;
                button.disabled {
                    opacity: 0.2;
                }
                button.playButton {
                    background-color: var(--playing-background);
                    border: none;
                }
                img {
                    height: 1.2rem;
                }
                ebo-button {
                    height: 1.2rem;
                    width: 1.4rem;
                    position: relative;
                    top: .4rem;
                    margin-inline-start: .5rem;
                }
                button.selected {
                    background-color: var(--selected-background);
                }
            }
        </style>
    `;
	static htmlText = `
        <div id="buttons">
            <button id="btnPlay" class="roundBorder playButton iconButton"><i class="fa fa-play"></i></button>
            <button id="btnAdd" class="roundBorder playButton iconButton"><i class="fa fa-plus"></i></button>
            <button id="btnReplace" class="roundBorder playButton">Replace</button>
            <button id="btnEdit" class="roundBorder"><i class="fa fa-pencil"></i></button>
            <button id="btnSave" class="roundBorder">
                <div class="flexRow">
                    >            
                    <img id="bigImage" src="images/icons/Playlist.svg" alt="New playlist" class="whiteIcon">
                </div>            
            </button>
            <button id="btnNewPlaylist" class="roundBorder">
                <div class="flexRow">
                    <img id="bigImage" src="images/icons/Playlist.svg" alt="New playlist" class="whiteIcon">
                    *            
                </div>            
            </button>
            <ebo-button toggle id="btnDisplayMode" img="images/icons/IconView.svg" class="whiteIcon"></ebo-button>
        </div>                   
    `;
	constructor() {
		super(EboListButtonBar.styleText, EboListButtonBar.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "list_source":
				this.list_source = newValue;
				break;
			case "uri":
				this[name] = newValue;
				break;
			case "use_selected_color": this.updateBoolProperty(name, newValue);
		}
		this.requestUpdate();
	}
	render(shadow) {
		this.addShadowEventListener("btnPlay", "click", () => {
			if (this.btn_states.play != "show") return;
			this.dispatchEboEvent("playItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnAdd", "click", () => {
			if (this.btn_states.add != "show") return;
			this.dispatchEboEvent("addItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnReplace", "click", () => {
			if (this.btn_states.replace != "show") return;
			this.dispatchEboEvent("replaceItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnEdit", "click", () => {
			if (this.btn_states.edit != "show") return;
			this.dispatchEboEvent("editClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnSave", "click", () => {
			if (this.btn_states.save != "show") return;
			this.dispatchEboEvent("saveClicked.eboplayer", {
				source: this.list_source,
				uri: this.uri
			});
		});
		this.addShadowEventListener("btnNewPlaylist", "click", () => {
			if (this.btn_states.new_playlist != "show") return;
			this.dispatchEboEvent("newPlaylistClicked.eboplayer", { source: this.list_source });
		});
		this.shadow.getElementById("btnDisplayMode").addEboEventListener("pressedChange.eboplayer", (ev) => {
			this.dispatchEboEvent("displayModeChanged.eboplayer", { mode: ev.detail.pressed ? "icon" : "line" });
		});
		this.requestUpdate();
	}
	update(shadow) {
		this.updateButtonVisibility("btnPlay", this._btn_states.play);
		this.updateButtonVisibility("btnAdd", this._btn_states.add);
		this.updateButtonVisibility("btnReplace", this._btn_states.replace);
		this.updateButtonVisibility("btnEdit", this._btn_states.edit);
		this.updateButtonVisibility("btnSave", this._btn_states.save);
		this.updateButtonVisibility("btnNewPlaylist", this._btn_states.new_playlist);
		this.updateButtonVisibility("btnDisplayMode", this._btn_states.line_or_icon);
		shadow.querySelectorAll("button.playButton").forEach((button) => {
			button.classList.toggle("selected", this.use_selected_color);
		});
	}
	updateButtonVisibility(id, state) {
		let btn = this.shadow.getElementById(id);
		switch (state) {
			case "show":
				btn.style.display = "";
				break;
			case "hide":
				btn.style.display = "none";
				break;
			case "disabled":
				btn.disabled = true;
				btn.classList.add("disabled");
				break;
			default: break;
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/mainView.ts
var MainView = class extends View {
	browseView;
	albumView;
	radioView;
	constructor(state, browseView, albumView, radioView) {
		super(state);
		this.browseView = browseView;
		this.albumView = albumView;
		this.radioView = radioView;
	}
	bind() {
		this.browseView.bind();
		this.albumView.bind();
		this.radioView.bind();
		document.getElementById("headerSearchBtn")?.addEventListener("click", () => {
			this.onBrowseButtonClick();
		});
		document.getElementById("headerNowPlayingBtn")?.addEventListener("click", () => {
			this.onNowPlayingButtonClick();
		});
		document.getElementById("headerFavoritesBtn")?.addEventListener("click", async () => {
			await this.state.getController().gotoFavorites();
		});
		document.getElementById("settingsBtn")?.addEventListener("click", async () => {
			await this.onSettingsButtonClick();
		});
		this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onSelectedTrackChanged();
		});
		this.state.getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
			await this.onTrackListChanged();
		});
		this.state.getModel().addEboEventListener("viewChanged.eboplayer", async () => {
			await this.setCurrentView();
		});
		this.state.getModel().addEboEventListener("albumToViewChanged.eboplayer", async () => {
			await this.onAlbumToViewChanged();
		});
		this.state.getModel().addEboEventListener("currentRadioChanged.eboplayer", async () => {
			await this.onRadioToViewChanged();
		});
		let timelineDetailsView = document.getElementById("timelineDetails");
		timelineDetailsView.addEboEventListener("bigTimelineImageClicked.eboplayer", async () => {
			await this.onTimelineBigImgClick();
		});
		timelineDetailsView.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
			timelineDetailsView.setAttribute("show_back", "false");
		});
		this.state.getModel().addEboEventListener("scanStatusChanged.eboplayer", (ev) => {
			let settingsComp$1 = document.getElementById("settingsView");
			settingsComp$1.scanStatus = ev.detail.text;
		});
		this.state.getModel().addEboEventListener("scanFinished.eboplayer", () => {
			document.getElementById("settingsView").setAttribute("show_whats_new", "");
		});
		let settingsComp = document.getElementById("settingsView");
		settingsComp.addEboEventListener("scanRequested.eboplayer", async () => {
			await this.state.getController().startScan();
		});
		settingsComp.addEboEventListener("whatsNewRequested.eboplayer", () => {
			window.location.hash = "#WhatsNew";
			window.location.reload();
		});
		let layout = document.getElementById("layout");
		addEboEventListener(layout, "rememberedRequested.eboplayer", () => {
			this.state.getController().viewController.setView(Views.Remembered);
		});
		addEboEventListener(layout, "genreSelected.eboplayer", (ev) => {
			this.onGenreSelected(ev.detail.text);
		});
		addEboEventListener(layout, "favoriteToggle.eboplayer", async (ev) => {
			await this.onToggleFavorite(ev.detail.uri);
		});
		addEboEventListener(layout, "rememberStreamLines.eboplayer", async (ev) => {
			await this.rememberStreamLines(ev.detail.lines);
		});
	}
	getListButtonStates(currentView) {
		let states = ListButtonState_AllHidden();
		switch (currentView) {
			case Views.Album:
				states = this.showHideTrackAndAlbumButtons(states, "show");
				states.new_playlist = "hide";
				states.edit = "hide";
				states.line_or_icon = "hide";
				return states;
			case Views.Radio:
				states = this.showHideTrackAndAlbumButtons(states, "show");
				states.new_playlist = "hide";
				states.edit = "hide";
				states.line_or_icon = "hide";
				return states;
		}
		return states;
	}
	showHideTrackAndAlbumButtons(states, state) {
		states.add = state;
		states.replace = state;
		states.play = state;
		states.save = state;
		states.edit = state;
		return states;
	}
	onBrowseButtonClick() {
		this.state.getController().viewController.setView(Views.Browse);
	}
	onNowPlayingButtonClick() {
		this.state.getController().viewController.setView(Views.NowPlaying);
	}
	async setCurrentView() {
		let view = this.state.getModel().getView();
		await this.showView(view);
	}
	hashToViewId(hash) {
		switch (hash) {
			case Views.NowPlaying: return "timelineDetails";
			case Views.Browse: return "browseView";
			case Views.WhatsNew: return "browseView";
			case Views.Remembered: return "rememberedView";
			case Views.Album: return "bigAlbumView";
			case Views.Settings: return "settingsView";
			case Views.Genres: return "genresView";
			case Views.Radio: return "bigRadioView";
			default: return unreachable(hash);
		}
	}
	async showView(view) {
		document.querySelectorAll(".fullView").forEach((v) => v.classList.remove("shownView"));
		document.getElementById(this.hashToViewId(view)).classList.add("shownView");
		let browseBtn = document.getElementById("headerSearchBtn");
		let nowPlayingBtn = document.getElementById("headerNowPlayingBtn");
		let layout = document.getElementById("layout");
		[...layout.classList].filter((c) => [
			"browse",
			"bigAlbum",
			"bigTrack"
		].includes(c))[0];
		let resultsDisplayMode = this.state.getController().localStorageProxy.getLineOrIconPreference();
		layout.classList.remove("showFullView");
		switch (view) {
			case Views.WhatsNew:
				await this.state.getController().setWhatsNewFilter();
				resultsDisplayMode = "icon";
				layout.classList.add("showFullView");
			case Views.Browse:
				location.hash = view;
				browseBtn.style.display = "none";
				nowPlayingBtn.style.display = "block";
				this.browseView.updateCompFromState(resultsDisplayMode);
				layout.classList.add("showFullView");
				break;
			case Views.NowPlaying:
				location.hash = "";
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "none";
				break;
			case Views.Album:
				location.hash = Views.Album;
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "block";
				let albumComp = document.getElementById("bigAlbumView");
				albumComp.btn_states = this.getListButtonStates(view);
				layout.classList.add("showFullView");
				break;
			case Views.Radio:
				location.hash = Views.Radio;
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "block";
				let radioComp = document.getElementById("bigRadioView");
				radioComp.btn_states = this.getListButtonStates(view);
				layout.classList.add("showFullView");
				break;
			case Views.Settings:
				location.hash = Views.Settings;
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "block";
				layout.classList.add("showFullView");
				break;
			case Views.Remembered:
				location.hash = Views.Remembered;
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "block";
				layout.classList.add("showFullView");
				break;
			case Views.Genres:
				location.hash = Views.Genres;
				browseBtn.style.display = "block";
				nowPlayingBtn.style.display = "block";
				layout.classList.add("showFullView");
				break;
			default: return unreachable(view);
		}
	}
	async onTimelineBigImgClick() {
		let selectedTrack = this.state.getModel().getSelectedTrack();
		if (!selectedTrack) return;
		let expandedTrackInfo = await this.state.getController().getExpandedTrackModel(selectedTrack);
		if (!expandedTrackInfo) return;
		if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
			if (expandedTrackInfo.album?.albumInfo) this.state.getController().viewController.showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri);
			else this.state.getController().showTempMessage("This track has no album.", MessageType.Error);
			return;
		}
		if (isInstanceOfExpandedStreamModel(expandedTrackInfo)) this.state.getController().viewController.showRadio(expandedTrackInfo.stream.ref.uri);
	}
	async onTrackListChanged() {
		if (!this.state.getModel().getCurrentTrack()) {
			let trackList = this.state.getModel().getTrackList();
			if (trackList.length > 0) await this.state.getController().setCurrentTrackAndFetchDetails(trackList[0]);
		}
	}
	async onSelectedTrackChanged() {
		let uri = this.state.getModel().getSelectedTrack();
		this.state.getController().cache.lookupTrackCached(uri).then(async (track) => {
			if (track?.type == "file") {
				if (track.track.album) {
					let albumModel = await this.state.getController().getExpandedAlbumModel(track.track.album.uri);
					this.albumView.setAlbumComponentData(albumModel, track.track.uri);
				}
			} else if (track?.type == "stream") {
				let albumComp = document.getElementById("bigAlbumView");
				let streamModel = await this.state.getController().getExpandedTrackModel(track.track.uri);
				albumComp.albumInfo = null;
				albumComp.setAttribute("img", streamModel.bigImageUrl);
				albumComp.setAttribute("name", streamModel.stream.name);
				let timelineDetails = document.getElementById("timelineDetails");
				timelineDetails.streamInfo = streamModel;
			}
		});
	}
	async onAlbumToViewChanged() {
		let albumToView = this.state.getModel().getAlbumToView();
		if (!albumToView) return;
		let albumModel = await this.state.getController().getExpandedAlbumModel(albumToView.albumUri);
		this.albumView.setAlbumComponentData(albumModel, albumToView.selectedTrackUri);
	}
	async onRadioToViewChanged() {
		let radioToView = this.state.getModel().getRadioToView();
		if (!radioToView) return;
		let radioModel = await this.state.getController().getExpandedTrackModel(radioToView);
		this.radioView.setStreamComponentData(radioModel);
	}
	async rememberStreamLines(lines) {
		await this.state.getController().remember(lines.join("\n"));
	}
	async onSettingsButtonClick() {
		await this.showView(Views.Settings);
	}
	onGenreSelected(genre) {
		let albumBeingEdited = this.state.getController().localStorageProxy.getAlbumBeingEdited();
		if (!albumBeingEdited) return;
		this.state.getController().saveAlbumGenre(albumBeingEdited, genre);
	}
	async onToggleFavorite(uri) {
		await this.state.getController().toggleFavorite(uri);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/browse/eboBrowseComp.ts
var EboBrowseComp = class EboBrowseComp extends EboComponent {
	get hideInfoButton() {
		return this._hideInfoButton;
	}
	set hideInfoButton(value) {
		this._hideInfoButton = value;
		this.requestUpdate();
	}
	static tagName = "ebo-browse-view";
	static observedAttributes = ["display_mode"];
	currentResultHasImages = false;
	_hideInfoButton = false;
	get genreReplacements() {
		return this._genreReplacements;
	}
	set genreReplacements(value) {
		this._genreReplacements = value;
	}
	get action_btn_states() {
		return this._action_btn_states;
	}
	set action_btn_states(value) {
		this._action_btn_states = value;
		this.requestUpdate();
	}
	static listSource = "browseView";
	_action_btn_states = ListButtonState_AllHidden();
	get breadCrumbs() {
		return this._breadCrumbs;
	}
	set breadCrumbs(value) {
		this._breadCrumbs = value;
		this.renderBreadCrumbs();
	}
	_breadCrumbs = [];
	get results() {
		return this._results;
	}
	set results(value) {
		this._results = value;
		this.renderResults();
		this.requestUpdate();
	}
	_results = EmptySearchResults;
	get browseFilter() {
		return this._browseFilter;
	}
	set browseFilter(value) {
		if (JSON.stringify(this._browseFilter) == JSON.stringify(value)) return;
		this._browseFilter = value;
		this.requestUpdate();
	}
	display_mode = "line";
	_browseFilter;
	_genreReplacements;
	static styleText = `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #filterButtons {
                margin-top: .3em;
                display: flex;
                flex-direction: row;
            }
            #searchBox {
                & input {
                    flex-grow: 1;
                    color: white;
                    border: none;
                    &:focus {
                        outline: none;
                    }
                }
            }
            
           #filterBox {
                margin-block: .5rem;
                padding:.3rem;
                background-color: rgba(0,0,0,.5);
                border-radius: .5rem;
            }
            .filterButton {
                width: 1.5em;
                height: 1.5em;
                object-fit: contain;
                margin-right: .5em;
            }
            #searchResults {
                display: flex;
                flex-direction: column;
                overflow: hidden;
                height: 100%;
            }
            #tableWrapper {
                height: 100%;
                width: 100%;
                overflow: scroll;
                scrollbar-width: none;
                td {
                    padding-top: .2em;
                    padding-bottom: .2em;
                }
            }
            :host(.line) #tableWrapper {
                display: flex;
                flex-direction: column;
            }
            :host(.icon) #tableWrapper {
                display: grid;
                grid-template-columns: repeat(3, auto);
            }
            .breadcrumb {
                background-color: var(--highlight-background);
                border-radius: 1rem;
                padding-inline-start: 0.5rem;
                padding-inline-end: 0.6em;
                corner-inline-end-shape: bevel;
                .filterButton {
                    filter: invert(100%) sepia(100%) saturate(0%) hue-rotate(350deg) brightness(104%) contrast(102%);
                    height: 1rem;
                    width: 1rem;
                    position: relative;
                    top: .1rem;
                    margin-right: .2rem;
                }
            }
            #expandFilterBtn {
                margin-left: .5rem;
            }
        </style>
        `;
	static htmlText = `
<div id="wrapper">
    <div id="breadCrumbs"></div>
    <ebo-browse-filter></ebo-browse-filter>
    <div id="searchResults">
        <ebo-list-button-bar list_source="${this.listSource}"></ebo-list-button-bar>
        <div id="searchInfo">
        </div>  
        <div id="tableWrapper">
            Wait for it...
        </div>
    </div>
</div>        
        `;
	constructor() {
		super(EboBrowseComp.styleText, EboBrowseComp.htmlText);
		this._browseFilter = new BrowseFilter();
		this.results = EmptySearchResults;
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "display_mode":
				this.updateStringProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	setFocusAndSelect() {
		let searchText = this.getShadow().getElementById("searchText");
		searchText?.focus();
		searchText?.select();
	}
	render(shadow) {
		this.renderBreadCrumbs();
		this.renderResults();
		this.requestUpdate();
	}
	update(shadow) {
		let listButtonBar = shadow.querySelector("ebo-list-button-bar");
		listButtonBar.btn_states = this.action_btn_states;
		let browseFilterComp = shadow.querySelector("ebo-browse-filter");
		browseFilterComp.browseFilter = this._browseFilter;
		browseFilterComp.availableRefTypes = this.results.availableRefTypes;
		let activeDisplayMode = this.display_mode;
		shadow.querySelectorAll("ebo-list-item").forEach((line) => line.setAttribute("display", activeDisplayMode));
		this.classList.remove("icon", "line");
		this.classList.add(activeDisplayMode);
		this.updateHideInfoButton();
	}
	setSearchInfo(text) {
		let searchInfo = this.getShadow().getElementById("searchInfo");
		if (searchInfo) searchInfo.innerHTML = text;
	}
	renderBreadCrumbs() {
		if (!this.isRendered) return;
		let breadCrumbsDiv = this.getShadow().getElementById("breadCrumbs");
		breadCrumbsDiv.innerHTML = this.breadCrumbs.map((crumb) => this.renderBreadcrumb(crumb)).join(" ");
		breadCrumbsDiv.querySelectorAll("button").forEach((btn) => {
			btn.addEventListener("click", (ev) => {
				this.onBreadCrumbClicked(ev);
			});
		});
	}
	renderBreadcrumb(crumb) {
		if (crumb instanceof BreadCrumbRef) return `<button data-id="${crumb.id}" class="breadcrumb uri">${crumb.label}</button>`;
		else if (crumb instanceof BreadCrumbBrowseFilter) {
			let selectedFilters = crumb.data.getSelectedFilters();
			let imgTags = "";
			let filterText = "";
			imgTags = selectedFilters.map((filter) => this.filterToImg(filter)).join("");
			if (crumb.data.searchText) filterText = `"${crumb.data.searchText}"`;
			return `<button data-id="${crumb.id}" class="breadcrumb filter">${imgTags}${filterText}</button>`;
		} else if (crumb instanceof BreadCrumbHome) return `<button data-id="${crumb.id}" class="breadcrumb filter"><i class="fa fa-home"></i></button>`;
		return unreachable(crumb);
	}
	filterToImg(filter) {
		let imgUrl = "";
		switch (filter) {
			case "album":
				imgUrl = "images/icons/Album.svg";
				break;
			case "track":
				imgUrl = "images/icons/Track.svg";
				break;
			case "radio":
				imgUrl = "images/icons/Radio.svg";
				break;
			case "artist":
				imgUrl = "images/icons/Artist.svg";
				break;
			case "playlist":
				imgUrl = "images/icons/Playlist.svg";
				break;
			case "genre":
				imgUrl = "images/icons/Genre.svg";
				break;
		}
		return `<img class="filterButton" src="${imgUrl}" alt="">`;
	}
	async renderResults() {
		if (!this.isRendered) return;
		this.setSearchInfo("");
		let tableWrapper = this.getShadow().getElementById("tableWrapper");
		tableWrapper.innerHTML = "--no results--";
		if (this.results.refs.length == 0) return;
		tableWrapper.innerHTML = "";
		let html = "";
		for (let result of this.results.refs) {
			let refType = result.item.refType;
			let imageUrl = result.getImageUrl();
			let imageClass = "";
			if (imageUrl.endsWith(".svg")) imageClass = "whiteIcon svgImage";
			html += `
                    <ebo-list-item
                        data-uri="${result.item.uri}"
                        data-type="${refType}"
                        text="${result.item.name + this.getGenreAlias(result)}"
                        img="${imageUrl}"
                        image_class="${imageClass}">
                    </ebo-list-item>`;
		}
		tableWrapper.innerHTML = html;
		tableWrapper.querySelectorAll("ebo-list-item").forEach((row) => {
			row.addEventListener("dblclick", (ev) => {
				this.onRowDoubleClicked(ev).then((r) => {});
			});
			row.addEventListener("click", (ev) => {
				this.onRowClicked(ev);
			});
		});
		this.requestUpdate();
	}
	getGenreAlias(result) {
		if (!(result instanceof GenreSearchResult)) return "";
		let genreReplacement = this.genreReplacements?.get(result.item.name);
		if (!genreReplacement) return "";
		if (genreReplacement.replacement != null) return ` (${genreReplacement.replacement})`;
		return "";
	}
	onRowClicked(ev) {
		let row = ev.currentTarget;
		this.dispatchEboEvent("browseResultClick.eboplayer", {
			"label": row.getAttribute("text") ?? "",
			"uri": row.dataset.uri,
			"type": row.dataset.type
		});
	}
	async onRowDoubleClicked(ev) {
		let row = ev.currentTarget;
		this.dispatchEboEvent("browseResultDblClick.eboplayer", { uri: row.dataset.uri });
	}
	onBreadCrumbClicked(ev) {
		let btn = ev.currentTarget;
		this.dispatchEboEvent("breadCrumbClick.eboplayer", { breadcrumbId: parseInt(btn.dataset.id) });
	}
	updateHideInfoButton() {
		let eboBrowseFilter = this.getShadow().querySelector("ebo-browse-filter");
		eboBrowseFilter.hideInfoButton = this.hideInfoButton;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/MouseTimer.ts
const TIME_OUT_TIME = 500;
var MouseTimer = class {
	activeTimer;
	source;
	mouseUpCount = 0;
	isMouseDown = false;
	onClick = void 0;
	onTimeOut = void 0;
	onMultiClick = void 0;
	constructor(source, onClick = void 0, onMultiClick = void 0, onTimeOut = void 0) {
		this.source = source;
		this.onClick = onClick;
		this.onMultiClick = onMultiClick;
		this.onTimeOut = onTimeOut;
	}
	onMouseDown = (ev) => {
		this.isMouseDown = true;
		if (this.activeTimer) return;
		this.startPressTimer(ev, () => {
			this.doTimeOut();
		});
	};
	onMouseUp = (ev) => {
		this.isMouseDown = false;
		if (!this.activeTimer) return;
		this.mouseUpCount++;
		if (this.mouseUpCount > 1) {
			this.onMultiClick?.(this.source, this.mouseUpCount);
			return;
		}
		this.onClick?.(this.source);
	};
	onMouseLeave = (ev) => {
		this.cancelPressTimer();
	};
	doTimeOut() {
		this.cancelPressTimer();
		if (!this.isMouseDown) return;
		this.onTimeOut?.(this.source);
	}
	cancelPressTimer() {
		if (this.activeTimer) clearTimeout(this.activeTimer);
		this.activeTimer = null;
	}
	startPressTimer(ev, onTimeOutCallback) {
		this.mouseUpCount = 0;
		this.activeTimer = window.setTimeout(() => {
			if (this.activeTimer) onTimeOutCallback(ev);
			this.cancelPressTimer();
		}, TIME_OUT_TIME);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/general/eboButton.ts
var EboButton = class EboButton extends EboComponent {
	static tagName = "ebo-button";
	static observedAttributes = [
		"toggle",
		"img",
		"img_pressed",
		"pressed",
		"opacity_off",
		"click",
		"disabled"
	];
	pressed = false;
	disabled = false;
	img;
	pressTimer;
	toggle = false;
	static styleText = `
        <style>
            img {
                width: 100%;
            }
            :host {
                opacity: 1;
            }
            :host([toggle]) { 
                opacity: 0.5; 
            }
            :host([pressed]) { 
                opacity: 1; 
            }
            :host([disabled]) {
                opacity: .2; 
            }
        </style>
    `;
	static htmlText = `
        <button>
            <img id="bigImage" src="" alt="Button image">
            <slot></slot>      
            <slot name="on"></slot>     
            <slot name="off"></slot>     
        </button>
        `;
	constructor() {
		super(EboButton.styleText, EboButton.htmlText);
		this.img = "";
		this.pressTimer = new MouseTimer(this, (source) => this.onClick(source), (source, clickCount) => this.onMultiClick(source, clickCount), (source) => this.onFilterButtonTimeOut(source));
		this.addEventListener("click", (ev) => {
			ev.stopPropagation();
		});
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "img":
				this[name] = newValue;
				break;
			case "pressed":
			case "disabled":
			case "toggle":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		let button = shadow.querySelector("button");
		button.addEventListener("mousedown", (ev) => {
			this.pressTimer.onMouseDown(ev);
		});
		button.addEventListener("mouseup", (ev) => {
			this.pressTimer.onMouseUp(ev);
		});
		button.addEventListener("mouseleave", (ev) => {
			this.pressTimer.onMouseLeave(ev);
		});
		this.requestUpdate();
	}
	update(shadow) {
		let imgTag = shadow.getElementById("bigImage");
		if (this.img) {
			imgTag.src = this.img;
			imgTag.style.display = "";
		} else imgTag.style.display = "none";
		if (this.toggle) this.setClassFromBoolAttribute(imgTag, "pressed");
		this.setClassFromBoolAttribute(imgTag, "disabled");
		let onSlot = shadow.querySelector("slot[name='on']");
		let offSlot = shadow.querySelector("slot[name='off']");
		onSlot.style.display = this.pressed ? "block" : "none";
		offSlot.style.display = this.pressed ? "none" : "block";
	}
	onClick(eboButton) {
		if (this.disabled) return;
		let button = this.getShadow().querySelector("button");
		if (this.toggle) {
			this.pressed = !this.pressed;
			this.setClassFromBoolAttribute(button, "pressed");
			this.setAttribute("pressed", this.pressed.toString());
		}
		this.dispatchEboEvent("pressedChange.eboplayer", { pressed: this.pressed });
	}
	onFilterButtonTimeOut(source) {
		this.dispatchEboEvent("longPress.eboplayer", {});
	}
	onMultiClick(eboButton, clickCount) {
		if (this.disabled) return;
		this.dispatchEvent(new Event("dblclick", {
			bubbles: true,
			composed: true
		}));
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/album/eboBigAlbumComp.ts
var EboBigAlbumComp = class EboBigAlbumComp extends EboComponent {
	static tagName = "ebo-big-album-view";
	static observedAttributes = [
		"name",
		"extra",
		"img",
		"disabled"
	];
	get selected_track_uris() {
		return this.getShadow().querySelector("ebo-album-tracks-view").selected_track_uris;
	}
	set selected_track_uris(value) {
		this.getShadow().querySelector("ebo-album-tracks-view").selected_track_uris = value;
		this.requestUpdate();
	}
	get btn_states() {
		return this._btn_states;
	}
	set btn_states(value) {
		this._btn_states = value;
		this.requestUpdate();
	}
	get activeTrackUri() {
		return this._activeTrackUri;
	}
	set activeTrackUri(value) {
		this._activeTrackUri = value;
		this.onActiveTrackChanged();
	}
	get albumInfo() {
		return this._albumInfo;
	}
	set albumInfo(value) {
		this._albumInfo = value;
		this.requestUpdate();
	}
	_activeTrackUri = null;
	static progressBarAttributes = [
		"position",
		"min",
		"max",
		"button",
		"active"
	];
	name = "";
	extra = "";
	img = "";
	_albumInfo = null;
	_btn_states = ListButtonState_AllHidden();
	static styleText = `
        <style>
            :host { 
                display: flex;
            } 
            h3 {
                margin-block-start: .5em;
                margin-block-end: .5em;
            }
            .albumCoverContainer {
                display: flex;
                flex-direction: column;
                align-content: center;
                overflow: hidden;
                flex-wrap: wrap;
            }
            img {
                max-width: 90vw;
                height: 45vh;
                object-fit: contain;
                background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
            }
            ebo-progressbar {
                margin-top: .5em;
            }
            #wrapper {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                #bottom {
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
            }
            #wrapper.front {
                #back {
                    display: none;
                }                
            }
            #wrapper.back {
                #front {
                    display: none;
                }                
            }
            .info {
                font-size: .7em;
            }
            #albumTableWrapper {
                overflow: hidden;
            }
            ebo-album-tracks-view {
                height: 100%;
            }
            #back {
                min-height: 40vh;
            }
        </style>
        `;
	static list_source = "albumView";
	static htmlText = `
        <div id="wrapper" class="front">
            <div id="top">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="bigImage" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 class="selectable flexRow">
                            <div id="name" class="selectable flexGrow"></div>
                            <ebo-button id="btnFavorite" toggle>
                                <i slot="off" class="fa fa-heart-o"></i>
                                <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>                            
                            </ebo-button>
                        </h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <ebo-album-details></ebo-album-details>
                </div>                
            </div>
            <div id="bottom">
                <ebo-list-button-bar list_source="${this.list_source}"></ebo-list-button-bar>
                <div id="albumTableWrapper">
                    <ebo-album-tracks-view img="" ></ebo-album-tracks-view>
                </div>
            </div>
        </div>        
        `;
	constructor() {
		super(EboBigAlbumComp.styleText, EboBigAlbumComp.htmlText);
		this.albumInfo = null;
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboBigAlbumComp.progressBarAttributes.includes(name)) {
			this.updateStringProperty(name, newValue);
			return;
		}
		switch (name) {
			case "name":
			case "extra":
			case "img":
				this[name] = newValue;
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		this.shadow.getElementById("bigImage").addEventListener("click", () => {
			let wrapper = this.getShadow().querySelector("#wrapper");
			wrapper.classList.toggle("front");
			wrapper.classList.toggle("back");
		});
		this.addEboEventListener("detailsAlbumImgClicked.eboplayer", () => {
			let wrapper = this.getShadow().querySelector("#wrapper");
			wrapper.classList.add("front");
			wrapper.classList.remove("back");
		});
		shadow.getElementById("btnFavorite").addEboEventListener("pressedChange.eboplayer", (ev) => {
			this.dispatchEboEvent("favoriteToggle.eboplayer", { "uri": this.albumInfo?.album.ref.uri });
		});
	}
	update(shadow) {
		["name", "extra"].forEach((attName) => {
			shadow.getElementById(attName).innerHTML = this[attName];
		});
		let tracksComp = shadow.querySelector("ebo-album-tracks-view");
		tracksComp.albumInfo = this.albumInfo;
		let img = shadow.getElementById("bigImage");
		if (this.img != "") {
			img.style.visibility = "";
			img.src = this.img;
		} else img.style.visibility = "hidden";
		if (this.albumInfo) {
			shadow.querySelector("ebo-list-button-bar").setAttribute("uri", this.albumInfo.album.albumInfo?.uri ?? "--no albumInfo--");
			let albumDetails = shadow.querySelector("ebo-album-details");
			albumDetails.albumInfo = this.albumInfo;
		}
		let listButtonBar = shadow.querySelector("ebo-list-button-bar");
		listButtonBar.btn_states = this.btn_states;
		if (this.selected_track_uris.length > 0) listButtonBar.setAttribute("use_selected_color", "true");
		else listButtonBar.removeAttribute("use_selected_color");
		this.updateFavorite();
	}
	onActiveTrackChanged() {
		let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view");
		tracksComp.activeTrackUri = this.activeTrackUri;
	}
	updateFavorite() {
		let btnFavorite = this.shadow.getElementById("btnFavorite");
		if (this.albumInfo) this.albumInfo.isFavorite().then((isFavorite) => {
			btnFavorite.toggleAttribute("pressed", isFavorite);
		});
		else btnFavorite.removeAttribute("pressed");
		this.getShadow().querySelector("ebo-album-tracks-view").updateFavorites();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboPlayerBar.ts
var EboPlayerBar = class EboPlayerBar extends EboComponent {
	get playMode() {
		return this._playMode;
	}
	set playMode(value) {
		this._playMode = value;
		this.requestUpdate();
	}
	static tagName = "ebo-player-bar";
	static observedAttributes = [
		"play_state",
		"image_url",
		"show_info",
		"volume",
		"allow_play",
		"allow_prev",
		"allow_next",
		"text",
		"stop_or_pause"
	];
	play_state;
	show_info = false;
	isVolumeSliding = false;
	volume = 0;
	allow_play = true;
	allow_prev = true;
	allow_next = true;
	text = "";
	image_url = "";
	stop_or_pause;
	_playMode = "justPlay";
	static styleText = `
        <style>
            img {
                width: 2em;
                height: 2em;
                margin-right: 1em;
            }
        
            .playing {
                background-color: var(--playing-background);
            }
            #buttonBar  {
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
                align-items: center;
                align-content: center;
            
                & button {
                    padding-left: .5ch;
                    padding-right: .5ch;
                }
            }
            #buttonBar {
                display: flex;
                justify-content: center;
                align-items: center;
            }
            #volumeSlider {
                width: 100px;
            }
            input[type='range'] {
                & {
                    margin: 10px 5px;
                    height: 2px;
                    background-color: gray;
                    -webkit-appearance: none;
                }
            
                &::-webkit-slider-thumb {
                    padding: 0;
            
                    width: 7px;
                    appearance: none;
                    height: 7px;
                    background: white;
                    color: white;
                    border-color: white;
                    border-style: solid;
                    border-width:7px;
                    border-radius: 7px;
                }
            }
            #wrapper {
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding-top: .5em;
                padding-bottom: .5em;
            }
            #text {
                font-size: .7em;
                text-align: center;
                display: block;
            }
        </style>
    `;
	static htmlText = `
        <div id="wrapper">
            <div id="info">
                <span id="text" class="selectable">sdfsdf sdfsdf </span>
            </div>
            <div id="buttonBar">
                <img id="buttonBarImg" src="images/default_cover.png" alt="Album cover"/>
                <div id="buttonBar">
                    <button id="btnPrev" title="Previous"><i class="fa fa-fast-backward"></i></button>
                    <button id="btnPlay" title="Play"><i class="fa fa-play"></i></button>
                    <button id="btnNext" title="Next"><i class="fa fa-fast-forward"></i></button>
                    <input id="volumeSlider" data-highlight="true" name="volumeSlider" data-mini="true" type="range" min="0" value="0" max="100"/>
                    <ebo-dropdown id="btnRepeat" style="margin-left: 1em;">
                        <ebo-option value="justPlay"><i class="fa fa-ellipsis-h"></i></ebo-option>
                        <ebo-option value="repeat"><img src="images/icons/Repeat.svg" alt="Repeat" class="whiteIcon dropDownImage" style="margin-block-start: .2rem;"></ebo-option>
                        <ebo-option value="repeatSingle" ><img src="images/icons/RepeatOne.svg" alt="Repeat one" class="whiteIcon dropDownImage" style="margin-block-start: .2rem;"></ebo-option>
                    </ebo-dropdown>
                </div>
            </div>
        </div>
        `;
	constructor() {
		super(EboPlayerBar.styleText, EboPlayerBar.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "image_url":
			case "text":
			case "play_state":
			case "stop_or_pause":
				this[name] = newValue;
				break;
			case "volume":
				this.volume = parseInt(newValue);
				break;
			case "show_info":
			case "allow_play":
			case "allow_prev":
			case "allow_next":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		let slider = shadow.getElementById("volumeSlider");
		slider.oninput = (ev) => {
			this.isVolumeSliding = true;
			this.volume = quadratic100(parseInt(slider.value));
			this.dispatchEboEvent("changingVolume.eboplayer", { volume: this.volume });
		};
		slider.onmousedown = slider.ontouchstart = () => {
			this.isVolumeSliding = true;
		};
		slider.onmouseup = slider.ontouchend = () => {
			this.isVolumeSliding = false;
		};
		let btnPlay = shadow.getElementById("btnPlay");
		btnPlay.addEventListener("click", (ev) => {
			switch (btnPlay.querySelector("i")?.title) {
				case "Play":
					this.dispatchEboEvent("playPressed.eboplayer", {});
					break;
				case "Pause":
					this.dispatchEboEvent("pausePressed.eboplayer", {});
					break;
				case "Stop":
					this.dispatchEboEvent("stopPressed.eboplayer", {});
					break;
			}
		});
		shadow.getElementById("buttonBarImg").addEventListener("click", (ev) => {
			this.dispatchEboEvent("buttonBarAlbumImgClicked.eboplayer", {});
		});
	}
	update(shadow) {
		switch (this.play_state) {
			case "playing":
				if (this.stop_or_pause == "pause") this.setPlayButton("Pause", "fa-pause");
				else this.setPlayButton("Stop", "fa-stop");
				break;
			case "stopped":
			case "paused":
				this.setPlayButton("Play", "fa-play");
				break;
		}
		shadow.getElementById("btnNext").style.opacity = this.allow_next ? "1" : "0.5";
		shadow.getElementById("btnPrev").style.opacity = this.allow_prev ? "1" : "0.5";
		shadow.getElementById("btnPlay").style.opacity = this.allow_play ? "1" : "0.5";
		switch (this.playMode) {
			case "repeat":
			case "repeatSingle":
			case "justPlay":
			case "single":
				shadow.getElementById("btnRepeat")?.setAttribute("value", this.playMode);
				break;
			default: unreachable(this.playMode);
		}
		let titleEl = shadow.getElementById("text");
		let img = shadow.querySelector("img");
		titleEl.style.display = this.show_info ? "" : "none";
		if (this.image_url) {
			img.style.visibility = "visible";
			img.setAttribute("src", this.image_url);
		} else img.style.visibility = "hidden";
		if (!this.isVolumeSliding) {
			let slider = shadow.getElementById("volumeSlider");
			let visualVolume = inverseQuadratic100(this.volume);
			slider.value = Math.floor(visualVolume).toString();
		}
		shadow.getElementById("wrapper").classList.toggle("playing", this.play_state == "playing");
		titleEl.innerHTML = this.text.replaceAll("\n", "<br/>");
	}
	setPlayButton(title, addClass) {
		let btnPlayIcon = this.getShadow().getElementById("btnPlay")?.querySelector("i");
		btnPlayIcon.classList.remove("fa-play", "fa-pause", "fa-stop");
		btnPlayIcon.classList.add(addClass);
		btnPlayIcon.setAttribute("title", title);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/general/eboMenuButton.ts
var EboMenuButton = class EboMenuButton extends EboComponent {
	static tagName = "ebo-menu-button";
	static observedAttributes = [];
	static styleText = `
        <style>
            .menuButton {
                padding: 0;
                border-radius: 100vw;
                aspect-ratio: 1;
                
                anchor-name: --popup-button;
            }
            
            .popupMenu {
                border: solid white 1px;
                border-radius: 20px 20px 0px 20px;
                position-anchor: --popup-button;
                margin: 0;
                inset: auto;
                bottom: anchor(top);
                right: anchor(right);
                opacity: 0;
                margin-inline-start: 0.25rem;
                background-color: var(--body-background);
                
                &:popover-open {
                    opacity: 1;
                }
            }
            
            .trackButton {
                border-color: gray;
                text-align: left;
                & i {
                    position: relative;
                    top: 2px;
                }
            }
      </style>
    `;
	static htmlText = `
        <button class="menuButton" popovertarget="menu">
            ...
        </button>
        <div popover id="menu" class="popupMenu">
            <slot></slot>
        </div>
        `;
	constructor() {
		super(EboMenuButton.styleText, EboMenuButton.htmlText);
	}
	onConnected() {
		super.onConnected();
		this.requestRender();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestRender();
	}
	closeMenu() {
		this.getShadow().getElementById("menu").hidePopover();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/controllers/playController.ts
var PlayController = class {
	model;
	mopidyProxy;
	constructor(model, mopidyProxy) {
		this.model = model;
		this.mopidyProxy = mopidyProxy;
	}
	async clear() {
		await this.mopidyProxy.clearTrackList();
		this.model.setTrackList([]);
	}
	async clearAndPlay(uris) {
		await this.mopidyProxy.clearTrackList();
		let trackList = await this.add(uris);
		await this.play(trackList[0].tlid);
	}
	async play(tlid = void 0) {
		tlid = tlid ?? this.model.getTrackList()[0].tlid;
		await this.mopidyProxy.playTracklistItem(tlid);
	}
	async add(uris) {
		let tracks = await this.mopidyProxy.addTracksToTracklist(uris);
		this.model.addToTrackList(tracks);
		return tracks;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/proxies/mopidyProxy.ts
var MopidyProxy = class {
	commands;
	constructor(commands) {
		this.commands = commands;
	}
	async fetchRootDirs() {
		return this.browse(null);
	}
	async playTracklistItem(tlid) {
		await this.commands.core.playback.play(null, tlid);
	}
	async addTracksToTracklist(uris) {
		return await this.commands.core.tracklist.add(void 0, void 0, uris);
	}
	async clearTrackList() {
		await this.commands.core.tracklist.clear();
	}
	async browse(uri) {
		return await this.commands.core.library.browse(uri);
	}
	async sendVolume(value) {
		await this.commands.core.mixer.setVolume(Math.round(value));
	}
	async sendStop() {
		return this.commands.core.playback.stop();
	}
	async sendPause() {
		return this.commands.core.playback.pause();
	}
	async sendPlay() {
		return this.commands.core.playback.play();
	}
	async search(uri) {
		return await this.commands.core.library.search({ uri }, [], true);
	}
	async lookup(uris) {
		if (typeof uris == "string") uris = [uris];
		return await this.commands.core.library.lookup(uris);
	}
	async fetchTracklist() {
		return await this.commands.core.tracklist.getTlTracks();
	}
	async fetchHistory() {
		let historyLines = (await this.commands.core.history.getHistory()).map((line) => {
			return {
				timestamp: line[0],
				ref: line[1]
			};
		});
		let foundStreams = /* @__PURE__ */ new Set();
		let filtered = historyLines.filter((line) => {
			if (!line.ref.uri.startsWith("http:")) return true;
			if (foundStreams.has(line.ref.uri)) return false;
			foundStreams.add(line.ref.uri);
			return true;
		});
		let prev = { ref: { uri: "" } };
		return filtered.filter((line) => {
			if (line.ref.uri == prev.ref.uri) return false;
			prev = line;
			return true;
		});
	}
	async fetchCurrentTrack() {
		return await this.commands.core.playback.getCurrentTlTrack();
	}
	async fetchPlayLists() {
		return await this.commands.core.playlists.asList();
	}
	async fetchPlaylistItems(uri) {
		return await this.commands.core.playlists.getItems(uri);
	}
	async fetchImages(uris) {
		return await this.commands.core.library.getImages(uris);
	}
	async fetchVolume() {
		return await this.commands.core.mixer.getVolume();
	}
	async fetchCurrentTlTrack() {
		return await this.commands.core.playback.getCurrentTlTrack();
	}
	async fetchPlayState() {
		return await this.commands.core.playback.getState();
	}
	savePlaylist(playlist) {
		return this.commands.core.playlists.save(playlist);
	}
	setRepeat(repeat) {
		return this.commands.core.tracklist.setRepeat(repeat);
	}
	setSingle(single) {
		return this.commands.core.tracklist.setSingle(single);
	}
	async getPlaybackFlags() {
		let repeat = await this.commands.core.tracklist.getRepeat();
		let single = await this.commands.core.tracklist.getSingle();
		let random = await this.commands.core.tracklist.getRandom();
		let consume = await this.commands.core.tracklist.getConsume();
		return {
			repeat,
			single,
			random,
			consume
		};
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboDialog.ts
var EboDialog = class EboDialog extends EboComponent {
	static tagName = "ebo-dialog";
	static observedAttributes = ["ok_text"];
	ok_text = "TODO";
	static styleText = `
        <style>
            dialog {
                background-color: var(--body-background);
                & input {
                    background-color: var(--body-background);
                }
            }        
        </style>
    `;
	static htmlText = `
        <dialog id="dialog">
            <div id="content">
                <slot></slot>
            </div>
            <div>
                <button id="OkBtn">TODO</button>
                <button id="CancelBtn">Cancel</button>
            </div>
        </dialog>
        `;
	constructor() {
		super(EboDialog.styleText, EboDialog.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "ok_text":
				this[name] = newValue;
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		shadow.getElementById("OkBtn").addEventListener("click", (ev) => {
			this.onOkButtonClick(ev);
		});
		shadow.getElementById("CancelBtn").addEventListener("click", (ev) => {
			this.getShadow().getElementById("dialog").close();
		});
	}
	onOkButtonClick(ev) {
		this.getShadow().getElementById("dialog");
		this.dispatchEboEvent("dialogOkClicked.eboplayer", { dialog: this });
	}
	showModal() {
		this.getShadow().getElementById("dialog").showModal();
	}
	close() {
		this.getShadow().getElementById("dialog").close();
	}
	update(shadow) {
		let okButton = shadow.getElementById("OkBtn");
		okButton.innerText = this.ok_text;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/album/eboAlbumDetails.ts
var EboAlbumDetails = class EboAlbumDetails extends EboComponent {
	get albumInfo() {
		return this._albumInfo;
	}
	set albumInfo(value) {
		this._albumInfo = value;
		this.requestUpdate();
	}
	static tagName = "ebo-album-details";
	static observedAttributes = [];
	_albumInfo = null;
	static styleText = `
        <style>
            * {
                font-size: .8rem;
            }
            #header {
                margin-bottom: .5rem;
            }
            #albumName {
                font-size: 1rem;
            }
            img {
                width: 2.1rem;
                height: 2.1rem;
                object-fit: contain;
                margin-right: .5rem;
            }
            label {
                margin-right: 1rem;
            }
            .replaced {
                opacity: .5;
                text-decoration: line-through;
            }
        </style>
    `;
	static htmlText = `
        <div>
            <div id="header" class="flexRow">
                <img id="bigImage" src="" alt="Album image">
                <span id="albumName" class="selectable"></span>
            </div>
            <div id="tableContainer" class="flexColumn">
                <table>
                    <tbody></tbody>                
                </table>
                <div style="border-block-start: solid 1px rgba(255,255,255,.5); margin-block-start:.5rem; padding-block-start: .5rem;">
                    <div class="flexRow">
                        <button id="btnUpdateAlbumData" class="roundBorder iconButton"><i class="fa fa-refresh"></i></button>
                        <button id="btnSearchImage" 
                            class="roundBorder" 
                            style="padding-inline-start: .7rem;">
                            <img src="../../../images/icons/Google_Favicon_2025.svg" 
                                alt="Search" 
                                style="height: .9rem; width: .9rem; position: relative; top: .15rem;margin-right: .1rem;">
                            Image
                        </button>
                    </div>
                    <label style="display: block; margin-block-start: .3rem; margin-block-end: .1rem;">Upload an album image:</label>
                    <div class="flexRow">
                        <input id="imageUrl" type="text" class="flexGrow">
                        <button id="btnUploadImage" style="margin-inline-start: .3rem;"><i class="fa fa-upload"></i></button>
                    </div>
                </div>            
            </div>        
        </div>
        `;
	constructor() {
		super(EboAlbumDetails.styleText, EboAlbumDetails.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestUpdate();
	}
	render(shadow) {
		shadow.getElementById("bigImage").addEventListener("click", (ev) => {
			this.dispatchEboEvent("detailsAlbumImgClicked.eboplayer", {});
		});
		shadow.getElementById("btnUpdateAlbumData")?.addEventListener("click", () => {
			this.dispatchEboEvent("updateAlbumData.eboplayer", { "uri": this._albumInfo?.album?.ref.uri ?? "--nu album uri--" });
		});
		shadow.getElementById("btnSearchImage")?.addEventListener("click", () => {
			let albumName = this.albumInfo?.album?.albumInfo?.name;
			if (!albumName) return;
			searchImageOnGoogle(albumName);
		});
		shadow.getElementById("btnUploadImage")?.addEventListener("click", () => {
			this.dispatchEboEvent("uploadAlbumImageClicked.eboplayer", {
				"albumUri": this.albumInfo?.album.ref.uri,
				"imageUrl": shadow.getElementById("imageUrl").value.trim()
			});
		});
	}
	async update(shadow) {
		if (this.albumInfo) {
			let albumName = shadow.getElementById("albumName");
			albumName.innerHTML = this.albumInfo.album?.albumInfo?.name ?? "--no name--";
			let imgTag = shadow.getElementById("bigImage");
			imgTag.src = this.albumInfo.bigImageUrl;
			let body = shadow.querySelector("#tableContainer > table").tBodies[0];
			let { artists, composers, genreDefs } = await this.albumInfo.getAllDetails();
			body.innerHTML = "";
			addMetaDataRow(body, "Year:", this.albumInfo.album.albumInfo?.date ?? "--no date--");
			addMetaDataRow(body, "Artists:", artists.map((artist) => {
				return ` 
                    <button class="linkButton" data-uri="${artist.uri}">${artist.name}</button>
                `;
			}).join(" "));
			addMetaDataRow(body, "Composers:", composers.map((artist) => {
				return ` 
                    <button class="linkButton" data-uri="${artist.uri}">${artist.name}</button>
                `;
			}).join(" "));
			let genresHtml = "";
			genreDefs.forEach((def) => {
				let defHtml = "";
				if (def.replacement) defHtml += `<span class="replaced">${def.ref.name}</span> &gt; ${def.replacement}`;
				else defHtml += def.ref.name;
				genresHtml += defHtml;
			});
			genresHtml += `<i id="btnEditGenre" class="fa fa-pencil miniEdit"></i>`;
			addMetaDataRow(body, "Genre", genresHtml);
			addMetaDataRow(body, "Playlists", "todo...");
			body.querySelectorAll(".linkButton").forEach((link) => {
				link.addEventListener("click", (ev) => {
					this.dispatchEboEvent("browseToArtist.eboplayer", {
						"name": ev.target.textContent,
						"type": "artist",
						"uri": link.dataset.uri
					});
				});
			});
			shadow.querySelector("#btnEditGenre").addEventListener("click", (ev) => {
				this.dispatchEboEvent("albumGenreEditRequested.eboplayer", { "uri": this.albumInfo?.album?.ref.uri });
			});
		}
	}
};
function addMetaDataRow(body, colText1, colText2) {
	let tr = body.appendChild(document.createElement("tr"));
	let td1 = tr.appendChild(document.createElement("td"));
	td1.innerHTML = colText1;
	let td2 = tr.appendChild(document.createElement("td"));
	td2.innerHTML = colText2;
	td2.classList.add("selectable");
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/radio/eboRadioHistoryComp.ts
var EboRadioHistoryComp = class EboRadioHistoryComp extends EboComponent {
	static tagName = "ebo-radio-history";
	static observedAttributes = ["img"];
	_streamInfo = null;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestUpdate();
	}
	constructor() {
		super(EboRadioHistoryComp.styleText, EboRadioHistoryComp.htmlText);
		this.requestRender();
	}
	static styleText = `
            <style>
                :host { 
                    display: flex;
                    text-align: start;
                } 
                #wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                .info {
                    font-size: .7em;
                }
                #tableScroller {
                    overflow: scroll;
                    scrollbar-width: none;
                    height: 100%;    
                }
                #tracksTable {
                    width: 100%;
                    font-size: .7rem;
                    border-collapse: collapse;
                    tr.lastLine {
                        border-bottom: 1px solid #ffffff80;
                    }
                }
                tr.remembered {
                    background-color: var(--highlight-background);
                }
            </style>
        `;
	static htmlText = `
            <div id="wrapper">
                <div class="flexRow">
                    <button id="btnRemembered" class="roundBorder">Remembered items</button>                                            
                </div>
                <div id="tableScroller">
                    <table id="tracksTable">
                        <colgroup>
                            <col span="1" style="width: auto;">
                            <col span="1" style="width: 1em;">
                        </colgroup>
                        <tbody>
                        </tbody>                
                    </table>
                </div>          
            </div>
            <dialog popover id="albumTrackPopup">
            </dialog>        
        `;
	attributeReallyChangedCallback(_name, _oldValue, _newValue) {
		this.requestUpdate();
	}
	async render(shadow) {
		shadow.getElementById("btnRemembered").addEventListener("click", (ev) => {
			this.dispatchEboEvent("rememberedRequested.eboplayer", {});
		});
	}
	async update(shadow) {
		let tbody = shadow.getElementById("tracksTable").tBodies[0];
		tbody.innerHTML = "";
		if (this.streamInfo) {
			(await this.streamInfo.getStreamLinesHistory()).forEach((lineGroup, index) => {
				let tr = null;
				lineGroup.lines.forEach((line) => {
					tr = tbody.appendChild(document.createElement("tr"));
					tr.dataset.index = index.toString();
					if (lineGroup.remembered) tr.classList.add("remembered");
					let td = tr.appendChild(document.createElement("td"));
					td.innerHTML = line;
					td.classList.add("selectable");
					let td2 = tr.appendChild(document.createElement("td"));
					td2.innerHTML = `
                        <ebo-menu-button>
                            <div class="flexColumn">
                                <button id="rememberTrack" class="roundBorder">Remember track</button>
                                <button id="excludeLine" class="roundBorder">Exclude line</button>
                                <button id="isProgramTitle" class="roundBorder">Line is program title</button>
                                <button id="googleSearchBtn" 
                                    class="roundBorder" 
                                    style="padding-inline-start: .7rem;">
                                    <img src="../../../images/icons/Google_Favicon_2025.svg" 
                                        alt="Search" 
                                        style="height: .6rem; width: .6rem; position: relative; top: .15rem;margin-right: .1rem;">
                                    Search
                                </button>
                            </div>
                        </ebo-menu-button>`;
					td2.querySelector("#rememberTrack")?.addEventListener("click", (ev) => {
						this.saveRemember(ev.target);
					});
					td2.querySelector("#excludeLine")?.addEventListener("click", (ev) => {});
					td2.querySelector("#isProgramTitle")?.addEventListener("click", (ev) => {});
					td2.querySelector("#googleSearchBtn")?.addEventListener("click", (ev) => {
						let dataIndex = parseInt(ev.currentTarget.closest("tr")?.dataset.index ?? "-1");
						if (dataIndex == -1) return;
						let firstTdText = [...tbody.querySelectorAll(`tr[data-index="${dataIndex}"]`)].map((tr$1) => tr$1.cells[0].textContent ?? "").join(" ");
						searchOnGoogle(firstTdText);
					});
				});
				if (tr != null) tr.classList.add("lastLine");
			});
			let lastRow = tbody.lastElementChild;
			if (lastRow) lastRow.scrollIntoView({ block: "end" });
		}
	}
	saveRemember(target) {
		let lines = this.getLinesForBlock(target);
		if (!lines) {
			console.error("No text found");
			return;
		}
		this.dispatchEboEvent("rememberStreamLines.eboplayer", { lines });
	}
	getLinesForBlock(target) {
		let tr = target.closest("tr");
		if (!tr) {
			console.error("No tr found");
			return;
		}
		let index = parseInt(tr.dataset.index ?? "-1");
		if (index == -1) {
			console.error("No index found");
			return;
		}
		let trsWithIndex = tr.closest("tbody")?.querySelectorAll(`tr[data-index="${index}"]`);
		if (!trsWithIndex) {
			console.error("No trs with index found");
			return;
		}
		return [...trsWithIndex].map((tr$1) => tr$1.cells[0].textContent ?? "--no text--");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/browse/eboBrowseFilterComp.ts
var EboBrowseFilterComp = class EboBrowseFilterComp extends EboComponent {
	get availableRefTypes() {
		return this._availableRefTypes;
	}
	set availableRefTypes(value) {
		this._availableRefTypes = value;
		this.requestUpdate();
	}
	static tagName = "ebo-browse-filter";
	static listSource = "browseView";
	get browseFilter() {
		return this._browseFilter;
	}
	set browseFilter(value) {
		this._browseFilter = value;
		this.requestUpdate();
	}
	_browseFilter;
	_availableRefTypes;
	static observedAttributes = [];
	hideInfoButton = false;
	static styleText = `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #filterButtons {
                margin-top: .3em;
                display: flex;
                flex-direction: row;
            }
            #searchBox {
                & input {
                    flex-grow: 1;
                    color: white;
                    border: none;
                    &:focus {
                        outline: none;
                    }
                }
            }
            
           #filterBox {
                margin-block: .5rem;
                padding:.3rem;
                background-color: rgba(0,0,0,.5);
                border-radius: .5rem;
            }
            .filterButton {
                width: 1.5em;
                height: 1.5em;
                object-fit: contain;
                margin-right: .5em;
            }
            #expandFilterBtn {
                margin-left: .5rem;
            }
            #details {
                padding: .4rem;
                margin-inline-start: 2rem;
            }
            label {
                font-size: .9rem;
            }
            #showInfoBtn {
                margin-inline-start: auto;
                height: 1.2rem;
                width: 1.2rem;   
            }
            #info {
                margin: .5rem;
                padding: .5rem;
                background-color: #444;
                border-radius: 1rem;
                font-size: .7rem;
                & img {
                    width: 1.2rem;
                    height: 1.2rem;
                    margin-right: .5rem;
                }
                label {
                    font-size: inherit;
                }
            }
        </style>
        `;
	static htmlText = `
<div id="wrapper">
    <div id="filterBox">
        <div id="searchBox" class="flexRow">
            <button id="headerSearchBtn"><img src="../../../images/icons/Magnifier.svg" alt="" class="filterButton whiteIcon"></button>
            <input id="searchText" type="text" autofocus>
            <button id="expandFilterBtn"><i class="fa fa-angle-down"></i></button>
        </div>
        <div id="details">
            <label for="selectDate">Added since </label>
            <select id="selectDate" >
                <option value="0"></option>
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="7">1 week</option>
                <option value="30">1 month</option>
                <option value="90">3 months</option>
                <option value="180">6 months</option>
                <option value="365">1 year</option>
            </select>                    
        </div>
        <div id="filterButtons">
            <ebo-button toggle id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="all"> ALL </ebo-button>
            <ebo-button id="showInfoBtn" img="images/icons/Info.svg" class="whiteIcon"></ebo-button>
        </div>
        <div id="info" style="display: none;">
            <div class="flexRow">
                <p class="flexGrow">Uee these buttons to only show</p>
                <button class="flexShrink" id="closeInfoBtn">X</button>
            </div>
            <table>
                <tr><td><img src="images/icons/Album.svg" alt="Album" class="whiteIcon"></td><td>Album</td></tr>
                <tr><td><img src="images/icons/Track.svg" alt="Track" class="whiteIcon"></td><td>Track</td></tr>
                <tr><td><img src="images/icons/Radio.svg" alt="Radio" class="whiteIcon"></td><td>Radio</td></tr>
                <tr><td><img src="images/icons/Artist.svg" alt="Artist" class="whiteIcon"></td><td>Artist</td></tr>
                <tr><td><img src="images/icons/Playlist.svg" alt="Playlist" class="whiteIcon"></td><td>Playlist</td></tr>
                <tr><td><img src="images/icons/Genre.svg" alt="Genre" class="whiteIcon"></td><td>Genre</td></tr>
                <tr><td>ALL</td><td>Show all</td></tr>
            </table>
            <p>Double click these buttons to single select them.</p>
            <input type="checkbox" id="chkNeverShowInfoAgain" name="chkNeverShowInfoAgain">
            <label for="chkNeverShowInfoAgain">Got it – don't show the info button again.</label>
        </div>
    </div>    
</div>        
        `;
	constructor() {
		super(EboBrowseFilterComp.styleText, EboBrowseFilterComp.htmlText);
		this._browseFilter = new BrowseFilter();
		this.availableRefTypes = /* @__PURE__ */ new Set();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestRender();
	}
	setFocusAndSelect() {
		let searchText = this.getShadow().getElementById("searchText");
		searchText?.focus();
		searchText?.select();
	}
	render(shadow) {
		shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {
			this._browseFilter.searchText = inputElement.value;
			this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
		});
		let inputElement = shadow.getElementById("searchText");
		inputElement.addEventListener("keyup", (ev) => {
			this._browseFilter.searchText = inputElement.value;
			this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
		});
		shadow.getElementById("all").addEventListener("click", (ev) => {
			this.onShowAllTypesButtonPress();
		});
		shadow.querySelectorAll("ebo-button.filterButton").forEach((btn) => {
			btn.addEboEventListener("pressedChange.eboplayer", async (ev) => {
				this.onFilterButtonPress(ev);
			});
			btn.addEboEventListener("longPress.eboplayer", (ev) => {
				this.onFilterButtonLongPress(ev);
			});
			btn.addEventListener("dblclick", (ev) => {
				this.onFilterButtonDoubleClick(ev);
			});
		});
		shadow.getElementById("selectDate").addEventListener("change", (ev) => {
			this.onDateFilterChanged();
		});
		let showInfoBtn = shadow.getElementById("showInfoBtn");
		showInfoBtn.addEventListener("click", (ev) => {
			let info = shadow.getElementById("info");
			info.style.display = info.style.display == "none" ? "block" : "none";
		});
		showInfoBtn.style.display = this.hideInfoButton ? "none" : "block";
		shadow.getElementById("closeInfoBtn").addEventListener("click", (ev) => {
			let info = shadow.getElementById("info");
			info.style.display = "none";
		});
		let chkNeverShowInfoAgain = shadow.getElementById("chkNeverShowInfoAgain");
		chkNeverShowInfoAgain.addEventListener("change", (ev) => {
			showInfoBtn.style.display = chkNeverShowInfoAgain.checked ? "none" : "block";
			this.dispatchEboEvent("hideBrowseInfoButton.eboplayer", {});
		});
		this.requestUpdate();
	}
	onFilterButtonLongPress(ev) {
		this.setSingleButton(ev);
	}
	onFilterButtonDoubleClick(ev) {
		this.setSingleButton(ev);
	}
	setSingleButton(ev) {
		this.clearFilterButtons();
		this.toggleFilterButton(ev.target);
		this.requestUpdate();
	}
	clearFilterButtons() {
		this.browseFilter.genre = false;
		this.browseFilter.radio = false;
		this.browseFilter.playlist = false;
		this.browseFilter.album = false;
		this.browseFilter.track = false;
		this.browseFilter.artist = false;
	}
	onFilterButtonPress(ev) {
		let btn = ev.target;
		this.toggleFilterButton(btn);
	}
	toggleFilterButton(btn) {
		let propName = btn.id.replace("filter", "");
		propName = propName.charAt(0).toLowerCase() + propName.slice(1);
		this.browseFilter[propName] = !this.browseFilter[propName];
		this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
	}
	update(shadow) {
		let filterButtons = [...shadow.querySelectorAll("ebo-button")].filter((el) => el.id.startsWith("filter"));
		filterButtons.forEach((btn) => this.updateFilterButton(btn));
		let inputElement = shadow.getElementById("searchText");
		inputElement.value = this._browseFilter.searchText;
		let allButton = shadow.getElementById("all");
		let nonPressed = filterButtons.every((btn) => !btn.hasAttribute("pressed"));
		if (this.availableRefTypes.size == 1 || nonPressed) allButton.setAttribute("disabled", "");
		else allButton.removeAttribute("disabled");
		let selectDate = shadow.getElementById("selectDate");
		selectDate.value = this._browseFilter.addedSince.toString();
		let showInfoBtn = shadow.getElementById("showInfoBtn");
		showInfoBtn.style.display = this.hideInfoButton ? "none" : "block";
	}
	updateFilterButton(btn) {
		let propName = btn.id.replace("filter", "").charAt(0).toLowerCase() + btn.id.replace("filter", "").slice(1);
		btn.toggleAttribute("pressed", this._browseFilter[propName]);
		btn.toggleAttribute("disabled", !this.availableRefTypes.has(propName));
	}
	setSearchInfo(text) {
		let searchInfo = this.getShadow().getElementById("searchInfo");
		if (searchInfo) searchInfo.innerHTML = text;
	}
	filterToImg(filter) {
		let imgUrl = "";
		switch (filter) {
			case "album":
				imgUrl = "images/icons/Album.svg";
				break;
			case "track":
				imgUrl = "images/icons/Track.svg";
				break;
			case "radio":
				imgUrl = "images/icons/Radio.svg";
				break;
			case "artist":
				imgUrl = "images/icons/Artist.svg";
				break;
			case "playlist":
				imgUrl = "images/icons/Playlist.svg";
				break;
			case "genre":
				imgUrl = "images/icons/Genre.svg";
				break;
		}
		return `<img class="filterButton" src="${imgUrl}" alt="">`;
	}
	onShowAllTypesButtonPress() {
		this.clearFilterButtons();
		this.requestUpdate();
		this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
	}
	onDateFilterChanged() {
		let selectDate = this.getShadow().getElementById("selectDate");
		this.browseFilter.addedSince = parseInt(selectDate.value);
		this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboSettingsComp.ts
var EboSettingsComp = class EboSettingsComp extends EboComponent {
	static tagName = "ebo-settings-view";
	get scanStatus() {
		return this._scanStatus;
	}
	set scanStatus(value) {
		this._scanStatus = value;
		this.update(this.shadow);
	}
	static observedAttributes = ["show_whats_new"];
	_scanStatus;
	show_whats_new = false;
	static styleText = `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #scanStatus {
                font-size: .7rem;
            }
        </style>
        `;
	static htmlText = `
        <div id="wrapper" class="flexColumn">
            <ebo-button id="rememberedBtn" class="roundBorder">Remembered info.</ebo-button>
            <ebo-button id="scanBtn" class="roundBorder">Rescan media folder</ebo-button>
            <p id="scanStatus"></p>
            <ebo-button id="whatsNewBtn" class="roundBorder hidden">Show what's new!</ebo-button>
        </div>        
        `;
	constructor() {
		super(EboSettingsComp.styleText, EboSettingsComp.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "show_whats_new":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		shadow.getElementById("scanBtn").addEventListener("click", async (ev) => {
			this.dispatchEboEvent("scanRequested.eboplayer", {});
		});
		shadow.getElementById("whatsNewBtn").addEventListener("click", async (ev) => {
			this.dispatchEboEvent("whatsNewRequested.eboplayer", {});
		});
		shadow.getElementById("rememberedBtn").addEventListener("click", async (ev) => {
			this.dispatchEboEvent("rememberedRequested.eboplayer", {});
		});
	}
	update(shadow) {
		let scanStatus = shadow.getElementById("scanStatus");
		scanStatus.innerText = this.scanStatus;
		shadow.getElementById("whatsNewBtn").classList.toggle("hidden", !this.show_whats_new);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboListItemComp.ts
var EboListItemComp = class EboListItemComp extends EboComponent {
	static tagName = "ebo-list-item";
	static observedAttributes = [
		"selected",
		"img",
		"selection_mode",
		"display",
		"text",
		"image_class"
	];
	selected = false;
	img;
	selection_mode;
	display = "icon";
	text = "";
	image_class = "";
	static styleText = `
        <style>
            img {
                width: 2rem;
                height: 2rem;
                margin-right: 0.5rem;
            }
            :host {
                opacity: 1;
            }
            :host([selected]) { 
                background-color: var(--playing-background); 
            }
            #text {
                flex-grow: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: wrap;
            }
            #button {
                flex-shrink: 1;
                flex-grow: 0;
                padding: 0;
            }
            #wrapper {
                display: flex;
                &.line {
                    flex-direction: row;
                    img {
                        display: none;
                    }
                }
                &.icon {
                    flex-direction: column;
                    align-items: center;
                    img {
                        margin-right: 0;
                        width: 5rem;
                        height: 5rem;
                        &.svgImage {
                            padding: .8rem;
                            box-sizing: border-box;                     
                        }
                    }
                    font-size: .5rem;
                    #text {
                    width: 5rem;
                    text-align: center;
                    overflow: auto;
                    text-overflow: ellipsis;
                    }
                    #button {
                        display: none;
                    }           
                }
                &.selected {
                    background-color: var(--playing-background); 
                }           
            }
        </style>
    `;
	static htmlText = `
        <div id="wrapper">
            <img id="img" src="" alt="track image">
            <div id="text"></div>
            <button id="button">...</button>
        </div>       
        `;
	constructor() {
		super(EboListItemComp.styleText, EboListItemComp.htmlText);
		this.img = "";
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "img":
			case "text":
			case "image_class":
				this[name] = newValue;
				break;
			case "display":
				this.display = newValue;
				break;
			case "selection_mode":
			case "selected":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	update(shadow) {
		let wrapper = shadow.getElementById("wrapper");
		this.setClassFromBoolAttribute(wrapper, "selected");
		wrapper.classList.remove("line", "icon");
		wrapper.classList.add(this.display);
		this.setImage("img", this.img);
		let img = shadow.getElementById("img");
		if (this.image_class) img.classList.add(...this.image_class.split(" "));
		this.setTextFromAttribute("text");
	}
	setImage(id, uri) {
		let imgTag = this.getShadow().getElementById("img");
		if (uri) {
			imgTag.src = uri;
			imgTag.style.visibility = "visible";
		} else imgTag.style.visibility = "hidden";
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/browseView.ts
var BrowseView = class extends ComponentView {
	constructor(state, component) {
		super(state, component);
	}
	bind() {
		this.component.hideInfoButton = this.state.getController().localStorageProxy.getHideBrowseInfoButton();
		this.on("guiBrowseFilterChanged.eboplayer", async () => {
			await this.onGuiBrowseFilterChanged();
		});
		this.on("breadCrumbClick.eboplayer", async (ev) => {
			await this.onBreadcrumbClick(ev.detail.breadcrumbId);
		});
		this.on("browseResultClick.eboplayer", async (ev) => {
			await this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
		});
		this.on("browseResultDblClick.eboplayer", async (ev) => {
			await this.onBrowseResultDblClick(ev.detail.uri);
		});
		this.state.getModel().addEboEventListener("genreReplacementsChanged.eboplayer", async () => {
			await this.onGenreReplacementChanged();
		});
		this.state.getModel().addEboEventListener("refsFiltered.eboplayer", () => {
			this.onRefsFiltered();
		});
		this.state.getModel().addEboEventListener("breadCrumbsChanged.eboplayer", () => {
			this.onBreadCrumbsChanged();
		});
		this.state.getModel().addEboEventListener("modelBrowseFilterChanged.eboplayer", () => {
			this.onModelBrowseFilterChanged();
		});
		this.on("playItemListClicked.eboplayer", async (ev) => {
			await this.onPlayItemListClick(ev.detail);
		});
		this.on("addItemListClicked.eboplayer", async (ev) => {
			await this.onAddItemListClick(ev.detail);
		});
		this.on("replaceItemListClicked.eboplayer", async (ev) => {
			await this.onReplaceItemListClick(ev.detail);
		});
		this.on("displayModeChanged.eboplayer", async (ev) => {
			this.component.setAttribute("display_mode", ev.detail.mode);
			this.state.getController().localStorageProxy.saveLineOrIconPreference(ev.detail.mode);
		});
		this.component.setAttribute("display_mode", this.state.getController().localStorageProxy.getLineOrIconPreference());
		this.component.addEboEventListener("hideBrowseInfoButton.eboplayer", async (ev) => {
			this.state.getController().localStorageProxy.setHideBrowseInfoButton(true);
		});
	}
	async onGuiBrowseFilterChanged() {
		await this.state.getController().setAndSaveBrowseFilter(this.component.browseFilter);
	}
	onRefsFiltered() {
		this.component.results = this.state.getModel().getCurrentSearchResults();
		this.component.action_btn_states = this.getListButtonStates();
		let displayMode = this.state.getController().localStorageProxy.getLineOrIconPreference();
		this.setEffectiveDisplayMode(displayMode);
	}
	getListButtonStates() {
		let states = ListButtonState_AllHidden();
		let searchResults = this.state.getModel().getCurrentSearchResults();
		let browseFilter = this.state.getModel().getCurrentBrowseFilter();
		states.line_or_icon = "show";
		if (searchResults.refs.length == 0) {
			this.showHideTrackAndAlbumButtons(states, "hide");
			states.new_playlist = "hide";
			return states;
		}
		if (browseFilter.searchText == "") {
			this.showHideTrackAndAlbumButtons(states, "show");
			states.new_playlist = "hide";
			return states;
		}
		if ([...searchResults.availableRefTypes].filter((t) => t == "track" || t == "album").length == searchResults.availableRefTypes.size) {
			this.showHideTrackAndAlbumButtons(states, "show");
			states.new_playlist = "show";
			return states;
		}
		if ([...searchResults.availableRefTypes].filter((t) => t == "playlist").length == searchResults.availableRefTypes.size) {
			states.new_playlist = "show";
			this.showHideTrackAndAlbumButtons(states, "hide");
			return states;
		}
		this.showHideTrackAndAlbumButtons(states, "hide");
		states.new_playlist = "show";
		return states;
	}
	updateCompFromState(displayMode) {
		this.component.browseFilter = this.state.getModel().getCurrentBrowseFilter();
		this.component.results = this.state.getModel().getCurrentSearchResults();
		this.component.breadCrumbs = this.state.getModel().getBreadCrumbs();
		this.component.setFocusAndSelect();
		this.component.action_btn_states = this.getListButtonStates();
		this.setEffectiveDisplayMode(displayMode);
	}
	setEffectiveDisplayMode(displayMode) {
		let effectiveDisplayMode = displayMode;
		if (!this.component.results.refs.some((res) => res.item.idMaxImage)) effectiveDisplayMode = "line";
		this.component.setAttribute("display_mode", effectiveDisplayMode);
	}
	showHideTrackAndAlbumButtons(states, state) {
		states.add = state;
		states.replace = state;
		states.play = state;
		states.save = state;
		states.edit = state;
		return states;
	}
	onBreadCrumbsChanged() {
		this.component.breadCrumbs = this.state.getModel()?.getBreadCrumbs() ?? [];
	}
	onModelBrowseFilterChanged() {
		this.component.browseFilter = this.state.getModel().getCurrentBrowseFilter();
	}
	async onPlayItemListClick(detail) {
		await this.state.getPlayer().clear();
		await this.state.getController().addCurrentSearchResultsToPlayer();
		await this.state.getPlayer().play();
	}
	async onAddItemListClick(detail) {
		await this.state.getController().addCurrentSearchResultsToPlayer();
	}
	async onReplaceItemListClick(detail) {
		await this.state.getPlayer().clear();
		await this.onAddItemListClick(detail);
	}
	async onBrowseResultDblClick(uri) {
		await this.state.getPlayer().clearAndPlay([uri]);
	}
	async onBrowseResultClick(label, uri, type) {
		await this.state.getController().diveIntoBrowseResult(label, uri, type, true);
	}
	async onBreadcrumbClick(breadcrumbId) {
		await this.state.getController().resetToBreadCrumb(breadcrumbId);
	}
	async onGenreReplacementChanged() {
		this.component.genreReplacements = await this.state.getController().cache.getGenreReplacementsCached();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/albumView.ts
var AlbumView = class extends ComponentView {
	onDialogOkClickedCallback = () => true;
	dialog;
	albumBeingEdited = null;
	constructor(state, dialog, component) {
		super(state, component);
		this.dialog = dialog;
		this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
			let innnerDialog = ev.detail.dialog;
			if (this.onDialogOkClickedCallback(innnerDialog)) innnerDialog.close();
		});
	}
	bind() {
		let timelineDetailsComponent = document.getElementById("timelineDetails");
		timelineDetailsComponent.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
			timelineDetailsComponent.setAttribute("show_back", "false");
		});
		this.component.addEboEventListener("playTrackClicked.eboplayer", async (ev) => {
			await this.onPlayTrackClicked(ev.detail.uri);
		});
		this.component.addEboEventListener("addTrackClicked.eboplayer", async (ev) => {
			await this.onAddTrackClicked(ev.detail.uri);
		});
		this.component.addEboEventListener("saveClicked.eboplayer", async (ev) => {
			await this.onSaveClicked(ev.detail);
		});
		this.component.addEboEventListener("trackClicked.eboplayer", (ev) => {
			this.component.selected_track_uris = arrayToggle(this.component.selected_track_uris, ev.detail.uri);
		});
		this.component.addEboEventListener("playItemListClicked.eboplayer", async (ev) => {
			await this.onPlayItemListClick(ev.detail);
		});
		this.component.addEboEventListener("addItemListClicked.eboplayer", async (ev) => {
			await this.onAddItemListClick(ev.detail);
		});
		this.component.addEboEventListener("replaceItemListClicked.eboplayer", async (ev) => {
			await this.onReplaceItemListClick(ev.detail);
		});
		this.component.addEboEventListener("updateAlbumData.eboplayer", async (ev) => {
			await this.state.getController().webProxy.updateAlbumData(ev.detail.uri);
		});
		this.component.addEboEventListener("uploadAlbumImageClicked.eboplayer", async (ev) => {
			await this.state.getController().webProxy.uploadAlbumImages(ev.detail.albumUri, ev.detail.imageUrl);
		});
		this.component.addEboEventListener("browseToArtist.eboplayer", async (ev) => {
			await this.state.getController().viewController.browseToArtist(ev.detail);
		});
		this.component.addEboEventListener("albumGenreEditRequested.eboplayer", (ev) => {
			this.onGenreEditRequested(ev.detail);
		});
		this.state.getModel().addEboEventListener("favoritesChanged.eboplayer", async (ev) => {
			await this.onFavoritesChanged();
		});
	}
	setAlbumComponentData(albumModel, selectedTrackUri) {
		document.getElementById("bigAlbumView");
		this.component.albumInfo = albumModel;
		this.component.selected_track_uris = selectedTrackUri ? [selectedTrackUri] : [];
		this.component.setAttribute("img", albumModel.bigImageUrl);
		if (albumModel.album.albumInfo) {
			this.component.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
			this.component.dataset.albumUri = albumModel.album.albumInfo.uri;
		}
	}
	async onPlayItemListClick(_detail) {
		await this.state.getPlayer().clearAndPlay(await this.getSelectedUriForAlbum());
	}
	async onAddItemListClick(_detail) {
		await this.state.getPlayer().add(await this.getSelectedUriForAlbum());
	}
	async onReplaceItemListClick(detail) {
		await this.state.getPlayer().clear();
		await this.onAddItemListClick(detail);
	}
	async onPlayTrackClicked(uri) {
		await this.state.getPlayer().clearAndPlay([uri]);
	}
	async onAddTrackClicked(uri) {}
	async getSelectedUriForAlbum() {
		document.getElementById("bigAlbumView");
		let trackUris = this.component.selected_track_uris;
		if (trackUris.length != 0) return trackUris;
		return [this.state.getModel().getAlbumToView().albumUri];
	}
	async onSaveClicked(detail) {
		if (detail.source == "albumView") this.showDialog(`
                <label for="playListName">Name</label>
                <input type="text" id="playListName">
            `, "Save", (dialog) => {
			let name = dialog.querySelector("#playListName").value;
			return this.saveAlbumAsPlaylist(name, detail);
		});
	}
	showDialog(contentHtml, okButtonText, onOkClicked) {
		this.onDialogOkClickedCallback = onOkClicked;
		this.dialog.innerHTML = contentHtml;
		this.dialog.showModal();
		this.dialog.setAttribute("ok_text", okButtonText);
	}
	async saveAlbumAsPlaylist(name, detail) {
		let playlistUri = await this.state.getController().createPlaylist(name);
		await this.state.getController().addRefToPlaylist(playlistUri, detail.uri, "album", -1);
		return true;
	}
	onGenreEditRequested(detail) {
		location.hash = "#Genres";
		this.state.getController().localStorageProxy.saveAlbumBeingEdited(detail.uri);
		location.reload();
	}
	async onFavoritesChanged() {
		this.component.updateFavorite();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/playerState.ts
var State = class {
	mopidy;
	play = false;
	random = false;
	repeat = false;
	model;
	controller;
	player;
	cache;
	constructor(mopidy, model, controller, player, cache) {
		this.mopidy = mopidy;
		this.model = model;
		this.controller = controller;
		this.player = player;
		this.cache = cache;
	}
	getModel = () => this.model;
	getController = () => this.controller;
	getPlayer = () => this.player;
	getCache = () => this.cache;
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboRememberedComp.ts
var EboRememberedComp = class EboRememberedComp extends EboComponent {
	static tagName = "ebo-remembered-view";
	static observedAttributes = [""];
	static styleText = `
        <style>
        #rememberedTable tr {
            background-color: #ffffff25;
        }
        </style>
        `;
	static htmlText = `
        <div id="wrapper" class="flexColumn selectable">
            <p>Remembered</p>
            <table id="rememberedTable">
                <colgroup>
                    <col span="1" style="width: auto;">
                    <col span="1" style="width: 1em;">
                </colgroup>
                <tbody></tbody>
            </table>       
        </div>        
        `;
	get rememberedList() {
		return this._rememberedList;
	}
	set rememberedList(value) {
		this._rememberedList = value;
		this.update(this.shadow);
	}
	_rememberedList;
	constructor() {
		super(EboRememberedComp.styleText, EboRememberedComp.htmlText);
		this._rememberedList = [];
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "nada":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {}
	update(shadow) {
		let tbody = shadow.querySelector("tbody");
		tbody.innerHTML = "";
		for (let remembered of this.rememberedList) {
			let tr = document.createElement("tr");
			tbody.appendChild(tr);
			let td = document.createElement("td");
			tr.appendChild(td);
			td.innerText = remembered.text;
			td.dataset.id = remembered.id;
			let td2 = document.createElement("td");
			tr.appendChild(td2);
			td2.innerHTML = `
                <ebo-menu-button>
                    <div class="flexColumn">
                        <button id="deleteRememberedBtn" class="roundBorder">Delete</button>
                        <button id="deleteAllRememberedBtn" class="roundBorder">Delete all</button>
                        <button id="googleRememberedBtn" 
                            class="roundBorder" 
                            style="padding-inline-start: .7rem;">
                            <img src="images/icons/Google_Favicon_2025.svg" 
                                alt="Search" 
                                style="height: .8rem; width: .8rem; position: relative; top: .15rem;margin-right: .1rem;">
                            Search
                        </button>
                    </div>
                </ebo-menu-button>`;
			td2.querySelector("#deleteRememberedBtn")?.addEventListener("click", (ev) => {
				this.dispatchEboEvent("deleteRemember.eboplayer", { "id": remembered.id });
			});
			td2.querySelector("#deleteAllRememberedBtn")?.addEventListener("click", (ev) => {});
			td2.querySelector("#googleRememberedBtn")?.addEventListener("click", (ev) => {
				searchOnGoogle(td.innerText);
			});
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/rememberedView.ts
var RememberedView = class extends ComponentView {
	constructor(state, component) {
		super(state, component);
	}
	bind() {
		this.state.getModel().addEboEventListener("remembersChanged.eboplayer", async () => {
			this.component.rememberedList = await this.state.getController().cache.getRemembersCached();
		});
		this.component.addEboEventListener("deleteRemember.eboplayer", async (ev) => {
			await this.state.getController().deleteRemember(ev.detail.id);
		});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/controllers/cacheHandler.ts
var CacheHandler = class extends Commands {
	model;
	mopidyProxy;
	webProxy;
	localStorageProxy;
	baseUrl;
	player;
	constructor(model, mopidy, mopdyProxy, player) {
		super(mopidy);
		this.model = model;
		this.player = player;
		this.mopidyProxy = mopdyProxy;
		this.webProxy = new WebProxy(getHostAndPort());
		this.localStorageProxy = new LocalStorageProxy(model);
		let portDefs = getHostAndPortDefs();
		this.baseUrl = "";
		if (portDefs.altHost && portDefs.altHost != portDefs.host) this.baseUrl = "http://" + portDefs.altHost;
	}
	async lookupTrackCached(trackUri) {
		if (!trackUri) return null;
		let item = this.model.getFromLibraryCache(trackUri);
		if (item) return item;
		let libraryList = await this.fetchAndConvertTracks(trackUri);
		this.model.addItemsToLibraryCache(libraryList);
		return this.model.getFromLibraryCache(trackUri);
	}
	async fetchAndConvertTracks(uri) {
		let newListPromises = (await this.mopidyProxy.lookup(uri))[uri].map(async (track) => this.transformTrackDataToModel(track));
		return await Promise.all(newListPromises);
	}
	async transformTrackDataToModel(track) {
		let allRefsMap = await this.getAllRefsMapCached();
		if (isStream(track)) return {
			type: "stream",
			track,
			name: track.name ?? "--no name--",
			ref: allRefsMap.get(track.uri)
		};
		let model = {
			type: "file",
			composer: "",
			track,
			title: track.name ?? "--no name--",
			performer: "",
			songlenght: 0,
			ref: allRefsMap.get(track.uri)
		};
		if (!track.name || track.name === "") {
			let parts = track.uri.split("/");
			model.title = decodeURI(parts[parts.length - 1]);
		}
		return model;
	}
	async lookupAlbumsCached(albumUris) {
		let albums = [];
		let albumUrisToFetch = [];
		for (let albumUri of albumUris) {
			let album = this.model.getFromLibraryCache(albumUri);
			if (album) albums.push(album);
			else albumUrisToFetch.push(albumUri);
		}
		if (albumUrisToFetch.length > 0) {
			let fetchedAlbums = await this.fetchAlbums(albumUrisToFetch);
			this.model.addItemsToLibraryCache(fetchedAlbums);
			albums = albums.concat(fetchedAlbums);
		}
		return albums;
	}
	async fetchAlbums(albumUris) {
		let dict = await this.mopidyProxy.lookup(albumUris);
		let allRefs = await this.getAllRefsMapCached();
		let albumModelsPending = Object.keys(dict).map(async (albumUri) => {
			let trackList = dict[albumUri];
			return {
				type: "album",
				albumInfo: trackList[0].album ?? null,
				tracks: trackList.map((track) => track.uri),
				ref: allRefs.get(albumUri)
			};
		});
		let albumModels = await Promise.all(albumModelsPending);
		this.model.addItemsToLibraryCache(albumModels);
		return albumModels;
	}
	async lookupRemembersCached() {
		let remembers = this.model.getRemembers();
		if (remembers) return remembers;
		remembers = await this.webProxy.fetchRemembers();
		this.model.setRemembers(remembers);
		return remembers;
	}
	async getMetaDataCached(albumUri) {
		let cachedMeta = this.model.getFromMetaCache(albumUri);
		if (cachedMeta) return cachedMeta.meta;
		let meta = await this.webProxy.fetchMetaData(albumUri);
		this.model.addToMetaCache(albumUri, meta);
		return meta;
	}
	async getAllRefsCached() {
		let allRefs = this.model.getAllRefs();
		if (!allRefs) {
			let allExpandedRefs = await this.webProxy.fetchAllRefs();
			allRefs = await createAllRefs(this, allExpandedRefs);
			this.model.setAllRefs(allRefs);
		}
		return allRefs;
	}
	async getAllRefsMapCached() {
		await this.getAllRefsCached();
		return this.model.getAllRefsMap();
	}
	async getGenreReplacementsCached() {
		if (this.model.getGenreReplacements().size > 0) return this.model.getGenreReplacements();
		let genreDefs = await this.webProxy.fetchGenreReplacements();
		this.model.setGenreReplacements(genreDefs);
		return this.model.getGenreReplacements();
	}
	async getGenreReplacementCached(name) {
		return (await this.getGenreReplacementsCached()).get(name) ?? null;
	}
	async getRemembersCached() {
		if (this.model.getRemembers()) return this.model.getRemembers();
		let remembers = await this.webProxy.fetchRemembers();
		this.model.setRemembers(remembers);
		return this.model.getRemembers();
	}
	async getGenreDefs() {
		if (this.model.getGenreDefs().length > 0) return this.model.getGenreDefs();
		let genreDefs = await this.webProxy.fetchGenreDefs();
		this.model.setGenreDefs(genreDefs);
		return this.model.getGenreDefs();
	}
	async getFavorites() {
		if (this.model.getFavorites()) return this.model.getFavorites();
		let favorites = await this.webProxy.getFavorites();
		this.model.setFavorites(favorites);
		return this.model.getFavorites();
	}
	async getExpandedStreamLines(streamUri) {
		if (this.model.getStreamLinesHistory(streamUri)) return this.model.getStreamLinesHistory(streamUri);
		let streamLines = await this.fetchStreamLines(streamUri);
		let rememberStrings = (await this.lookupRemembersCached()).map((r) => r.text);
		let history = streamLines.map((lines) => {
			let lineStr = lines.join("\n");
			return {
				lines,
				remembered: rememberStrings.includes(lineStr)
			};
		});
		this.model.setStreamLinesHistory(streamUri, history);
		return history;
	}
	async fetchStreamLines(streamUri) {
		let stream_lines = await this.webProxy.fetchAllStreamLines(streamUri);
		function groupLines(grouped, line) {
			if (line == "---") {
				grouped.push([]);
				return grouped;
			}
			grouped[grouped.length - 1].push(line);
			return grouped;
		}
		return stream_lines.reduce(groupLines, new Array([])).filter((lineGroup) => lineGroup.length);
	}
	async getFavoritePlaylistName() {
		if (this.model.getFavoritesPlaylistName()) return this.model.getFavoritesPlaylistName();
		let name = await this.webProxy.getFavoritesPlaylistName();
		this.model.setFavoritesPlaylistName(name);
		return name;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/general/eboOption.ts
var EboOption = class EboOption extends EboComponent {
	static tagName = "ebo-option";
	static observedAttributes = ["value", "selected"];
	value;
	selected = false;
	static styleText = `
        <style>
      </style>
    `;
	static htmlText = `
            <div id="wrapper">
                <slot></slot>
            </div>       
        `;
	constructor() {
		super(EboOption.styleText, EboOption.htmlText);
	}
	onConnected() {
		super.onConnected();
		this.requestRender();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestUpdate();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/general/eboIconDropdown.ts
var EboIconDropdown = class EboIconDropdown extends EboComponent {
	static tagName = "ebo-dropdown";
	static observedAttributes = ["value"];
	value = "justPlay";
	static styleText = `
        <style>
            .menuButton {
                padding: 0;
                border-radius: 100vw;
                aspect-ratio: 1;
                
                anchor-name: --popup-button;
            }
            
            .popupMenu {
                border: none;
                border-radius: .3rem;
                position-anchor: --popup-button;
                inset: auto;
                top: anchor(bottom);
                left: anchor(left);
                margin: 0;
                padding: .5rem;
                opacity: 0;
                background-color: #444;
                
                &:popover-open {
                    opacity: 1;
                }
            }
            
            .trackButton {
                border-color: gray;
                text-align: left;
                & i {
                    position: relative;
                    top: 2px;
                }
            }
      </style>
    `;
	static htmlText = `
        <button id="menuButton" class="menuButton" popovertarget="menu">
           ??
        </button>
        <div popover id="menu" class="popupMenu">
            <slot></slot>
        </div>
        `;
	constructor() {
		super(EboIconDropdown.styleText, EboIconDropdown.htmlText);
	}
	onConnected() {
		super.onConnected();
		this.requestRender();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "value":
				this[name] = newValue;
				break;
		}
		this.requestUpdate();
	}
	closeMenu() {
		this.getShadow().getElementById("menu").hidePopover();
	}
	render(shadow) {
		this.querySelectorAll("ebo-option").forEach((option) => option.addEventListener("click", (ev) => {
			this.closeMenu();
			this.querySelectorAll("ebo-option").forEach((option$1) => option$1.removeAttribute("selected"));
			ev.currentTarget.setAttribute("selected", "true");
			let value = ev.currentTarget.getAttribute("value");
			this.requestUpdate();
			this.dispatchEboEvent("optionSelected.eboplayer", { selected: value });
		}));
		this.requestUpdate();
	}
	update(shadow) {
		this.querySelectorAll("ebo-option").forEach((option) => {
			option.toggleAttribute("selected", option.getAttribute("value") === this.value);
		});
		let button = shadow.getElementById("menuButton");
		let selectedItem = this.querySelector("ebo-option[selected]");
		if (!selectedItem) selectedItem = this.querySelector("ebo-option");
		if (!selectedItem) return;
		let clone = selectedItem.cloneNode(true);
		button.innerText = "";
		button.appendChild(clone);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboGenresComp.ts
var EboGenresComp = class EboGenresComp extends EboComponent {
	static tagName = "ebo-genres-view";
	static observedAttributes = [];
	_genreDefs = [];
	get genreDefs() {
		return this._genreDefs;
	}
	set genreDefs(value) {
		this._genreDefs = value;
		this.requestUpdate();
	}
	static styleText = `
        <style>
            :host { 
                display: flex;
                color: #666;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #scrollContainer {
                overflow-y: auto;
                flex-grow: 1;
                & details {
                    color: #aaa;
                    & > summary.selected {
                        background-color: var(--selected-background);
                    }
                }
                & div {
                    color: #aaa;
                    &.selected {
                        background-color: var(--selected-background);
                    }
                }
                & summary {
                    color: inherit;
                }
                div.active, 
                .active > summary {
                    color: var(--highlight-color);
                }
                .containsActive > summary {
                    color: var(--half-highlight-color);
                }
            }
            .lvl1, .lvl2, .lvl3, .lvl4, .lvl5, .lvl6 {
                margin: 0;
                padding: 0;
                font-size: 1rem;
                font-weight: normal;
                text-align: left;
                margin-inline-start: 1rem;
            }
            .hasChildren::before {
                content: "\\25B6";
                position: relative;
                left: -1rem;
                float: left;
                width: 0;
                height: 1rem;
                cursor: pointer;
                font-size: .8rem;
            }
        </style>
        `;
	static htmlText = `
        <div id="wrapper" class="flexColumn">
            <div class="flexRow">
                <ebo-button data-level="1" toggle><div id="lvl1" class="squircleButton" style="margin-inline-end: .2rem;">1</div></ebo-button>            
                <ebo-button data-level="2" toggle><div id="lvl2" class="squircleButton" style="margin-inline-end: .2rem;">2</div></ebo-button>            
                <ebo-button data-level="3" toggle><div id="lvl3" class="squircleButton" style="margin-inline-end: .2rem;">3</div></ebo-button>            
                <ebo-button data-level="4" toggle><div id="lvl4" class="squircleButton" style="margin-inline-end: .2rem;">4</div></ebo-button>            
                <ebo-button data-level="5" toggle><div id="lvl5" class="squircleButton" style="margin-inline-end: .2rem;">5</div></ebo-button>            
                <ebo-button data-level="6" toggle><div id="lvl6" class="squircleButton" style="margin-inline-end: .2rem;">6</div></ebo-button>           
                <ebo-button id="btnShowActive" toggle class="roundBorder" style="color: var(--highlight-color); padding-block: 0; margin-block-start: 0;"><div style="color: var(--highlight-color); font-size: .7rem;">Active</div></ebo-button> 
                <ebo-button id="btnSelect" disabled class="roundBorder" style="background-color: var(--selected-background); color: var(--selected-background); padding-block: 0; margin-block-start: 0;"><div style="font-size: .7rem;">Select ></div></ebo-button> 
            </div>
            <div id="scrollContainer"></div>
        </div>        
        `;
	constructor() {
		super(EboGenresComp.styleText, EboGenresComp.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestUpdate();
	}
	render(shadow) {
		shadow.querySelectorAll(`ebo-button[data-level]`).forEach((eboButton) => {
			eboButton.addEventListener("click", (ev) => {
				let level = parseInt(eboButton.dataset.level);
				shadow.querySelectorAll("ebo-button").forEach((eboButton$1) => {
					eboButton$1.toggleAttribute("pressed", eboButton$1.dataset.level <= level.toString());
				});
				this.showLevel(level);
			});
		});
		shadow.getElementById("btnShowActive").addEventListener("click", (ev) => {
			this.getActiveAncestors(shadow).forEach((ancestor) => {
				ancestor.toggleAttribute("open", true);
			});
		});
		shadow.getElementById("btnSelect").addEventListener("click", (ev) => {
			let selectedLine = shadow.querySelector(".selected");
			this.dispatchEboEvent("genreSelected.eboplayer", { "text": selectedLine.textContent });
		});
	}
	update(shadow) {
		let container = shadow.getElementById("scrollContainer");
		let nextIndex = this.renderGenreDef(container, 0, -1);
		while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].genreDef.level == 0) nextIndex = this.renderGenreDef(container, nextIndex, -1);
		this.getActiveAncestors(shadow).forEach((ancestor) => {
			ancestor.classList.toggle("containsActive", true);
		});
		let allLineElements = shadow.querySelectorAll("div[data-level], details[data-level] > summary");
		allLineElements.forEach((lineElement) => {
			lineElement.addEventListener("click", (ev) => {
				allLineElements.forEach((otherLineElement) => {
					otherLineElement.classList.remove("selected");
				});
				ev.currentTarget.classList.add("selected");
				shadow.getElementById("btnSelect").removeAttribute("disabled");
			});
		});
	}
	getActiveAncestors(shadow) {
		let activeAncestors = [];
		shadow.querySelectorAll("details").forEach((detail) => detail.open = false);
		shadow.querySelectorAll(".active").forEach((activeElement) => {
			let ancestor;
			ancestor = activeElement;
			while (true) {
				let newAncestor = ancestor.parentElement.closest("details");
				if (newAncestor == ancestor) break;
				ancestor = newAncestor;
				if (!ancestor) break;
				activeAncestors.push(ancestor);
			}
		});
		return activeAncestors;
	}
	renderGenreDef(container, index, parentLevel) {
		let genreDef = this.genreDefs[index];
		if (genreDef.genreDef.level < parentLevel + 1) return index;
		let hasChildren = ((this.genreDefs.length > index + 1 ? this.genreDefs[index + 1] : null)?.genreDef.level ?? -1) > genreDef.genreDef.level;
		let name = genreDef.genreDef.name;
		if (genreDef.genreDef.child) name = genreDef.genreDef.child;
		if (hasChildren) {
			let newContainer = document.createElement("details");
			newContainer.open = false;
			newContainer.classList.add("lvl" + (genreDef.genreDef.level + 1));
			newContainer.classList.toggle("active", genreDef.active);
			newContainer.dataset.level = (genreDef.genreDef.level + 1).toString();
			container.appendChild(newContainer);
			let summary = document.createElement("summary");
			summary.textContent = name;
			newContainer.appendChild(summary);
			let nextIndex = this.renderGenreDef(newContainer, index + 1, genreDef.genreDef.level);
			while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].genreDef.level == genreDef.genreDef.level + 1) nextIndex = this.renderGenreDef(newContainer, nextIndex, genreDef.genreDef.level);
			return nextIndex;
		}
		let newLine = document.createElement("div");
		newLine.classList.add("lvl" + (genreDef.genreDef.level + 1));
		newLine.classList.toggle("active", genreDef.active);
		newLine.dataset.level = (genreDef.genreDef.level + 1).toString();
		container.appendChild(newLine);
		newLine.textContent = name;
		return index + 1;
	}
	showLevel(level) {
		this.shadow.querySelectorAll("details").forEach((detailElement) => {
			detailElement.open = parseInt(detailElement.dataset.level) < level;
		});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/genresView.ts
var GenresView = class extends ComponentView {
	constructor(state, component) {
		super(state, component);
	}
	bind() {
		this.state.getModel().addEboEventListener("genreDefsChanged.eboplayer", async () => {
			let genreDefs = await this.state.getCache().getGenreDefs();
			let genreReplacements = await this.state.getCache().getGenreReplacementsCached();
			this.component.genreDefs = genreDefs.map((genreDef) => {
				return {
					genreDef,
					active: genreReplacements.has(genreDef.child ?? genreDef.name)
				};
			});
			this.component.addEboEventListener("genreSelected.eboplayer", (ev) => {});
		});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/radio/eboBigRadioComp.ts
var EboBigRadioComp = class EboBigRadioComp extends EboComponent {
	static tagName = "ebo-big-radio-view";
	static observedAttributes = [
		"name",
		"extra",
		"img",
		"disabled"
	];
	get btn_states() {
		return this._btn_states;
	}
	set btn_states(value) {
		this._btn_states = value;
		this.requestUpdate();
	}
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestUpdate();
	}
	_streamInfo = null;
	img = "";
	_btn_states = ListButtonState_AllHidden();
	static styleText = `
        <style>
            :host { 
                display: flex;
            } 
            h3 {
                margin-block-start: .5em;
                margin-block-end: .5em;
            }
            .coverContainer {
                display: flex;
                flex-direction: column;
                align-content: center;
                overflow: hidden;
                flex-wrap: wrap;
            }
            img {
                max-width: 90vw;
                height: 45vh;
                object-fit: contain;
                background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
            }
            ebo-progressbar {
                margin-top: .5em;
            }
            #wrapper {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                #bottom {
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
            }
            #wrapper.front {
                #back {
                    display: none;
                }                
            }
            #wrapper.back {
                #front {
                    display: none;
                }                
            }
            .info {
                font-size: .7em;
            }
            #tableWrapper {
                overflow: hidden;
                display: flex;
            }
            ebo-radio-details-view {
                height: 100%;
            }
            ebo-radio-history {
                width: 100%;
            }       
            #back {
                min-height: 40vh;
            }
        </style>
        `;
	static list_source = "albumView";
	static htmlText = `
        <div id="wrapper" class="front">
            <div id="top">
                <div id="front">
                    <div class="coverContainer">
                        <img id="bigImage" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 class="selectable flexRow">
                            <div id="name" class="selectable flexGrow"></div>
                            <ebo-button id="btnFavorite" toggle>
                                <i slot="off" class="fa fa-heart-o"></i>
                                <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>                            
                            </ebo-button>
                        </h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <ebo-radio-details></ebo-radio-details>
                </div>                
            </div>
            <div id="bottom">
                <ebo-list-button-bar list_source="${this.list_source}"></ebo-list-button-bar>
                <div id="tableWrapper">
                    <ebo-radio-history img="" ></ebo-radio-history>
                </div>
            </div>
        </div>        
        `;
	constructor() {
		super(EboBigRadioComp.styleText, EboBigRadioComp.htmlText);
		this.streamInfo = null;
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "img":
				this[name] = newValue;
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		this.shadow.getElementById("bigImage").addEventListener("click", () => {
			let wrapper = this.getShadow().querySelector("#wrapper");
			wrapper.classList.toggle("front");
			wrapper.classList.toggle("back");
		});
		this.addEboEventListener("detailsRadioImgClicked.eboplayer", () => {
			let wrapper = this.getShadow().querySelector("#wrapper");
			wrapper.classList.add("front");
			wrapper.classList.remove("back");
		});
		shadow.getElementById("btnFavorite").addEventListener("click", (ev) => {
			this.dispatchEboEvent("favoriteToggle.eboplayer", { "uri": this.streamInfo?.stream.ref.uri });
		});
		this.requestUpdate();
	}
	update(shadow) {
		let radioDetailsComp = shadow.querySelector("ebo-radio-details");
		radioDetailsComp.streamInfo = this.streamInfo;
		let radioHistoryComp = shadow.querySelector("ebo-radio-history");
		radioHistoryComp.streamInfo = this.streamInfo;
		let img = shadow.getElementById("bigImage");
		if (this.streamInfo) {
			img.src = this.streamInfo.bigImageUrl;
			img.style.visibility = "visible";
			shadow.getElementById("name").innerHTML = this.streamInfo.stream.name;
			shadow.querySelector("ebo-list-button-bar").setAttribute("uri", this.streamInfo.stream.ref.uri ?? "--no albumInfo--");
			let detailsComp = shadow.querySelector("ebo-radio-details");
			detailsComp.streamInfo = this.streamInfo;
		} else img.style.visibility = "hidden";
		let listButtonBar = shadow.querySelector("ebo-list-button-bar");
		listButtonBar.btn_states = this.btn_states;
		this.updateFavorite();
	}
	updateFavorite() {
		let btnFavorite = this.shadow.getElementById("btnFavorite");
		if (this.streamInfo) this.streamInfo.isFavorite().then((isFavorite) => {
			btnFavorite.toggleAttribute("pressed", isFavorite);
		});
		else btnFavorite.removeAttribute("pressed");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/radioView.ts
var RadioView = class extends ComponentView {
	onDialogOkClickedCallback = () => true;
	dialog;
	radioBeingEdited = null;
	constructor(state, dialog, component) {
		super(state, component);
		this.dialog = dialog;
		this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
			let innnerDialog = ev.detail.dialog;
			if (this.onDialogOkClickedCallback(innnerDialog)) innnerDialog.close();
		});
	}
	bind() {
		this.component.addEboEventListener("saveClicked.eboplayer", async (ev) => {
			await this.onSaveClicked(ev.detail);
		});
		this.component.addEboEventListener("playItemListClicked.eboplayer", async (ev) => {
			await this.onPlayItemListClick(ev.detail);
		});
		this.component.addEboEventListener("addItemListClicked.eboplayer", async (ev) => {
			await this.onAddItemListClick(ev.detail);
		});
		this.component.addEboEventListener("replaceItemListClicked.eboplayer", async (ev) => {
			await this.onReplaceItemListClick(ev.detail);
		});
		this.component.addEboEventListener("albumGenreEditRequested.eboplayer", (ev) => {
			this.onGenreEditRequested(ev.detail);
		});
		this.state.getModel().addEboEventListener("favoritesChanged.eboplayer", async (ev) => {
			await this.onFavoritesChanged();
		});
		this.state.getModel().addEboEventListener("streamLinesHistoryChanged.eboplayer", async (ev) => {
			await this.onStreamLineHistoryChanged();
		});
	}
	setStreamComponentData(streamModel) {
		document.getElementById("bigRadioView");
		this.component.streamInfo = streamModel;
		this.component.setAttribute("img", streamModel.bigImageUrl);
		this.component.setAttribute("name", streamModel.stream.name);
		this.component.dataset.streamUri = streamModel.bigImageUrl;
	}
	async onPlayItemListClick(_detail) {
		let currentRadio = this.state.getModel().getRadioToView();
		if (currentRadio) await this.state.getPlayer().clearAndPlay([currentRadio]);
	}
	async onAddItemListClick(_detail) {
		let currentRadio = this.state.getModel().getRadioToView();
		if (currentRadio) await this.state.getPlayer().add([currentRadio]);
	}
	async onReplaceItemListClick(detail) {
		await this.state.getPlayer().clear();
		await this.onAddItemListClick(detail);
	}
	async onSaveClicked(detail) {
		if (detail.source == "radioView") this.showDialog(`
                <label for="playListName">Name</label>
                <input type="text" id="playListName">
            `, "Save", (dialog) => {
			let name = dialog.querySelector("#playListName").value;
			return this.saveStreamToPlaylist(name, detail);
		});
	}
	showDialog(contentHtml, okButtonText, onOkClicked) {
		this.onDialogOkClickedCallback = onOkClicked;
		this.dialog.innerHTML = contentHtml;
		this.dialog.showModal();
		this.dialog.setAttribute("ok_text", okButtonText);
	}
	async saveStreamToPlaylist(name, detail) {
		let playlistUri = await this.state.getController().createPlaylist(name);
		await this.state.getController().addRefToPlaylist(playlistUri, detail.uri, "radio", -1);
		return true;
	}
	onGenreEditRequested(detail) {
		location.hash = "#Genres";
		this.state.getController().localStorageProxy.saveRadioBeingEdited(detail.uri);
		location.reload();
	}
	async onFavoritesChanged() {
		this.component.updateFavorite();
	}
	async onStreamLineHistoryChanged() {
		this.component.requestUpdate();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/radio/eboRadioDetails.ts
var EboRadioDetails = class EboRadioDetails extends EboComponent {
	static tagName = "ebo-radio-details";
	static observedAttributes = [];
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestUpdate();
	}
	_streamInfo = null;
	static styleText = `
        <style>
            * {
                font-size: .8rem;
            }
            #header {
                margin-bottom: .5rem;
            }
            #streamName {
                font-size: 1rem;
            }
            img {
                width: 2.1rem;
                height: 2.1rem;
                object-fit: contain;
                margin-right: .5rem;
            }
            label {
                margin-right: 1rem;
            }
            .replaced {
                opacity: .5;
                text-decoration: line-through;
            }
        </style>
    `;
	static htmlText = `
        <div>
            <div id="header" class="flexRow">
                <img id="smallImage" src="" alt="Radio image">
                <span id="streamName" class="selectable"></span>
            </div>
            <div id="tableContainer" class="flexColumn">
                <table>
                    <tbody></tbody>                
                </table>
                <div style="border-block-start: solid 1px rgba(255,255,255,.5); margin-block-start:.5rem; padding-block-start: .5rem;">
                    <div class="flexRow">
                        <button id="btnSearchImage" 
                            class="roundBorder" 
                            style="padding-inline-start: .7rem;">
                            <img src="../../../images/icons/Google_Favicon_2025.svg" 
                                alt="Search" 
                                style="height: .9rem; width: .9rem; position: relative; top: .15rem;margin-right: .1rem;">
                            Image
                        </button>
                    </div>
                    <label style="display: block; margin-block-start: .3rem; margin-block-end: .1rem;">Upload an cover image:</label>
                    <div class="flexRow">
                        <input id="imageUrl" type="text" class="flexGrow">
                        <button id="btnUploadImage" style="margin-inline-start: .3rem;"><i class="fa fa-upload"></i></button>
                    </div>
                </div>            
            </div>        
        </div>
        `;
	constructor() {
		super(EboRadioDetails.styleText, EboRadioDetails.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		this.requestUpdate();
	}
	render(shadow) {
		shadow.getElementById("smallImage").addEventListener("click", (ev) => {
			this.dispatchEboEvent("detailsRadioImgClicked.eboplayer", {});
		});
		shadow.getElementById("btnSearchImage")?.addEventListener("click", () => {
			let streamName = this.streamInfo?.stream.name;
			if (!streamName) return;
			searchImageOnGoogle("radio " + streamName);
		});
		shadow.getElementById("btnUploadImage")?.addEventListener("click", () => {});
	}
	async update(shadow) {
		if (this.streamInfo) {
			let streamName = shadow.getElementById("streamName");
			streamName.innerHTML = this.streamInfo.stream.name ?? "--no name--";
			let imgTag = shadow.getElementById("smallImage");
			imgTag.src = this.streamInfo.bigImageUrl;
			let body = shadow.querySelector("#tableContainer > table").tBodies[0];
			body.innerHTML = "";
			addMetaDataRow(body, "More info?:", "dunno...");
			addMetaDataRow(body, "Genre", "todo...");
			addMetaDataRow(body, "Playlists", "todo...");
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboTimeLineDetailsComp.ts
var EboTimeLineDetailsComp = class EboTimeLineDetailsComp extends EboComponent {
	static tagName = "ebo-timeline-details";
	static progressBarAttributes = [
		"position",
		"min",
		"max",
		"button",
		"active"
	];
	static observedAttributes = [
		"name",
		"stream_lines",
		"extra",
		"img",
		"disabled",
		"show_back",
		...EboTimeLineDetailsComp.progressBarAttributes
	];
	get albumInfo() {
		return this._albumInfo;
	}
	set albumInfo(value) {
		this._albumInfo = value;
		this.requestRender();
	}
	_streamInfo = null;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestUpdate();
	}
	name = "";
	stream_lines = "";
	extra = "";
	enabled = false;
	show_back = false;
	position = "40";
	min = "0";
	max = "100";
	button = "false";
	active = "true";
	img = "";
	_albumInfo = AlbumNone;
	static styleText = `
            <style>
                :host { 
                    display: flex;
                } 
                h3 {
                    margin-block-start: .5em;
                    margin-block-end: .5em;
                }
                .albumCoverContainer {
                    display: flex;
                    flex-direction: column;
                    /*align-content: center;*/
                    overflow: hidden;
                }
                img#bigImage {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    min-width: 200px;
                    min-height: 200px;
                    background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
                }
                img#smallImage {
                    width: 2.1rem;
                    height: 2.1rem;
                    object-fit: contain;
                    margin-right: .5rem;
                }
                ebo-progressbar {
                    margin-top: .5em;
                }
                #wrapper {
                    display: flex;
                    flex-direction: row;
                    height: 100%;
                    width: 100%;
                    #front {
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                        align-items: center;
                    }
                    #back {
                        width: 100%;
                        padding: 1rem;
                    }
                }
                #wrapper.front {
                    #back {
                        display: none;
                    }                
                }
                #wrapper.back {
                    #front {
                        position: absolute;
                        display: none;
                    }                
                }
                .info {
                    font-size: .7em;
                }
                ebo-radio-details-view {
                    height: 100%;
                }
                #albumTableWrapper {
                    height: 100%;
                    font-size: .8rem;
                }
            </style>
        `;
	static htmlText = `
            <div id="wrapper" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="bigImage" style="visibility: hidden" src="" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <div id="header" class="flexRow">
                        <img id="smallImage" src="" alt="Album image">
                        <span id="title" class="selectable"></span>
                    </div>
                    <div id="albumTableWrapper">
                        <ebo-radio-details-view img="images/default_cover.png" ></ebo-radio-details-view>
                    </div>
                </div>
            </div>        
        `;
	constructor() {
		super(EboTimeLineDetailsComp.styleText, EboTimeLineDetailsComp.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboTimeLineDetailsComp.progressBarAttributes.includes(name)) {
			this.updateStringProperty(name, newValue);
			this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
			return;
		}
		switch (name) {
			case "name":
			case "stream_lines":
			case "extra":
			case "img":
				this[name] = newValue;
				break;
			case "enabled":
			case "show_back":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestUpdate();
	}
	render(shadow) {
		this.addShadowEventListener("bigImage", "click", (ev) => {
			this.dispatchEboEvent("bigTimelineImageClicked.eboplayer", {});
		});
		shadow.getElementById("smallImage").addEventListener("click", (ev) => {
			this.dispatchEboEvent("bigTrackAlbumSmallImgClicked.eboplayer", {});
		});
		this.requestUpdate();
	}
	update(shadow) {
		[
			"name",
			"stream_lines",
			"extra"
		].forEach((attName) => {
			shadow.getElementById(attName).innerHTML = this[attName];
		});
		let progressBarElement = shadow.querySelector("ebo-progressbar");
		EboTimeLineDetailsComp.progressBarAttributes.forEach((attName) => {
			progressBarElement.setAttribute(attName, this[attName]);
		});
		let img = shadow.getElementById("bigImage");
		img.src = this.img;
		this.switchFrontBackNoRender();
		if (this.albumInfo.type == AlbumDataType.Loaded) shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
		let redioDetailsComp = shadow.querySelector("ebo-radio-details-view");
		redioDetailsComp.streamInfo = this.streamInfo;
		let smallImg = shadow.getElementById("smallImage");
		if (this.img != "") {
			img.style.visibility = "";
			smallImg.style.visibility = "";
			img.src = this.img;
			smallImg.src = this.img;
		} else {
			img.style.visibility = "hidden";
			smallImg.style.visibility = "hidden";
		}
		let title = shadow.getElementById("title");
		title.textContent = this.name;
	}
	switchFrontBackNoRender() {
		let wrapper = this.shadow.getElementById("wrapper");
		wrapper.classList.remove("front", "back");
		if (this.show_back) wrapper.classList.add("back");
		else wrapper.classList.add("front");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/gui.ts
function getWebSocketUrl() {
	let webSocketUrl = document.body.dataset.websocketUrl ?? null;
	if (webSocketUrl?.startsWith("{{")) webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;
	if (webSocketUrl == "") return null;
	return webSocketUrl;
}
document.addEventListener("DOMContentLoaded", function() {
	Promise.all([fetch(`${rootDir}css/global.css`).then((res) => res.text()), fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then((res) => res.text())]).then((texts) => {
		EboComponent.setGlobalCss(texts);
		EboComponent.define(EboProgressBar);
		EboComponent.define(EboTimeLineDetailsComp);
		EboComponent.define(EboAlbumTracksComp);
		EboComponent.define(EboBrowseComp);
		EboComponent.define(EboButton);
		EboComponent.define(EboBigAlbumComp);
		EboComponent.define(EboPlayerBar);
		EboComponent.define(EboMenuButton);
		EboComponent.define(EboListButtonBar);
		EboComponent.define(EboDialog);
		EboComponent.define(EboAlbumDetails);
		EboComponent.define(EboBrowseFilterComp);
		EboComponent.define(EboSettingsComp);
		EboComponent.define(EboListItemComp);
		EboComponent.define(EboRememberedComp);
		EboComponent.define(EboOption);
		EboComponent.define(EboIconDropdown);
		EboComponent.define(EboGenresComp);
		EboComponent.define(EboRadioDetails);
		EboComponent.define(EboRadioHistoryComp);
		EboComponent.define(EboBigRadioComp);
		setupStuff();
	});
});
function setupStuff() {
	let connectOptions = {
		webSocketUrl: getWebSocketUrl(),
		autoConnect: false
	};
	let mopidy = new Mopidy(connectOptions);
	let eboWsFrontCtrl = new JsonRpcController("ws://192.168.1.111:6680/eboplayer2/ws/", 1e3, 64e3);
	let eboWsBackCtrl = new JsonRpcController("ws://192.168.1.111:6680/eboback/ws2/", 1e3, 64e3);
	let model = new Model();
	let mopidyProxy = new MopidyProxy(new Commands(mopidy));
	let player = new PlayController(model, mopidyProxy);
	let cacheHandler = new CacheHandler(model, mopidy, mopidyProxy, player);
	let controller = new controller_default(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopidyProxy, player, cacheHandler);
	let state = new State(mopidy, model, controller, player, cacheHandler);
	let browseView = new BrowseView(state, document.getElementById("browseView"));
	let albumView = new AlbumView(state, document.getElementById("dialog"), document.getElementById("bigAlbumView"));
	let radioView = new RadioView(state, document.getElementById("dialog"), document.getElementById("bigRadioView"));
	let mainView = new MainView(state, browseView, albumView, radioView);
	let headerView = new HeaderView(state);
	let timelineDetailsView = new TimeLineDetailsView(state, document.getElementById("timelineDetails"));
	let buttonBarView = new PlayerBarView(state, document.getElementById("buttonBar"));
	let historyView = new TimelineView(state);
	let rememberedView = new RememberedView(state, document.getElementById("rememberedView"));
	let genresView = new GenresView(state, document.getElementById("genresView"));
	let views = [
		mainView,
		headerView,
		timelineDetailsView,
		buttonBarView,
		historyView,
		rememberedView,
		genresView
	];
	views.forEach((v) => v.bindRecursive());
	controller.initialize(views);
	mopidy.connect();
	eboWsFrontCtrl.connect();
	eboWsBackCtrl.connect();
}
let rootDir = document.location.pathname.replace("index.html", "");

//#endregion
export { getWebSocketUrl };
//# sourceMappingURL=bundle.js.map