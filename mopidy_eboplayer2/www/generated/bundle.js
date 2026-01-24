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
//#region mopidy_eboplayer2/www/typescript/playerState.ts
var State = class {
	mopidy;
	play = false;
	random = false;
	repeat = false;
	model;
	controller;
	player;
	constructor(mopidy, model, controller, player) {
		this.mopidy = mopidy;
		this.model = model;
		this.controller = controller;
		this.player = player;
	}
	views = [];
	getModel = () => this.model;
	getController = () => this.controller;
	getPlayer = () => this.player;
	addViews(...views) {
		this.views.push(...views);
		views.forEach((v) => v.bindRecursive());
	}
	async getRequiredData() {
		let requiredData = /* @__PURE__ */ new Set();
		this.views.forEach((v) => {
			v.getRequiredDataTypesRecursive().forEach((dataType) => requiredData.add(dataType));
		});
		this.controller.getRequiredDataTypesRecursive().forEach(((dataType) => requiredData.add(dataType)));
		for (const dataType of requiredData) await this.controller.fetchRequiredData(dataType);
		await this.controller.fetchAllAlbums();
		this.controller.localStorageProxy.loadCurrentBrowseFilter();
		this.controller.localStorageProxy.loadBrowseFiltersBreadCrumbs();
		await this.controller.fetchRefsForCurrentBreadCrumbs();
		await this.controller.filterBrowseResults();
		await this.controller.getGenreDefsCached();
	}
};
let state = null;
function setState(newState) {
	state = newState;
}
const getState = () => state;
var playerState_default = getState;

//#endregion
//#region mopidy_eboplayer2/www/typescript/refs.ts
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
		if (result.item.ref.name?.toLowerCase().startsWith(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (result.item.ref.name?.toLowerCase().includes(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (!browseFilter.searchText) result.weight += 1;
		if (result.weight == 0) return;
		if (browseFilter.addedSince == 0) return;
		if (result.type != "ref") {
			result.weight = 0;
			return;
		}
		if (browseFilter.addedSince == 0) return;
		if ((browseFilter.album || browseFilter.isNoTypeSelected()) && result.item.type == "album") this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
		if ((browseFilter.track || browseFilter.isNoTypeSelected()) && result.item.type == "track") this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
		if (browseFilter.addedSince > 0 && result.item.type != "album" && result.item.type != "track") result.weight = 0;
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
			if (b.weight === a.weight) return a.item.ref.name?.localeCompare(b.item.ref.name ?? "") ?? 0;
			return b.weight - a.weight;
		});
	}
	getSearchResults() {
		return this.searchResults;
	}
	getAvailableRefTypes(refs) {
		return refs.map((r) => r.type == "ref" ? r.item.type : "genre").reduce((typeSet, val) => typeSet.add(val), /* @__PURE__ */ new Set());
	}
	static toRefType(ref) {
		if (!["directory", "track"].includes(ref.type)) return ref.type;
		if (ref.uri.startsWith("eboback:stream:")) return "radio";
		if (ref.uri.startsWith("eboback:directory?genre")) return "genre";
		return ref.type;
	}
	static transformRefsToSearchResults(refs) {
		let results = refs.map((ref) => {
			if (SomeRefs.toRefType(ref) == "genre") {
				let genreDefs = playerState_default().getModel().getGenreDefs();
				if (!genreDefs) throw new Error("No genre defs found!");
				return {
					type: "genreDef",
					item: genreDefs.get(ref.name ?? "???"),
					weight: -1
				};
			}
			return {
				type: "ref",
				item: {
					ref,
					type: SomeRefs.toRefType(ref)
				},
				weight: -1
			};
		});
		return this.reduceResults(results);
	}
	static reduceResults(results) {
		let resultsWithoutGenreDefs = results.filter((result) => result.type != "genreDef");
		let onlyGenreDefResults = results.filter((result) => result.type == "genreDef");
		let onlyWithoutReplacementResults = onlyGenreDefResults.filter((r) => r.item.replacement == null);
		let onlyWithoutReplacementResultsMap = /* @__PURE__ */ new Map();
		onlyWithoutReplacementResults.forEach((result) => {
			onlyWithoutReplacementResultsMap.set(result.item.ref.name ?? "???", result);
		});
		onlyGenreDefResults.forEach((result) => {
			let name;
			if (result.item.replacement != null) name = result.item.replacement;
			else name = result.item.ref.name ?? "???";
			if (!onlyWithoutReplacementResultsMap.has(name)) onlyWithoutReplacementResultsMap.set(name, result);
		});
		return [...resultsWithoutGenreDefs, ...Array.from(onlyWithoutReplacementResultsMap.values())];
	}
};
async function createAllRefs(roots, sub, tracks, albums, artists, genres, radios, playlists) {
	let mappedTracks = tracks.map((track) => ({
		item: {
			type: "track",
			ref: track,
			lastModified: null
		},
		type: "ref",
		weight: 0
	}));
	for (let trackRef of mappedTracks) if (trackRef.item.type == "track") {
		let track = await playerState_default().getController().lookupTrackCached(trackRef.item.ref.uri);
		trackRef.item.lastModified = track?.track?.last_modified ?? null;
	}
	let mappedAlbums = albums.map((album) => ({
		item: {
			type: "album",
			ref: album,
			lastModified: null
		},
		type: "ref",
		weight: 0
	}));
	for (let albumRef of mappedAlbums) {
		let album = await playerState_default().getController().getExpandedAlbumModel(albumRef.item.ref.uri);
		albumRef.item.lastModified = album.mostRecentTrackModifiedDate;
	}
	return new AllRefs(roots, sub, mappedTracks, mappedAlbums, artists, genres, radios, playlists);
}
var AllRefs = class extends Refs {
	roots;
	sub;
	tracks;
	albums;
	artists;
	genres;
	radios;
	playlists;
	availableRefTypes;
	constructor(roots, sub, tracks, albums, artists, genres, radios, playlists) {
		super();
		this.roots = roots;
		this.sub = sub;
		this.tracks = tracks;
		this.albums = albums;
		this.artists = artists.map((artist) => ({
			item: {
				type: "artist",
				ref: artist,
				lastModified: null
			},
			type: "ref",
			weight: 0
		}));
		this.genres = Refs.reduceResults(genres.map((ref) => ({
			item: ref,
			type: "genreDef",
			weight: 0
		})));
		this.radios = radios.map((radio) => ({
			item: {
				type: "radio",
				ref: radio,
				lastModified: null
			},
			type: "ref",
			weight: 0
		}));
		this.playlists = playlists.map((album) => ({
			item: {
				type: "playlist",
				ref: album,
				lastModified: null
			},
			type: "ref",
			weight: 0
		}));
		this.availableRefTypes = /* @__PURE__ */ new Set();
		this.getAvailableRefTypes(this.tracks).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.albums).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.artists).forEach((type) => this.availableRefTypes.add(type));
		if (this.genres.length) this.availableRefTypes.add("genre");
		this.getAvailableRefTypes(this.radios).forEach((type) => this.availableRefTypes.add(type));
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
	constructor(refs) {
		super();
		this.allresults = Refs.transformRefsToSearchResults(refs);
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
var ExpandedAlbumModel = class {
	album;
	tracks;
	meta;
	mostRecentTrackModifiedDate;
	constructor(album, tracks, meta, mostRecentTrackModifiedDate) {
		this.album = album;
		this.tracks = tracks;
		this.meta = meta;
		this.mostRecentTrackModifiedDate = mostRecentTrackModifiedDate;
	}
	get genres() {
		return [...new Set(this.tracks.filter((track) => track.track.genre != void 0).map((track) => track.track.genre))];
	}
	get artists() {
		let artistMap = /* @__PURE__ */ new Map();
		this.tracks.map((track) => track.track.artists ?? []).flat().forEach((artist) => artistMap.set(artist.name, artist));
		return [...artistMap.values()];
	}
	get composers() {
		let artistMap = /* @__PURE__ */ new Map();
		this.tracks.map((track) => track.track.composers ?? []).flat().forEach((artist) => artistMap.set(artist.name, artist));
		return [...artistMap.values()];
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
	playbackModesState = {
		repeat: false,
		random: false,
		consume: false,
		single: false
	};
	playState = "unknown";
	activeStreamLines;
	history;
	trackList = [];
	libraryCache = /* @__PURE__ */ new Map();
	imageCache = /* @__PURE__ */ new Map();
	metaCache = /* @__PURE__ */ new Map();
	currentBrowseFilter = new BrowseFilter();
	filterBreadCrumbStack = new BrowseFilterBreadCrumbStack();
	genreDefs = null;
	currentProgramTitle = "";
	allRefs = null;
	currentRefs = null;
	view = Views.NowPlaying;
	albumToViewUri;
	remembers = null;
	scanStatus = "";
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
	setGenreDefs(defs) {
		this.genreDefs = /* @__PURE__ */ new Map();
		for (let def of defs) this.genreDefs.set(def.ref.name ?? "???", def);
		this.dispatchEboEvent("genreDefsChanged.eboplayer", {});
	}
	getGenreDefs = () => this.genreDefs;
	pushBreadCrumb(crumb) {
		this.filterBreadCrumbStack.push(crumb);
		this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
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
	}
	getCurrentSearchResults() {
		return this.currentRefs?.getSearchResults() ?? EmptySearchResults;
	}
	getAllRefs = () => this.allRefs;
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
	setConnectionState(state$1) {
		this.connectionState = state$1;
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
	setPlaybackState(state$1) {
		this.playbackModesState = { ...state$1 };
		this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
	}
	getVolume = () => this.volume;
	getPlayState() {
		return this.playState;
	}
	setPlayState(state$1) {
		this.playState = state$1;
		this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
	}
	setActiveStreamLinesHistory(streamTitles) {
		if (!streamTitles) return;
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
	setAlbumToView(uri) {
		this.albumToViewUri = uri;
		this.dispatchEboEvent("albumToViewChanged.eboplayer", {});
	}
	getAlbumToView = () => this.albumToViewUri;
	setRemembers(remembers) {
		this.remembers = remembers;
		this.dispatchEboEvent("remembersChanged.eboplayer", {});
	}
	getRemembers = () => this.remembers;
	setScanStatus(status) {
		this.scanStatus = status;
		this.dispatchEboEvent("scanStatusChanged.eboplayer", { text: status });
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/dataRequester.ts
var NestedDataRequester = class {
	_children = [];
	getRequiredDataTypesRecursive() {
		return [...this.getRequiredDataTypes(), ...this._children.map((child) => child.getRequiredDataTypesRecursive()).flat()];
	}
	addChildren(...children) {
		this._children.push(...children);
	}
	get children() {
		return this._children;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/view.ts
let EboPlayerDataType = /* @__PURE__ */ function(EboPlayerDataType$1) {
	EboPlayerDataType$1[EboPlayerDataType$1["Volume"] = 0] = "Volume";
	EboPlayerDataType$1[EboPlayerDataType$1["CurrentTrack"] = 1] = "CurrentTrack";
	EboPlayerDataType$1[EboPlayerDataType$1["PlayState"] = 2] = "PlayState";
	EboPlayerDataType$1[EboPlayerDataType$1["TrackList"] = 3] = "TrackList";
	return EboPlayerDataType$1;
}({});
var View = class extends NestedDataRequester {
	static getSubId(parentId, subId) {
		return document.getElementById(`${parentId}.${subId}`);
	}
	bindRecursive() {
		this.children.forEach((child) => child.bindRecursive());
		this.bind();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/headerView.ts
var HeaderView = class extends View {
	bind() {
		playerState_default().getModel().addEboEventListener("messageChanged.eboplayer", () => {
			this.onMessageChanged();
		});
	}
	onMessageChanged() {
		let msg = playerState_default().getModel().getCurrentMessage();
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
	getRequiredDataTypes() {
		return [];
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
		console.log(obj);
		localStorage.setItem(CURRENT_BROWSE_FILTERS__KEY, obj);
	}
	saveBrowseFilterBreadCrumbs(breadCrumbs) {
		let obj = JSON.stringify(breadCrumbs);
		console.log(obj);
		localStorage.setItem(BROWSE_FILTERS_BREADCRUMBS_KEY, obj);
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
function transformTrackDataToModel(track) {
	if (isStream(track)) return {
		type: "stream",
		track,
		name: track.name ?? "--no name--"
	};
	let model = {
		type: "file",
		composer: "",
		track,
		title: track.name ?? "--no name--",
		performer: "",
		songlenght: 0
	};
	if (!track.name || track.name === "") {
		let parts = track.uri.split("/");
		model.title = decodeURI(parts[parts.length - 1]);
	}
	return model;
}
function console_yellow(msg) {
	console.log(`%c${msg}`, "background-color: yellow");
}
function unreachable(x) {
	throw new Error("Didn't expect to get here");
}

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
	async fetchGenreDefs() {
		let url = this.ebobackUrl(`get_genres`);
		return await (await fetch(url)).json();
	}
	async remember(text) {
		let url = this.ebobackUrl(`save_remember`);
		return await (await fetch(url, {
			method: "POST",
			body: text
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
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/controllers/controller.ts
const LIBRARY_PROTOCOL = "eboback:";
var Controller = class Controller extends Commands {
	model;
	mopidyProxy;
	webProxy;
	localStorageProxy;
	eboWsFrontCtrl;
	eboWsBackCtrl;
	baseUrl;
	static DEFAULT_IMG_URL = "images/default_cover.png";
	player;
	constructor(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopdyProxy, player) {
		super(mopidy);
		this.model = model;
		this.player = player;
		this.mopidyProxy = mopdyProxy;
		this.webProxy = new WebProxy(getHostAndPort());
		this.localStorageProxy = new LocalStorageProxy(model);
		this.eboWsFrontCtrl = eboWsFrontCtrl;
		this.eboWsBackCtrl = eboWsBackCtrl;
		let portDefs = getHostAndPortDefs();
		this.baseUrl = "";
		if (portDefs.altHost && portDefs.altHost != portDefs.host) this.baseUrl = "http://" + portDefs.altHost;
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.CurrentTrack];
	}
	getRequiredDataTypesRecursive() {
		return this.getRequiredDataTypes();
	}
	initSocketevents() {
		this.mopidy.on("state:online", async () => {
			this.model.setConnectionState(ConnectionState.Online);
			await playerState_default().getRequiredData();
			this.model.setHistory(await this.webProxy.fetchHistory());
		});
		this.mopidy.on("state:offline", () => {
			this.model.setConnectionState(ConnectionState.Offline);
		});
		this.mopidy.on("event:optionsChanged", async () => {
			this.model.setPlaybackState(await this.mopidyProxy.fetchPlaybackOptions());
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
			this.model.setActiveStreamLinesHistory(streamTitles);
		});
		this.eboWsFrontCtrl.on("event:programTitleChanged", (data) => {
			this.model.setCurrentProgramTitle(data.program_title);
		});
		this.model.addEboEventListener("playbackStateChanged.eboplayer", async () => {
			await this.updateStreamLines();
		});
		this.eboWsBackCtrl.on((data) => {
			console.log(data);
		});
		this.eboWsBackCtrl.on("event:scanStarted", (data) => {
			this.model.setScanStatus("Scan started...\n");
		});
		this.eboWsBackCtrl.on("event:scanStatus", (data) => {
			this.model.setScanStatus(this.model.getScanStatus() + data.message + "\n");
		});
		this.eboWsBackCtrl.on("event:scanFinished", (data) => {
			this.model.setScanStatus(this.model.getScanStatus() + "Scan completed.");
			this.model.dispatchEboEvent("scanFinished.eboplayer", {});
		});
	}
	async fetchRequiredData(dataType) {
		switch (dataType) {
			case EboPlayerDataType.Volume:
				let volume = await this.mopidyProxy.fetchVolume();
				this.model.setVolume(volume);
				break;
			case EboPlayerDataType.CurrentTrack:
				let track = await this.mopidyProxy.fetchCurrentTlTrack();
				await this.setCurrentTrackAndFetchDetails(track);
				break;
			case EboPlayerDataType.PlayState:
				let state$1 = await this.mopidyProxy.fetchPlayState();
				this.model.setPlayState(state$1);
				break;
			case EboPlayerDataType.TrackList:
				this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
				break;
		}
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
		let trackModel = await this.lookupTrackCached(data.track.uri);
		this.model.setCurrentTrack(trackModel);
		if (!this.model.selectedTrack) {
			let uri = trackModel?.track?.uri;
			this.model.setSelectedTrack(uri ?? null);
		}
		await this.updateStreamLines();
	}
	async updateStreamLines() {
		if (this.model.getPlayState() != "playing") {
			this.model.setActiveStreamLinesHistory(NoStreamTitles);
			return;
		}
		if (this.model.currentTrack == null) {
			this.model.setActiveStreamLinesHistory(NoStreamTitles);
			return;
		}
		if ((await this.lookupTrackCached(this.model.currentTrack))?.type == "stream") {
			let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack);
			this.model.setActiveStreamLinesHistory(lines);
		} else this.model.setActiveStreamLinesHistory(NoStreamTitles);
	}
	async fetchLargestImagesOrDefault(uris) {
		function getImageUrl(uri, baseUrl) {
			let arr = images[uri];
			arr.sort((imgA, imgB) => imgA.width * imgA.height - imgB.width * imgB.height);
			if (arr.length == 0) return Controller.DEFAULT_IMG_URL;
			let imageUrl = arr.pop()?.uri;
			if ((imageUrl ?? "") == "") imageUrl = Controller.DEFAULT_IMG_URL;
			return baseUrl + imageUrl;
		}
		let images = await this.mopidyProxy.fetchImages(uris);
		let mappedImage = uris.map((uri) => {
			let imageUrl = getImageUrl(uri, this.baseUrl);
			return [uri, imageUrl];
		});
		return new Map(mappedImage);
	}
	async setAndSaveBrowseFilter(filter) {
		this.localStorageProxy.saveCurrentBrowseFilter(filter);
		this.model.setCurrentBrowseFilter(filter);
		await this.filterBrowseResults();
	}
	async diveIntoBrowseResult(label, uri, type, addTextFilterBreadcrumb) {
		if (type == "track" || type == "radio") return;
		if (type == "album") playerState_default().getController().getExpandedAlbumModel(uri).then(() => {
			this.showAlbum(uri);
		});
		if (addTextFilterBreadcrumb) {
			let browseFilter = this.model.getCurrentBrowseFilter();
			if (!browseFilter.isEmpty()) {
				let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
				this.model.pushBreadCrumb(breadCrumb1);
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
				break;
		}
		await this.setAndSaveBrowseFilter(newBrowseFilter);
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
		let breadCrumb = playerState_default().getModel().getBreadCrumbs().get(id);
		let breadCrumbs = playerState_default().getModel().getBreadCrumbs();
		if (breadCrumb instanceof BreadCrumbBrowseFilter) {
			this.model.resetBreadCrumbsTo(id);
			let browseFilter = this.model.popBreadCrumb()?.data;
			await this.setAndSaveBrowseFilter(browseFilter);
			this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
			await this.fetchRefsForCurrentBreadCrumbs();
			await this.filterBrowseResults();
		} else if (breadCrumb instanceof BreadCrumbRef) {
			if (isBreadCrumbForAlbum(breadCrumb)) {
				this.showAlbum(breadCrumb.data.uri);
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
	async lookupTrackCached(trackUri) {
		if (!trackUri) return null;
		let item = this.model.getFromLibraryCache(trackUri);
		if (item) return item;
		let libraryList = await this.fetchAndConvertTracks(trackUri);
		this.model.addItemsToLibraryCache(libraryList);
		return this.model.getFromLibraryCache(trackUri);
	}
	async lookupAlbumsCached(albumUris) {
		let albums = [];
		let albumUrisToFetch = [];
		for (let albumUri of albumUris) {
			let album = this.model.getFromLibraryCache(albumUri);
			if (album) albums.push(album);
			else albumUrisToFetch.push(albumUri);
		}
		let fetchedAlbums = await this.fetchAlbums(albumUrisToFetch);
		this.model.addItemsToLibraryCache(fetchedAlbums);
		albums = albums.concat(fetchedAlbums);
		return albums;
	}
	async fetchAlbums(albumUris) {
		let dict = await this.mopidyProxy.lookup(albumUris);
		let albumModelsPending = Object.keys(dict).map(async (albumUri) => {
			let trackList = dict[albumUri];
			return {
				type: "album",
				albumInfo: trackList[0].album ?? null,
				tracks: trackList.map((track) => track.uri)
			};
		});
		let partialAlbumModels = await Promise.all(albumModelsPending);
		let albumInfos = partialAlbumModels.filter((album) => album.albumInfo != null).map((album) => album.albumInfo);
		let images = await this.fetchLargestImagesOrDefault(albumInfos.map((album) => album.uri));
		this.model.addImagesToCache(images);
		let albumModels = partialAlbumModels.map((m) => {
			if (m.albumInfo) return {
				...m,
				imageUrl: this.model.getImageFromCache(m.albumInfo.uri)
			};
			return m;
		});
		this.model.addItemsToLibraryCache(albumModels);
		return albumModels;
	}
	async lookupAllTracks(uris) {
		let results = await this.mopidyProxy.lookup(uris);
		let partialModels = Object.keys(results).map((trackUri) => {
			let track = results[trackUri][0];
			return transformTrackDataToModel(track);
		});
		let fileModels = partialModels.filter((m) => m.type == "file");
		let partialStreamModels = partialModels.filter((m) => m.type == "stream");
		let streamUris = partialStreamModels.map((stream) => stream.track.uri);
		let images = await this.fetchLargestImagesOrDefault(streamUris);
		this.model.addImagesToCache(images);
		let streamModels = partialStreamModels.map((m) => {
			return {
				...m,
				imageUrl: this.model.getImageFromCache(m.track.uri)
			};
		});
		this.model.addItemsToLibraryCache(fileModels);
		this.model.addItemsToLibraryCache(streamModels);
	}
	async lookupImageCached(uri) {
		let imgUrl = this.model.getImageFromCache(uri);
		if (imgUrl) return imgUrl;
		let images = await this.mopidyProxy.fetchImages([uri]);
		if (images[uri].length == 0) {
			this.model.addImageToCache(uri, Controller.DEFAULT_IMG_URL);
			return Controller.DEFAULT_IMG_URL;
		}
		let img = images[uri][0];
		this.model.addImageToCache(uri, img.uri);
		return img.uri;
	}
	async fetchAndConvertTracks(uri) {
		let newListPromises = (await this.mopidyProxy.lookup(uri))[uri].map(async (track) => {
			let model = transformTrackDataToModel(track);
			if (model.type == "stream") {
				let images = await this.mopidyProxy.fetchImages([track.uri]);
				let imageUrl = "";
				if (images[track.uri].length > 0) imageUrl = this.baseUrl + images[track.uri][0].uri;
				else imageUrl = Controller.DEFAULT_IMG_URL;
				return {
					...model,
					imageUrl
				};
			}
			return model;
		});
		return await Promise.all(newListPromises);
	}
	async lookupRemembersCached() {
		let remembers = this.model.getRemembers();
		if (remembers) return remembers;
		remembers = await this.webProxy.fetchRemembers();
		this.model.setRemembers(remembers);
		return remembers;
	}
	async getExpandedModel(ref) {
		switch (ref.type) {
			case "track": return this.getExpandedTrackModel(ref.ref.uri);
			case "album": return this.getExpandedAlbumModel(ref.ref.uri);
			case "radio": return this.getExpandedTrackModel(ref.ref.uri);
			case "playlist": return null;
			case "artist": return null;
			case "genre": return null;
			default: unreachable(ref.type);
		}
	}
	async getExpandedTrackModel(trackUri) {
		if (!trackUri) return null;
		let track = await this.lookupTrackCached(trackUri);
		if (track?.type == "stream") {
			let streamLines = await this.fetchStreamLines(trackUri);
			let remembers = await this.lookupRemembersCached();
			let expandedStreamLines = streamLines.map((lines) => {
				let lineStr = lines.join("\n");
				return {
					lines,
					remembered: remembers.includes(lineStr)
				};
			});
			return {
				stream: track,
				historyLines: expandedStreamLines
			};
		}
		if (track) {
			let uri = track?.track?.album?.uri;
			let album = null;
			if (uri) album = (await this.lookupAlbumsCached([uri]))[0];
			return {
				track,
				album
			};
		}
		throw new Error("trackUri not found in library");
	}
	async getExpandedAlbumModel(albumUri) {
		let album = (await this.lookupAlbumsCached([albumUri]))[0];
		let meta = await this.getMetaDataCached(albumUri) ?? null;
		let tracks = await Promise.all(album.tracks.map((trackUri) => this.lookupTrackCached(trackUri)));
		let mostRecentTrackModifiedDate = tracks.filter((t) => t.track.last_modified).map((t) => t.track.last_modified).sort()[0] ?? null;
		return new ExpandedAlbumModel(album, tracks, meta, mostRecentTrackModifiedDate);
	}
	async getMetaDataCached(albumUri) {
		let cachedMeta = this.model.getFromMetaCache(albumUri);
		if (cachedMeta) return cachedMeta.meta;
		let meta = await this.webProxy.fetchMetaData(albumUri);
		this.model.addToMetaCache(albumUri, meta);
		return meta;
	}
	setSelectedTrack(uri) {
		this.model.setSelectedTrack(uri);
	}
	async fetchAllRefs() {
		let roots = await this.mopidyProxy.fetchRootDirs();
		let subDir1 = await this.mopidyProxy.browse(roots[1].uri);
		let allTracks = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=track");
		let allAlbums = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=album");
		let allArtists = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=artist");
		let genreArray = [...(await this.getGenreDefsCached()).values()];
		let playLists = await this.mopidyProxy.fetchPlayLists();
		let radioStreamsPlayList = playLists.find((playlist) => playlist.name == "[Radio Streams]");
		let playlists = playLists.filter((playlist) => playlist.name != "[Radio Streams]");
		let radioStreams = [];
		if (radioStreamsPlayList) radioStreams = await this.mopidyProxy.fetchPlaylistItems(radioStreamsPlayList.uri);
		return createAllRefs(roots, subDir1, allTracks, allAlbums, allArtists, genreArray, radioStreams, playlists);
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
				this.model.setCurrentRefs(new SomeRefs(playlistItems));
				return;
			}
			let refs = await this.mopidyProxy.browse(lastCrumb.data.uri);
			this.model.setCurrentRefs(new SomeRefs(refs));
			return;
		}
	}
	async setAllRefsAsCurrent() {
		if (!this.model.getAllRefs()) {
			let allRefs = await this.fetchAllRefs();
			this.model.setAllRefs(allRefs);
		}
		this.model.setCurrentRefs(this.model.getAllRefs() ?? null);
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
	setView(view) {
		this.model.setView(view);
	}
	async fetchAllAlbums() {
		let albumRefs = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=album");
		return await this.lookupAlbumsCached(albumRefs.map((ref) => ref.uri));
	}
	async addCurrentSearchResultsToPlayer() {
		let results = playerState_default()?.getModel()?.getCurrentSearchResults();
		await this.player.add(results.refs.map((r) => r.item.ref.uri));
	}
	async createPlaylist(name) {
		return this.mopidyProxy.createPlaylist(name);
	}
	async addRefToPlaylist(playlistUri, itemUri, refType, sequence) {
		return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
	}
	async getGenreDefsCached() {
		if (this.model.getGenreDefs()) return this.model.getGenreDefs();
		let genreDefs = await this.webProxy.fetchGenreDefs();
		this.model.setGenreDefs(genreDefs);
		return this.model.getGenreDefs();
	}
	getGenreDef(name) {
		return this.model.getGenreDefs()?.get(name);
	}
	showAlbum(albumUri) {
		this.model.setAlbumToView(albumUri);
		this.model.setView(Views.Album);
	}
	async remember(s) {
		await this.webProxy.remember(s);
	}
	async startScan() {
		await this.eboWsBackCtrl.send({ method: "start_scan" }, "fireAndForget");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/playerBarView.ts
var PlayerBarView = class extends View {
	componentId;
	parent;
	constructor(containerId, parent) {
		super();
		this.parent = parent;
		this.componentId = containerId;
	}
	bind() {
		playerState_default().getModel().addEboEventListener("playbackStateChanged.eboplayer", async () => {
			await this.onPlaybackStateChanged();
		});
		playerState_default().getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
			await this.onCurrentTrackChanged();
		});
		playerState_default().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onSelectedTrackChanged();
		});
		playerState_default().getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", () => {
			this.onActiveStreamLinesChanged();
		});
		let comp = document.getElementById(this.componentId);
		comp.addEboEventListener("playPressed.eboplayer", async () => {
			await playerState_default().getController().mopidyProxy.sendPlay();
		});
		comp.addEboEventListener("stopPressed.eboplayer", async () => {
			await playerState_default().getController().mopidyProxy.sendStop();
		});
		comp.addEboEventListener("pausePressed.eboplayer", async () => {
			await playerState_default().getController().mopidyProxy.sendPause();
		});
		comp.addEboEventListener("buttonBarAlbumImgClicked.eboplayer", () => {
			this.onButtonBarImgClicked();
		});
		playerState_default().getModel().addEboEventListener("volumeChanged.eboplayer", () => {
			this.onVolumeChanged();
		});
		comp.addEboEventListener("changingVolume.eboplayer", async (ev) => {
			let value = ev.detail.volume;
			await playerState_default().getController().mopidyProxy.sendVolume(value);
		});
		playerState_default().getModel().addEboEventListener("viewChanged.eboplayer", () => {
			this.showHideInfo();
		});
	}
	onVolumeChanged() {
		let volume = playerState_default().getModel().getVolume();
		document.getElementById(this.componentId).setAttribute("volume", volume.toString());
	}
	async onPlaybackStateChanged() {
		let playState = playerState_default().getModel().getPlayState();
		document.getElementById(this.componentId).setAttribute("play_state", playState);
		await this.updateComponent();
	}
	async onCurrentTrackChanged() {
		await this.updateComponent();
	}
	async onSelectedTrackChanged() {
		await this.updateComponent();
	}
	async updateComponent() {
		let track = playerState_default().getModel().getCurrentTrack();
		let comp = document.getElementById(this.componentId);
		if (!track) {
			comp.setAttribute("text", "");
			comp.setAttribute("allow_play", "false");
			comp.setAttribute("allow_prev", "false");
			comp.setAttribute("allow_next", "false");
			comp.setAttribute("image_url", "");
			comp.setAttribute("stop_or_pause", "stop");
		} else {
			let trackModel = await playerState_default().getController().getExpandedTrackModel(track);
			if (isInstanceOfExpandedStreamModel(trackModel)) {
				let active_titles = "";
				let activeStreamLines = playerState_default().getModel().getActiveStreamLines();
				if (activeStreamLines) active_titles = activeStreamLines.active_titles.join("\n");
				comp.setAttribute("text", active_titles);
				comp.setAttribute("allow_play", "true");
				comp.setAttribute("allow_prev", "false");
				comp.setAttribute("allow_next", "false");
				comp.setAttribute("image_url", trackModel.stream.imageUrl);
				comp.setAttribute("stop_or_pause", "stop");
			} else if (isInstanceOfExpandedTrackModel(trackModel)) {
				comp.setAttribute("text", trackModel.track.track.name ?? "--no name--");
				comp.setAttribute("allow_play", "true");
				comp.setAttribute("allow_prev", "false");
				comp.setAttribute("allow_next", "false");
				comp.setAttribute("image_url", trackModel.album?.imageUrl ?? Controller.DEFAULT_IMG_URL);
				comp.setAttribute("stop_or_pause", "pause");
			}
		}
		this.showHideInfo();
	}
	showHideInfo() {
		let currentTrack = playerState_default().getModel().getCurrentTrack();
		let selectedTrack = playerState_default().getModel().getSelectedTrack();
		let currentView = playerState_default().getModel().getView();
		let show_info = false;
		if (selectedTrack && currentTrack != selectedTrack) show_info = true;
		if (currentView != Views.NowPlaying) show_info = true;
		document.getElementById(this.componentId).setAttribute("show_info", show_info.toString());
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.PlayState, EboPlayerDataType.Volume];
	}
	onButtonBarImgClicked() {
		playerState_default().getController().setSelectedTrack(playerState_default().getModel().getCurrentTrack());
		playerState_default().getController().setView(Views.NowPlaying);
	}
	onActiveStreamLinesChanged() {
		let lines = playerState_default().getModel().getActiveStreamLines();
		document.getElementById(this.componentId).setAttribute("text", lines.active_titles.join("\n"));
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
	bind() {
		playerState_default().getModel().addEboEventListener("historyChanged.eboplayer", () => {
			this.rebuildTimeline().then((r) => {});
		});
		playerState_default().getModel().addEboEventListener("trackListChanged.eboplayer", () => {
			this.rebuildTimeline().then((r) => {});
		});
		playerState_default().getModel().addEboEventListener("currentTrackChanged.eboplayer", () => {
			this.onCurrentTrackChanged();
		});
		playerState_default().getModel().addEboEventListener("selectedTrackChanged.eboplayer", () => {
			this.onSelectedTrackChanged();
		});
	}
	async rebuildTimeline() {
		let history = playerState_default().getModel().getHistory() ?? [];
		let trackList = playerState_default().getModel().getTrackList() ?? [];
		let body = document.getElementById("timelineTable").tBodies[0];
		body.innerHTML = "";
		if (history.length > 0 && trackList.length > 0 && history[0].uri == trackList[0].track.uri) history.shift();
		for (let i = history.length - 1; i >= 0; i--) this.insertHistoryLine(history[i], body);
		for (let track of trackList) this.insertTrackLine(track.track.name ?? "--no name--", track.track.uri, body, [], track.tlid);
		let uris = trackList.map((tl) => tl.track.uri);
		uris = [...new Set(uris)];
		await this.lookupAllTracksAndUpdateRows(uris);
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
		playerState_default().getController().setSelectedTrack(row.dataset.uri);
	}
	async onRowDoubleClicked(ev) {
		this.clickedRow = ev.currentTarget;
		if (this.clickedRow.dataset.tlid) await playerState_default().getPlayer().play(parseInt(this.clickedRow.dataset.tlid));
		else await playerState_default().getPlayer().clearAndPlay([this.clickedRow.dataset.uri]);
	}
	setRowsClass(rowOrSelector, classes) {
		document.getElementById("timelineTable").querySelectorAll(`tr`).forEach((tr) => tr.classList.remove(...classes));
		if (rowOrSelector instanceof HTMLTableRowElement) rowOrSelector.classList.add(...classes);
		else document.getElementById("timelineTable").querySelectorAll(rowOrSelector).forEach((tr) => tr.classList.add(...classes));
	}
	setSelectedTrack() {
		let selectedTrackUri = playerState_default().getModel().getSelectedTrack();
		this.setRowsClass(`tr[data-uri="${selectedTrackUri}"]`, ["selected"]);
	}
	async setCurrentTrack() {
		let timelineTable = document.getElementById("timelineTable");
		let focusTrack = await playerState_default().getController().lookupTrackCached(playerState_default().getModel().getCurrentTrack());
		if (!focusTrack) {
			focusTrack = await playerState_default().getController().lookupTrackCached(playerState_default().getModel().getSelectedTrack());
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
	async lookupAllTracksAndUpdateRows(uris) {
		await playerState_default().getController().lookupAllTracks(uris);
		for (const uri of uris) {
			const track = await playerState_default().getController().lookupTrackCached(uri);
			if (!track) continue;
			document.querySelectorAll(`tr[data-uri="${uri}"]`).forEach((tr) => this.updateTrackLineFromLookup(tr, track));
		}
	}
	updateTrackLineFromLookup(tr, track) {
		let artist = "⚬⚬⚬";
		let album = "⚬⚬⚬";
		let title;
		switch (track.type) {
			case "file":
				title = track.title;
				if (track.track.artists) artist = track.track.artists[0].name;
				if (track.track.album) album = track.track.album.name;
				break;
			case "stream":
				title = track.name;
				break;
		}
		this.setTrackLineContent(tr, title, artist, album);
	}
	setTrackLineContent(tr, title, artist = "⚬⚬⚬", album = "⚬⚬⚬") {
		tr.innerHTML = `
    <td>
        <h1>${title}</h1>
        <small>${artist} • ${album}</small>
    </td>
    <td>
        <button><i class="fa fa fa-ellipsis-v"></i></button>
    </td>
            `;
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.TrackList];
	}
	onCurrentTrackChanged() {
		this.setCurrentTrack();
	}
	onSelectedTrackChanged() {
		this.setSelectedTrack();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboBigTrackComp.ts
var EboBigTrackComp = class EboBigTrackComp extends EboComponent {
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
	static tagName = "ebo-big-track-view";
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
		"program_title",
		...EboBigTrackComp.progressBarAttributes
	];
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
	program_title = "";
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
		super(EboBigTrackComp.styleText, EboBigTrackComp.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboBigTrackComp.progressBarAttributes.includes(name)) {
			this.updateStringProperty(name, newValue);
			this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
			return;
		}
		switch (name) {
			case "name":
			case "stream_lines":
			case "extra":
			case "img":
			case "program_title":
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
			this.dispatchEboEvent("bigTrackAlbumImgClicked.eboplayer", {});
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
		if (this.program_title != "") shadow.getElementById("name").innerHTML = this.name + " - " + this.program_title;
		let progressBarElement = shadow.querySelector("ebo-progressbar");
		EboBigTrackComp.progressBarAttributes.forEach((attName) => {
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
var eboBigTrackComp_default = EboBigTrackComp;

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/componentViewAdapter.ts
var ComponentViewAdapter = class extends View {
	componentId;
	constructor(id) {
		super();
		this.componentId = id;
	}
	bind() {}
	getRequiredDataTypes() {
		return [];
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/bigTrackViewCurrentOrSelectedAdapter.ts
var BigTrackViewCurrentOrSelectedAdapter = class extends ComponentViewAdapter {
	streamLines;
	programTitle = "";
	uri = null;
	track;
	constructor(id) {
		super(id);
	}
	bind() {
		super.bind();
		playerState_default().getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
			await this.onCurrentOrSelectedChanged();
		});
		playerState_default().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onCurrentOrSelectedChanged();
		});
		playerState_default().getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", (ev) => {
			this.onStreamLinesChanged();
		});
		playerState_default().getModel().addEboEventListener("programTitleChanged.eboplayer", (ev) => {
			this.onProgramTitleChanged();
		});
	}
	async onCurrentOrSelectedChanged() {
		let currentTrackUri = playerState_default().getModel().getCurrentTrack();
		let selectedTrackUri = playerState_default().getModel().getSelectedTrack();
		await this.setUri(selectedTrackUri ?? currentTrackUri);
	}
	getRequiredDataTypes() {
		return [
			EboPlayerDataType.CurrentTrack,
			EboPlayerDataType.TrackList,
			...super.getRequiredDataTypes()
		];
	}
	onStreamLinesChanged() {
		let selectedTrackUri = playerState_default().getModel().getSelectedTrack();
		let currentTrackUri = playerState_default().getModel().getCurrentTrack();
		this.streamLines = "";
		if (selectedTrackUri == currentTrackUri) {
			let linesObject = playerState_default().getModel().getActiveStreamLines();
			if (this.uri && linesObject?.uri == this.uri) this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
		}
		document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
	}
	async setUri(uri) {
		this.uri = uri;
		this.track = await playerState_default().getController().getExpandedTrackModel(uri);
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
			imageUrl = this.track.stream.imageUrl;
		} else {
			name = this.track.track.title;
			info = this.track.album?.albumInfo?.name ?? "--no name--";
			position = "60";
			button = "true";
			imageUrl = this.track.album?.imageUrl ?? "";
			let artists = this.track.track.track.artists.map((a) => a.name).join(", ");
			let composers = this.track.track.track.composers?.map((c) => c.name)?.join(", ") ?? "";
			if (artists) info += "<br>" + artists;
			if (composers) info += "<br>" + composers;
		}
		let comp = document.getElementById(this.componentId);
		comp.setAttribute("name", name);
		comp.setAttribute("info", info);
		comp.setAttribute("position", position);
		comp.setAttribute("button", button);
		comp.setAttribute("img", imageUrl);
		comp.setAttribute("program_title", this.programTitle);
		this.onStreamLinesChanged();
	}
	onProgramTitleChanged() {
		this.programTitle = playerState_default().getModel().getCurrentProgramTitle();
		this.setComponentData();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboAlbumTracksComp.ts
var EboAlbumTracksComp = class EboAlbumTracksComp extends EboComponent {
	set activeTrackUri(value) {
		this._activeTrackUri = value;
		this.highLightActiveTrack();
	}
	get albumInfo() {
		return this._albumInfo;
	}
	set albumInfo(value) {
		this._albumInfo = value;
		this.requestRender();
	}
	_activeTrackUri = null;
	static tagName = "ebo-album-tracks-view";
	static observedAttributes = ["img"];
	_albumInfo = null;
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
            </style>
        `;
	static htmlText = `
            <div id="wrapper">
                <div id="tableScroller">
                    <table id="tracksTable">
                        <tbody>
                        </tbody>                
                    </table>
                </div>          
            </div>
            <dialog popover id="albumTrackPopup">
              Tadaaa....
            </dialog>        
        `;
	attributeReallyChangedCallback(_name, _oldValue, _newValue) {
		this.requestRender();
	}
	render(shadow) {
		this.renderTrackList(shadow);
	}
	renderTrackList(shadow) {
		let tbody = shadow.getElementById("tracksTable").tBodies[0];
		tbody.innerHTML = "";
		if (this.albumInfo) this.albumInfo.tracks.forEach((track) => {
			let tr = tbody.appendChild(document.createElement("tr"));
			let tdData = tr.appendChild(document.createElement("td"));
			tr.dataset.uri = track.track.uri;
			tdData.innerText = track.track.name ?? "--no name--";
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
		});
		this.highLightActiveTrack();
	}
	highLightActiveTrack() {
		if (!this._activeTrackUri) return;
		let tr = this.getShadow().querySelector(`tr[data-uri="${this._activeTrackUri}"]`);
		if (tr) tr.classList.add("current", "textGlow");
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
		new_playlist: "hide"
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
	static observedAttributes = ["list_source", "uri"];
	_btn_states = ListButtonState_AllHidden();
	list_source;
	uri;
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
                    background-color: var(--highlight-background);
                    border: none;
                }
                img {
                    height: 1.2rem;
                }
            }
        </style>
    `;
	static htmlText = `
        <div id="buttons">
            <button id="btnPlay" class="roundBorder playButton"><i class="fa fa-play"></i></button>
            <button id="btnAdd" class="roundBorder playButton"><i class="fa fa-plus"></i></button>
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
		}
		this.requestUpdate();
	}
	render(shadow) {
		this.addShadowEventListener("btnPlay", "click", (ev) => {
			if (this.btn_states.play != "show") return;
			this.dispatchEboEvent("playItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnAdd", "click", (ev) => {
			if (this.btn_states.add != "show") return;
			this.dispatchEboEvent("addItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnReplace", "click", (ev) => {
			if (this.btn_states.replace != "show") return;
			this.dispatchEboEvent("replaceItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnEdit", "click", (ev) => {
			if (this.btn_states.edit != "show") return;
			this.dispatchEboEvent("editClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnSave", "click", (ev) => {
			if (this.btn_states.save != "show") return;
			this.dispatchEboEvent("saveClicked.eboplayer", {
				source: this.list_source,
				uri: this.uri
			});
		});
		this.addShadowEventListener("btnNewPlaylist", "click", (ev) => {
			if (this.btn_states.new_playlist != "show") return;
			this.dispatchEboEvent("newPlaylistClicked.eboplayer", { source: this.list_source });
		});
		this.requestUpdate();
	}
	updateButtonState(name, newValue) {
		this.btn_states[name] = newValue;
	}
	update(shadow) {
		this.updateButtonVisibility("btnPlay", this._btn_states.play);
		this.updateButtonVisibility("btnAdd", this._btn_states.add);
		this.updateButtonVisibility("btnReplace", this._btn_states.replace);
		this.updateButtonVisibility("btnEdit", this._btn_states.edit);
		this.updateButtonVisibility("btnSave", this._btn_states.save);
		this.updateButtonVisibility("btnNewPlaylist", this._btn_states.new_playlist);
	}
	updateButtonVisibility(id, state$1) {
		let btn = this.shadow.getElementById(id);
		switch (state$1) {
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
	onDialogOkClickedCallback = () => true;
	dialog;
	constructor(dialog) {
		super();
		this.dialog = dialog;
		this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
			console_yellow("dialogOkClicked.eboplayer");
			let innnerDialog = ev.detail.dialog;
			if (this.onDialogOkClickedCallback(innnerDialog)) innnerDialog.close();
		});
	}
	bind() {
		document.getElementById("headerSearchBtn")?.addEventListener("click", () => {
			this.onBrowseButtonClick();
		});
		document.getElementById("settingsBtn")?.addEventListener("click", () => {
			this.onSettingsButtonClick();
		});
		let browseComp = document.getElementById("browseView");
		browseComp.addEboEventListener("guiBrowseFilterChanged.eboplayer", async () => {
			await this.onGuiBrowseFilterChanged(browseComp);
		});
		browseComp.addEboEventListener("breadCrumbClick.eboplayer", (ev) => {
			this.onBreadcrumbClick(ev.detail.breadcrumbId);
		});
		browseComp.addEboEventListener("browseResultClick.eboplayer", (ev) => {
			this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
		});
		browseComp.addEboEventListener("browseResultDblClick.eboplayer", async (ev) => {
			await this.onBrowseResultDblClick(ev.detail.uri);
		});
		playerState_default().getModel().addEboEventListener("genreDefsChanged.eboplayer", async () => {
			await this.onGenreDefsChanged();
		});
		playerState_default().getModel().addEboEventListener("refsFiltered.eboplayer", () => {
			this.onRefsFiltered();
		});
		playerState_default().getModel().addEboEventListener("breadCrumbsChanged.eboplayer", () => {
			this.onBreadCrumbsChanged();
		});
		playerState_default().getModel().addEboEventListener("modelBrowseFilterChanged.eboplayer", () => {
			this.onModelBrowseFilterChanged();
		});
		playerState_default().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onSelectedTrackChanged();
		});
		playerState_default().getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
			await this.onTrackListChanged();
		});
		playerState_default().getModel().addEboEventListener("viewChanged.eboplayer", async () => {
			await this.setCurrentView();
		});
		playerState_default().getModel().addEboEventListener("albumToViewChanged.eboplayer", async () => {
			await this.onAlbumToViewChanged();
		});
		let currentTrackBigViewComp = document.getElementById("currentTrackBigView");
		currentTrackBigViewComp.addEboEventListener("bigTrackAlbumImgClicked.eboplayer", async () => {
			await this.onBigTrackAlbumImgClick();
		});
		currentTrackBigViewComp.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
			currentTrackBigViewComp.setAttribute("show_back", "false");
		});
		currentTrackBigViewComp.addEboEventListener("rememberStreamLines.eboplayer", async (ev) => {
			await this.rememberStreamLines(ev.detail.lines);
		});
		addEboEventListener(document.body, "playItemListClicked.eboplayer", async (ev) => {
			await this.onPlayItemListClick(ev.detail);
		});
		addEboEventListener(document.body, "addItemListClicked.eboplayer", async (ev) => {
			await this.onAddItemListClick(ev.detail);
		});
		addEboEventListener(document.body, "replaceItemListClicked.eboplayer", async (ev) => {
			await this.onReplaceItemListClick(ev.detail);
		});
		let albumComp = document.getElementById("bigAlbumView");
		albumComp.addEboEventListener("playTrackClicked.eboplayer", async (ev) => {
			await this.onPlayTrackClicked(ev.detail.uri);
		});
		albumComp.addEboEventListener("addTrackClicked.eboplayer", async (ev) => {
			await this.onAddTrackClicked(ev.detail.uri);
		});
		albumComp.addEboEventListener("saveClicked.eboplayer", async (ev) => {
			await this.onSaveClicked(ev.detail);
		});
		playerState_default().getModel().addEboEventListener("scanStatusChanged.eboplayer", (ev) => {
			let settingsComp = document.getElementById("settingsView");
			settingsComp.scanStatus = ev.detail.text;
		});
		playerState_default().getModel().addEboEventListener("scanFinished.eboplayer", (ev) => {
			document.getElementById("settingsView").setAttribute("show_whats_new", "");
		});
		document.getElementById("settingsView").addEboEventListener("whatsNewRequested.eboplayer", () => {
			window.location.hash = "#WhatsNew";
			window.location.reload();
		});
	}
	async onGuiBrowseFilterChanged(browseComp) {
		await playerState_default().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
	}
	onRefsFiltered() {
		let browseComp = document.getElementById("browseView");
		browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? {
			refs: [],
			availableRefTypes: /* @__PURE__ */ new Set()
		};
		browseComp.renderResults();
		browseComp.action_btn_states = this.getListButtonStates(playerState_default().getModel().getView());
	}
	getListButtonStates(currentView) {
		let states = ListButtonState_AllHidden();
		if (currentView == Views.Browse) return this.setBrowseViewListButtonStates(states);
		if (currentView == Views.Album) {
			states = this.showHideTrackAndAlbumButtons(states, "show");
			states.new_playlist = "hide";
			return states;
		}
		return states;
	}
	setBrowseViewListButtonStates(states) {
		let searchResults = playerState_default().getModel().getCurrentSearchResults();
		let browseFilter = playerState_default().getModel().getCurrentBrowseFilter();
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
	showHideTrackAndAlbumButtons(states, state$1) {
		states.add = state$1;
		states.replace = state$1;
		states.play = state$1;
		states.save = state$1;
		states.edit = state$1;
		return states;
	}
	onBreadCrumbsChanged() {
		let browseComp = document.getElementById("browseView");
		browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs() ?? [];
	}
	onModelBrowseFilterChanged() {
		let browseComp = document.getElementById("browseView");
		browseComp.browseFilter = playerState_default().getModel().getCurrentBrowseFilter();
	}
	onBrowseButtonClick() {
		switch (document.getElementById("headerSearchBtn").dataset.goto) {
			case Views.Browse:
				playerState_default().getController().setView(Views.Browse);
				break;
			case Views.NowPlaying:
				playerState_default().getController().setView(Views.NowPlaying);
				break;
			case Views.Album:
				playerState_default().getController().setView(Views.Album);
				break;
		}
	}
	async setCurrentView() {
		let view = playerState_default().getModel().getView();
		await this.showView(view);
	}
	async showView(view) {
		let browseBtn = document.getElementById("headerSearchBtn");
		let layout = document.getElementById("layout");
		let prevViewClass = [...layout.classList].filter((c) => [
			"browse",
			"bigAlbum",
			"bigTrack"
		].includes(c))[0];
		let browseComp = document.getElementById("browseView");
		layout.classList.remove("browse", "bigAlbum", "bigTrack", "settings");
		switch (view) {
			case Views.WhatsNew: await playerState_default().getController().setWhatsNewFilter();
			case Views.Browse:
				layout.classList.add("browse");
				location.hash = view;
				browseBtn.dataset.goto = Views.NowPlaying;
				browseBtn.title = "Now playing";
				browseComp.browseFilter = playerState_default().getModel().getCurrentBrowseFilter();
				browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? {
					refs: [],
					availableRefTypes: /* @__PURE__ */ new Set()
				};
				browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs() ?? [];
				browseComp.setFocusAndSelect();
				browseComp.action_btn_states = this.getListButtonStates(view);
				break;
			case Views.NowPlaying:
				layout.classList.add("bigTrack");
				location.hash = "";
				browseBtn.dataset.goto = Views.Browse;
				browseBtn.title = "Search";
				break;
			case Views.Album:
				layout.classList.add("bigAlbum");
				location.hash = Views.Album;
				if (prevViewClass == "browse") {
					browseBtn.dataset.goto = Views.Browse;
					browseBtn.title = "Search";
				} else {
					browseBtn.dataset.goto = Views.NowPlaying;
					browseBtn.title = "Now playing";
				}
				let albumComp = document.getElementById("bigAlbumView");
				albumComp.btn_states = this.getListButtonStates(view);
				break;
			case Views.Settings:
				layout.classList.add("settings");
				location.hash = Views.Settings;
				browseBtn.dataset.goto = Views.NowPlaying;
				browseBtn.title = "Now playing";
				break;
			default: return unreachable(view);
		}
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.TrackList];
	}
	async onBigTrackAlbumImgClick() {
		let selectedTrack = playerState_default().getModel().getSelectedTrack();
		if (!selectedTrack) return;
		let expandedTrackInfo = await playerState_default().getController().getExpandedTrackModel(selectedTrack);
		if (!expandedTrackInfo) return;
		if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
			if (expandedTrackInfo.album?.albumInfo) playerState_default().getController().showAlbum(expandedTrackInfo.album.albumInfo.uri);
			return;
		}
		if (isInstanceOfExpandedStreamModel(expandedTrackInfo)) document.getElementById("currentTrackBigView").setAttribute("show_back", "true");
	}
	async onTrackListChanged() {
		if (!playerState_default().getModel().getCurrentTrack()) {
			let trackList = playerState_default().getModel().getTrackList();
			if (trackList.length > 0) await playerState_default().getController().setCurrentTrackAndFetchDetails(trackList[0]);
		}
	}
	async onSelectedTrackChanged() {
		let uri = playerState_default().getModel().getSelectedTrack();
		playerState_default().getController().lookupTrackCached(uri).then(async (track) => {
			if (track?.type == "file") {
				if (track.track.album) {
					let albumModel = await playerState_default().getController().getExpandedAlbumModel(track.track.album.uri);
					this.setAlbumComponentData(albumModel);
				}
			} else if (track?.type == "stream") {
				let albumComp = document.getElementById("bigAlbumView");
				let streamModel = await playerState_default().getController().getExpandedTrackModel(track.track.uri);
				albumComp.albumInfo = null;
				albumComp.setAttribute("img", streamModel.stream.imageUrl);
				albumComp.setAttribute("name", streamModel.stream.name);
				let bigTrackComp = document.getElementById("currentTrackBigView");
				bigTrackComp.streamInfo = streamModel;
			}
		});
	}
	async onAlbumToViewChanged() {
		let albumModel = await playerState_default().getController().getExpandedAlbumModel(playerState_default().getModel().getAlbumToView());
		this.setAlbumComponentData(albumModel);
	}
	setAlbumComponentData(albumModel) {
		let albumComp = document.getElementById("bigAlbumView");
		albumComp.albumInfo = albumModel;
		albumComp.setAttribute("img", albumModel.album.imageUrl);
		if (albumModel.album.albumInfo) {
			albumComp.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
			albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
		}
	}
	async onPlayItemListClick(detail) {
		if (detail.source == "albumView") {
			let albumUri = playerState_default().getModel().getAlbumToView();
			let album = (await playerState_default().getController().lookupAlbumsCached([albumUri]))[0];
			if (album.albumInfo) await playerState_default().getPlayer().clearAndPlay([album.albumInfo.uri]);
			return;
		}
		if (detail.source == "browseView") {
			await playerState_default().getPlayer().clear();
			await playerState_default().getController().addCurrentSearchResultsToPlayer();
			await playerState_default().getPlayer().play();
		}
	}
	async onAddItemListClick(detail) {
		if (detail.source == "albumView") {
			let albumComp = document.getElementById("bigAlbumView");
			await playerState_default().getPlayer().add([albumComp.dataset.albumUri]);
		}
		if (detail.source == "browseView") await playerState_default().getController().addCurrentSearchResultsToPlayer();
	}
	async onReplaceItemListClick(detail) {
		await playerState_default().getPlayer().clear();
		await this.onAddItemListClick(detail);
	}
	async onBrowseResultDblClick(uri) {
		await playerState_default().getPlayer().clearAndPlay([uri]);
	}
	onBrowseResultClick(label, uri, type) {
		playerState_default().getController().diveIntoBrowseResult(label, uri, type, true);
	}
	onBreadcrumbClick(breadcrumbId) {
		playerState_default().getController().resetToBreadCrumb(breadcrumbId);
	}
	async onPlayTrackClicked(uri) {
		await playerState_default().getPlayer().clearAndPlay([uri]);
	}
	async onAddTrackClicked(uri) {
		let trackModel = await playerState_default().getController().getExpandedTrackModel(uri);
		if (isInstanceOfExpandedTrackModel(trackModel)) {
			if (trackModel.album?.albumInfo) await (await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri)).text();
		}
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
	async saveAlbumAsPlaylist(name, detail) {
		console_yellow(`Saving album to playlist ${name} as ${detail.uri}`);
		let playlist = await playerState_default().getController().createPlaylist(name);
		await playerState_default().getController().addRefToPlaylist(playlist.uri, detail.uri, "album", -1);
		return true;
	}
	showDialog(contentHtml, okButtonText, onOkClicked) {
		this.onDialogOkClickedCallback = onOkClicked;
		this.dialog.innerHTML = contentHtml;
		this.dialog.showModal();
		this.dialog.setAttribute("ok_text", okButtonText);
	}
	async onGenreDefsChanged() {
		let browseComp = document.getElementById("browseView");
		browseComp.genreDefs = await playerState_default().getController().getGenreDefsCached();
	}
	async rememberStreamLines(lines) {
		playerState_default().getController().remember(lines.join("\n"));
	}
	onSettingsButtonClick() {
		this.showView(Views.Settings);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboBrowseComp.ts
var EboBrowseComp = class EboBrowseComp extends EboComponent {
	get genreDefs() {
		return this._genreDefs;
	}
	set genreDefs(value) {
		this._genreDefs = value;
	}
	get action_btn_states() {
		return this._action_btn_states;
	}
	set action_btn_states(value) {
		this._action_btn_states = value;
		this.requestUpdate();
	}
	static tagName = "ebo-browse-view";
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
	_browseFilter;
	_genreDefs;
	static observedAttributes = [];
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
                flex-direction: column;
                td {
                    padding-top: .2em;
                    padding-bottom: .2em;
                }
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
        <div id="tableWrapper" class="">
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
			case "name":
			case "stream_lines":
			case "extra":
				this.updateStringProperty(name, newValue);
				break;
			case "enabled":
			case "show_back":
				this.updateBoolProperty(name, newValue);
				break;
		}
		this.requestRender();
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
			let imgUrl = "";
			if (result.type == "ref") {
				let model = await playerState_default().getController().getExpandedModel(result.item);
				if (model) if (isInstanceOfExpandedTrackModel(model)) imgUrl = model.album?.imageUrl ?? "";
				else if (isInstanceOfExpandedStreamModel(model)) imgUrl = model.stream.imageUrl;
				else imgUrl = model.album.imageUrl;
			}
			let refType = result.item.ref.type;
			html += `
                    <ebo-list-item 
                        data-uri="${result.item.ref.uri}" 
                        data-type="${refType}"
                        text="${result.item.ref.name + this.getGenreAlias(result)}"
                        img="${imgUrl}">
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
		if (result.type != "genreDef") return "";
		let genreDef = this.genreDefs?.get(result.item.ref.name ?? "__undefined__");
		if (!genreDef) return "";
		if (genreDef.replacement != null) return ` (${genreDef.replacement})`;
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
//#region mopidy_eboplayer2/www/typescript/components/eboButton.ts
var PressedChangeEvent = class extends Event {
	_pressed;
	constructor(pressed) {
		super("pressedChange");
		this._pressed = pressed;
	}
	get pressed() {
		return this._pressed;
	}
};
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
        </button>
        `;
	constructor() {
		super(EboButton.styleText, EboButton.htmlText);
		this.img = "";
		this.pressTimer = new MouseTimer(this, (source) => this.onClick(source), (source, clickCount) => this.onMultiClick(source, clickCount), (source) => this.onFilterButtonTimeOut(source));
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
	}
	onClick(eboButton) {
		if (this.disabled) return;
		let button = this.getShadow().querySelector("button");
		if (this.toggle) {
			this.pressed = !this.pressed;
			this.setClassFromBoolAttribute(button, "pressed");
			this.setAttribute("pressed", this.pressed.toString());
		}
		let event = new PressedChangeEvent(this.pressed);
		this.dispatchEvent(event);
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
//#region mopidy_eboplayer2/www/typescript/components/eboBigAlbumComp.ts
var EboBigAlbumComp = class EboBigAlbumComp extends EboComponent {
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
	static tagName = "ebo-big-album-view";
	static progressBarAttributes = [
		"position",
		"min",
		"max",
		"button",
		"active"
	];
	static observedAttributes = [
		"name",
		"extra",
		"img",
		"disabled"
	];
	name = "";
	extra = "";
	img = "";
	albumClickEvent;
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
                height: 100%;
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
                        <h3 id="name" class="selectable"></h3>
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
		this.albumClickEvent = new CustomEvent("albumClick", {
			bubbles: true,
			cancelable: false,
			composed: true,
			detail: "todo: tadaaa!"
		});
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
	}
	onActiveTrackChanged() {
		let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view");
		tracksComp.activeTrackUri = this.activeTrackUri;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboButtonBarComp.ts
var EboPlayerBar = class EboPlayerBar extends EboComponent {
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
	static styleText = `
        <style>
            img {
                width: 2em;
                height: 2em;
                margin-right: 1em;
            }
        
            .playing {
                background-color: var(--highlight-background);
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
                    <button id="btnMore" style="margin-left: 1em;" title="Next"><i class="fa fa-ellipsis-h"></i></button>
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
		let titleEl = shadow.getElementById("text");
		let img = shadow.querySelector("img");
		titleEl.style.display = this.show_info ? "" : "none";
		if (this.image_url) {
			img.style.visibility = this.show_info ? "visible" : "hidden";
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
//#region mopidy_eboplayer2/www/typescript/components/eboMenuButton.ts
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
                margin-left: 0.25rem;
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
	render() {}
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
	async fetchPlaybackOptions() {
		let promises = [
			await this.commands.core.tracklist.getRepeat(),
			await this.commands.core.tracklist.getRandom(),
			await this.commands.core.tracklist.getConsume(),
			await this.commands.core.tracklist.getSingle()
		];
		let results = await Promise.all(promises);
		return {
			repeat: results[0],
			random: results[1],
			consume: results[2],
			single: results[3]
		};
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
	createPlaylist(name) {
		return this.commands.core.playlists.create(name, "eboback");
	}
	savePlaylist(playlist) {
		return this.commands.core.playlists.save(playlist);
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
//#region mopidy_eboplayer2/www/typescript/components/eboAlbumDetails.ts
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
	}
	update(shadow) {
		if (this.albumInfo) {
			let albumName = shadow.getElementById("albumName");
			albumName.innerHTML = this.albumInfo.album?.albumInfo?.name ?? "--no name--";
			let imgTag = shadow.getElementById("bigImage");
			imgTag.src = this.albumInfo.album.imageUrl;
			let body = shadow.querySelector("#tableContainer > table").tBodies[0];
			body.innerHTML = "";
			this.addMetaDataRow(body, "Year:", this.albumInfo.album.albumInfo?.date ?? "--no date--");
			this.addMetaDataRow(body, "Artists:", this.albumInfo.artists.map((artist) => artist.name).join(", "));
			this.addMetaDataRow(body, "Composers:", this.albumInfo.composers.map((artist) => artist.name).join(","));
			let genreDefs = this.albumInfo.genres.map((genre) => ({
				genre,
				def: playerState_default().getController().getGenreDef(genre)
			}));
			let genresHtml = "";
			genreDefs.forEach((def) => {
				let defHtml = "";
				if (def.def) defHtml += `<span class="replaced">${def.genre}</span> &gt; ${def.def.replacement}`;
				genresHtml += defHtml;
			});
			this.addMetaDataRow(body, "Genres", genresHtml);
			this.addMetaDataRow(body, "Playlists", "todo...");
		}
	}
	addMetaDataRow(body, colText1, colText2) {
		let tr = body.appendChild(document.createElement("tr"));
		let td1 = tr.appendChild(document.createElement("td"));
		td1.innerHTML = colText1;
		let td2 = tr.appendChild(document.createElement("td"));
		td2.innerHTML = colText2;
		td2.classList.add("selectable");
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboRadioDetailsComp.ts
var EboRadioDetailsComp = class EboRadioDetailsComp extends EboComponent {
	_streamInfo = null;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestUpdate();
	}
	static tagName = "ebo-radio-details-view";
	static observedAttributes = ["img"];
	constructor() {
		super(EboRadioDetailsComp.styleText, EboRadioDetailsComp.htmlText);
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
	render(shadow) {}
	update(shadow) {
		let tbody = shadow.getElementById("tracksTable").tBodies[0];
		tbody.innerHTML = "";
		if (this.streamInfo) {
			this.streamInfo.historyLines.forEach((lineGroup, index) => {
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
                            </div>
                        </ebo-menu-button>`;
					td2.querySelector("#rememberTrack")?.addEventListener("click", (ev) => {
						this.saveRemember(ev.target);
					});
					td2.querySelector("#excludeLine")?.addEventListener("click", (ev) => {
						console_yellow("Exclude line clicked");
					});
					td2.querySelector("#isProgramTitle")?.addEventListener("click", (ev) => {
						console_yellow("Line is program title clicked");
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
//#region mopidy_eboplayer2/www/typescript/components/eboBrowseFilterComp.ts
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
        </style>
        `;
	static htmlText = `
<div id="wrapper">
    <div id="filterBox">
        <div id="searchBox" class="flexRow">
            <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIcon"></button>
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
            <button> &nbsp;&nbsp;(?) </button>
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
		shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {});
		let inputElement = shadow.getElementById("searchText");
		inputElement.addEventListener("keyup", (ev) => {
			this._browseFilter.searchText = inputElement.value;
			this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
		});
		shadow.getElementById("all").addEventListener("click", (ev) => {
			this.onShowAllTypesButtonPress();
		});
		shadow.querySelectorAll("ebo-button").forEach((btn) => {
			btn.addEventListener("pressedChange", async (ev) => {
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
	}
	updateFilterButton(btn) {
		let propName = btn.id.replace("filter", "").charAt(0).toLowerCase() + btn.id.replace("filter", "").slice(1);
		if (this._browseFilter[propName]) btn.setAttribute("pressed", "");
		else btn.removeAttribute("pressed");
		if (this.availableRefTypes.has(propName)) btn.removeAttribute("disabled");
		else btn.setAttribute("disabled", "");
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
			playerState_default().getController().startScan().then(() => {});
			console_yellow("Just started....");
		});
		shadow.getElementById("whatsNewBtn").addEventListener("click", async (ev) => {
			this.dispatchEboEvent("whatsNewRequested.eboplayer", {});
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
		"text"
	];
	selected = false;
	img;
	selection_mode;
	display = "icon";
	text = "";
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
                background-color: var(--selected-background); 
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
                    }
                    font-size: .5rem;
                    #text {
                    width: 5rem;
                    text-align: center;
                    overflow: auto;
                    text-overflow: ellipsis;
                    }
                }
                &.selected {
                    background-color: var(--selected-background); 
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
	render(shadow) {
		this.requestUpdate();
	}
	update(shadow) {
		let wrapper = shadow.getElementById("wrapper");
		this.setClassFromBoolAttribute(wrapper, "selected");
		wrapper.classList.remove("line", "icon");
		wrapper.classList.add(this.display);
		this.setImage("img", this.img);
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
		EboComponent.define(eboBigTrackComp_default);
		EboComponent.define(EboAlbumTracksComp);
		EboComponent.define(EboBrowseComp);
		EboComponent.define(EboButton);
		EboComponent.define(EboBigAlbumComp);
		EboComponent.define(EboPlayerBar);
		EboComponent.define(EboMenuButton);
		EboComponent.define(EboListButtonBar);
		EboComponent.define(EboDialog);
		EboComponent.define(EboAlbumDetails);
		EboComponent.define(EboRadioDetailsComp);
		EboComponent.define(EboBrowseFilterComp);
		EboComponent.define(EboSettingsComp);
		EboComponent.define(EboListItemComp);
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
	let controller = new Controller(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopidyProxy, player);
	controller.initSocketevents();
	let state$1 = new State(mopidy, model, controller, player);
	setState(state$1);
	let mainView = new MainView(document.getElementById("dialog"));
	let headerView = new HeaderView();
	let currentTrackView = new BigTrackViewCurrentOrSelectedAdapter("currentTrackBigView");
	let buttonBarView = new PlayerBarView("buttonBar", mainView);
	let historyView = new TimelineView();
	playerState_default().addViews(mainView, headerView, currentTrackView, buttonBarView, historyView);
	if (location.hash == Views.Album) controller.setView(Views.NowPlaying);
	else controller.setView(location.hash != "" ? location.hash : Views.NowPlaying);
	mopidy.connect();
	eboWsFrontCtrl.connect();
	eboWsBackCtrl.connect();
}
let rootDir = document.location.pathname.replace("index.html", "");

//#endregion
export { getWebSocketUrl };
//# sourceMappingURL=bundle.js.map