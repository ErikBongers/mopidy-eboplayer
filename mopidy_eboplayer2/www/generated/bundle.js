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
	send(message) {
		switch (this._webSocket.readyState) {
			case WebSocket.CONNECTING: return Promise.reject(new ConnectionError("WebSocket is still connecting"));
			case WebSocket.CLOSING: return Promise.reject(new ConnectionError("WebSocket is closing"));
			case WebSocket.CLOSED: return Promise.reject(new ConnectionError("WebSocket is closed"));
			default: return new Promise((resolve, reject) => {
				const jsonRpcMessage = {
					...message,
					jsonrpc: "2.0",
					id: this._nextRequestId()
				};
				this._pendingRequests[jsonRpcMessage.id] = {
					resolve,
					reject
				};
				this._webSocket.send(JSON.stringify(jsonRpcMessage));
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
		this._options = this._configure({
			backoffDelayMin: 1e3,
			backoffDelayMax: 64e3,
			autoConnect: true,
			webSocketUrl: "",
			...options
		});
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
		if (options.webSocketUrl) return options;
		let protocol = typeof document !== "undefined" && document.location.protocol === "https:" ? "wss://" : "ws://";
		let currentHost = typeof document !== "undefined" && document.location.host || "localhost";
		options.webSocketUrl = `${protocol}${currentHost}/mopidy/ws`;
		return options;
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
	send(message) {
		return this.rpcController?.send(message);
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
		this.controller.fetchRefsForCurrentBreadCrumbs().then(() => {
			this.controller.filterBrowseResults();
		});
	}
};
let state = void 0;
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
	calculateWeight(result, browseFilter) {
		if (result.ref.ref.name.toLowerCase().startsWith(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (result.ref.ref.name.toLowerCase().includes(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (!browseFilter.searchText) result.weight += 1;
	}
	setFilter(browseFilter) {
		this._browseFilter = browseFilter;
	}
	applyFilter(searchResults) {
		searchResults.forEach((result) => {
			this.calculateWeight(result, this.browseFilter);
		});
		return searchResults.filter((result) => result.weight > 0).sort((a, b) => {
			if (b.weight === a.weight) return a.ref.ref.name.localeCompare(b.ref.ref.name);
			return b.weight - a.weight;
		});
	}
	getSearchResults() {
		return this.searchResults;
	}
	getAvailableRefTypes(refs) {
		let distinctTypes = refs.map((r) => r.type).reduce((typeSet, val) => typeSet.add(val), /* @__PURE__ */ new Set());
		console.log(distinctTypes);
		return distinctTypes;
	}
};
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
		this.tracks = tracks.map((track) => ({
			type: "track",
			ref: track
		}));
		this.albums = albums.map((album) => ({
			type: "album",
			ref: album
		}));
		this.artists = artists.map((artist) => ({
			type: "artist",
			ref: artist
		}));
		this.genres = genres.map((genre) => ({
			type: "genre",
			ref: genre
		}));
		this.radios = radios.map((radio) => ({
			type: "radio",
			ref: radio
		}));
		this.playlists = playlists.map((album) => ({
			type: "playlist",
			ref: album
		}));
		this.availableRefTypes = /* @__PURE__ */ new Set();
		this.getAvailableRefTypes(this.tracks).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.albums).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.artists).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.genres).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.radios).forEach((type) => this.availableRefTypes.add(type));
		this.getAvailableRefTypes(this.playlists).forEach((type) => this.availableRefTypes.add(type));
	}
	filter() {
		this.searchResults = {
			refs: this.applyFilter(this.prefillWithTypes(this.browseFilter)),
			availableRefTypes: this.availableRefTypes
		};
	}
	prefillWithTypes(browseFilter) {
		let refs = [];
		if (browseFilter.album || browseFilter.isNoTypeSelected()) refs.push(...this.albums.map((ref) => ({
			ref,
			weight: 0
		})));
		if (browseFilter.artist || browseFilter.isNoTypeSelected()) refs.push(...this.artists.map((ref) => ({
			ref,
			weight: 0
		})));
		if (browseFilter.track || browseFilter.isNoTypeSelected()) refs.push(...this.tracks.map((ref) => ({
			ref,
			weight: 0
		})));
		if (browseFilter.genre || browseFilter.isNoTypeSelected()) refs.push(...this.genres.map((ref) => ({
			ref,
			weight: 0
		})));
		if (browseFilter.radio || browseFilter.isNoTypeSelected()) refs.push(...this.radios.map((ref) => ({
			ref,
			weight: 0
		})));
		if (browseFilter.playlist || browseFilter.isNoTypeSelected()) refs.push(...this.playlists.map((ref) => ({
			ref,
			weight: 0
		})));
		return refs;
	}
};
var SomeRefs = class SomeRefs extends Refs {
	refs;
	availableRefTypes;
	constructor(refs) {
		super();
		this.refs = refs.map((r) => {
			return {
				ref: r,
				type: SomeRefs.toRefType(r)
			};
		});
		this.availableRefTypes = this.getAvailableRefTypes(this.refs);
	}
	static toRefType(ref) {
		if (!["directory", "track"].includes(ref.type)) return ref.type;
		if (ref.uri.startsWith("eboback:stream:")) return "radio";
		if (ref.uri.startsWith("eboback:directory?genre")) return "genre";
		return ref.type;
	}
	filter() {
		this.searchResults = {
			refs: this.applyFilter(this.refs.map((ref) => ({
				ref,
				weight: 0
			}))),
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
function isBreadCrumbForArtist(breadCrumb) {
	return breadCrumb.data.type == "artist";
}
var BrowseFilter = class {
	searchText;
	album;
	track;
	radio;
	artist;
	playlist;
	genre;
	constructor() {
		this.searchText = "";
		this.track = false;
		this.artist = false;
		this.genre = false;
		this.radio = false;
		this.playlist = false;
		this.album = false;
	}
	isNoTypeSelected() {
		return !(this.album || this.track || this.radio || this.artist || this.playlist || this.genre);
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
};
const TrackNone = { type: "none" };
function isInstanceOfExpandedStreamModel(model) {
	return "stream" in model;
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
	static NoTrack = { type: "none" };
	currentTrack;
	selectedTrack;
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
	allRefs;
	currentRefs;
	view = Views.NowPlaying;
	albumToViewUri;
	constructor() {
		super();
		this.initializeBreadcrumbStack();
	}
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
	filterCurrentRefs() {
		if (!this.currentRefs) return;
		this.currentRefs.browseFilter = this.currentBrowseFilter;
		this.currentRefs.filter();
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
		return this.libraryCache.get(uri);
	}
	getCurrentBrowseFilter = () => this.currentBrowseFilter;
	setCurrentBrowseFilter(browseFilter) {
		this.currentBrowseFilter = browseFilter;
		this.dispatchEboEvent("browseFilterChanged.eboplayer", {});
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
		if (track.type == "none") {
			this.currentTrack = void 0;
			return;
		}
		this.currentTrack = track.track.uri;
		this.addToLibraryCache(this.currentTrack, track);
		this.dispatchEboEvent("currentTrackChanged.eboplayer", {});
	}
	getSelectedTrack = () => this.selectedTrack;
	setSelectedTrack(uri) {
		if (uri == "") this.selectedTrack = void 0;
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
		for (let item of items) if (item.type == "album") this.updateLibraryCache(item.albumInfo.uri, item);
		else this.updateLibraryCache(item.track.uri, item);
	}
	getFromLibraryCache(uri) {
		return this.libraryCache.get(uri);
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
	constructor(mopidy) {
		this.mopidy = mopidy;
		this.core.commands = this;
		this.core.history.commands = this;
		this.core.library.commands = this;
		this.core.mixer.commands = this;
		this.core.playback.commands = this;
		this.core.playlists.commands = this;
		this.core.tracklist.commands = this;
	}
	send(method, params) {
		if (params) return this.mopidy.send({
			method,
			params
		});
		else return this.mopidy.send({ method });
	}
	core = {
		commands: void 0,
		getUriSchemes() {
			return this.commands.send("core.get_uri_schemes");
		},
		getVersion() {
			return this.commands.send("core.get_version");
		},
		history: {
			commands: void 0,
			getHistory() {
				return this.commands.send("core.history.get_history");
			},
			getLength() {
				return this.commands.send("core.history.get_length");
			}
		},
		library: {
			commands: void 0,
			browse(uri) {
				return this.commands.send("core.library.browse", { uri });
			},
			getDistinct(field, query) {
				return this.commands.send("core.library.get_distinct", {
					field,
					query
				});
			},
			getImages(uris) {
				return this.commands.send("core.library.get_images", { uris });
			},
			lookup(uris) {
				return this.commands.send("core.library.lookup", { uris });
			},
			refresh(uri) {
				return this.commands.send("core.library.refresh", { uri });
			},
			search(query, uris, exact = false) {
				return this.commands.send("core.library.search", {
					query,
					uris,
					exact
				});
			}
		},
		mixer: {
			commands: void 0,
			getMute() {
				return this.commands.send("core.mixer.get_mute");
			},
			getVolume() {
				return this.commands.send("core.mixer.get_volume");
			},
			setMute(mute) {
				return this.commands.send("core.mixer.set_mute", { mute });
			},
			setVolume(volume) {
				return this.commands.send("core.mixer.set_volume", { volume });
			}
		},
		playback: {
			commands: void 0,
			getCurrentTlTrack() {
				return this.commands.send("core.playback.get_current_tl_track");
			},
			getCurrentTlid() {
				return this.commands.send("core.playback.get_current_tlid");
			},
			getCurrentTrack() {
				return this.commands.send("core.playback.get_current_track");
			},
			getState() {
				return this.commands.send("core.playback.get_state");
			},
			getStreamTitle() {
				return this.commands.send("core.playback.get_stream_title");
			},
			getTimePosition() {
				return this.commands.send("core.playback.get_time_position");
			},
			next() {
				return this.commands.send("core.playback.next");
			},
			pause() {
				return this.commands.send("core.playback.pause");
			},
			play(tl_track, tlid) {
				return this.commands.send("core.playback.play", {
					tl_track,
					tlid
				});
			},
			previous() {
				return this.commands.send("core.playback.previous");
			},
			resume() {
				return this.commands.send("core.playback.resume");
			},
			seek(time_position) {
				return this.commands.send("core.playback.seek", { time_position });
			},
			setState(new_state) {
				return this.commands.send("core.playback.set_state", { new_state });
			},
			stop() {
				return this.commands.send("core.playback.stop");
			}
		},
		playlists: {
			commands: void 0,
			asList() {
				return this.commands.send("core.playlists.as_list");
			},
			create(name, uri_scheme) {
				return this.commands.send("core.playlists.create", {
					name,
					uri_scheme
				});
			},
			delete(uri) {
				return this.commands.send("core.playlists.delete", { uri });
			},
			getItems(uri) {
				return this.commands.send("core.playlists.get_items", { uri });
			},
			getUriSchemes() {
				return this.commands.send("core.playlists.get_uri_schemes");
			},
			lookup(uri) {
				return this.commands.send("core.playlists.lookup", { uri });
			},
			refresh(uri_scheme) {
				return this.commands.send("core.playlists.refresh", { uri_scheme });
			},
			save(playlist) {
				return this.commands.send("core.playlists.save", { playlist });
			}
		},
		tracklist: {
			commands: void 0,
			add(tracks, at_position, uris) {
				return this.commands.send("core.tracklist.add", {
					tracks,
					at_position,
					uris
				});
			},
			clear() {
				return this.commands.send("core.tracklist.clear");
			},
			eotTrack(tl_track) {
				return this.commands.send("core.tracklist.eot_track", { tl_track });
			},
			filter(criteria) {
				return this.commands.send("core.tracklist.filter", { criteria });
			},
			getConsume() {
				return this.commands.send("core.tracklist.get_consume");
			},
			getEotTlid() {
				return this.commands.send("core.tracklist.get_eot_tlid");
			},
			getLength() {
				return this.commands.send("core.tracklist.get_length");
			},
			getNextTlid() {
				return this.commands.send("core.tracklist.get_next_tlid");
			},
			getPreviousTlid() {
				return this.commands.send("core.tracklist.get_previous_tlid");
			},
			getRandom() {
				return this.commands.send("core.tracklist.get_random");
			},
			getRepeat() {
				return this.commands.send("core.tracklist.get_repeat");
			},
			getSingle() {
				return this.commands.send("core.tracklist.get_single");
			},
			getTlTracks() {
				return this.commands.send("core.tracklist.get_tl_tracks");
			},
			getTracks() {
				return this.commands.send("core.tracklist.get_tracks");
			},
			getVersion() {
				return this.commands.send("core.tracklist.get_version");
			},
			index(tl_track, tlid) {
				return this.commands.send("core.tracklist.index", {
					tl_track,
					tlid
				});
			},
			move(start, end, to_position) {
				return this.commands.send("core.tracklist.move", {
					start,
					end,
					to_position
				});
			},
			nextTrack(tl_track) {
				return this.commands.send("core.tracklist.next_track", { tl_track });
			},
			previousTrack(tl_track) {
				return this.commands.send("core.tracklist.previous_track", { tl_track });
			},
			remove(criteria) {
				return this.commands.send("core.tracklist.remove", { criteria });
			},
			setConsume(value) {
				return this.commands.send("core.tracklist.set_consume", { value });
			},
			setRandom(value) {
				return this.commands.send("core.tracklist.set_random", { value });
			},
			setRepeat(value) {
				return this.commands.send("core.tracklist.set_repeat", { value });
			},
			setSingle(value) {
				return this.commands.send("core.tracklist.set_single", { value });
			},
			shuffle(start, end) {
				return this.commands.send("core.tracklist.shuffle", {
					start,
					end
				});
			},
			slice(start, end) {
				return this.commands.send("core.tracklist.slice", {
					start,
					end
				});
			}
		}
	};
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
function numberedDictToArray(dict, converter) {
	let length = dict.length;
	let array = [];
	for (let index = 0; index < length; index++) {
		let line = dict[index.toString()];
		array.push(line);
	}
	if (!converter) return array;
	return array.map(converter);
}
function getHostAndPort() {
	let hostDefs = getHostAndPortDefs();
	return hostDefs.altHost ?? hostDefs.host;
}
function getHostAndPortDefs() {
	let altHostName = document.body.dataset.hostname;
	if (altHostName.startsWith("{{")) altHostName = void 0;
	if (!altHostName) altHostName = localStorage.getItem("eboplayer.hostName");
	return {
		host: document.location.host,
		altHost: altHostName
	};
}
function isStream(track) {
	return (track?.length ?? 0) == 0;
}
function transformTrackDataToModel(track) {
	if (isStream(track)) return {
		type: "stream",
		track,
		name: track.name
	};
	let model = {
		type: "file",
		composer: "",
		track,
		title: track.name,
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
function assertUnreachable(x) {
	throw new Error("Didn't expect to get here");
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/proxies/webProxy.ts
var WebProxy = class {
	constructor() {}
	async fetchActiveStreamLines(uri) {
		let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/activeLines`);
		url.searchParams.set("uri", uri);
		return await (await fetch(url)).json();
	}
	async fetchAllStreamLines(uri) {
		let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/allLines`);
		url.searchParams.set("uri", uri);
		return await (await fetch(url)).json();
	}
	async fetchMetaData(albumUri) {
		let url = new URL(`http://${getHostAndPort()}/eboback/data/get_album_meta`);
		url.searchParams.set("uri", albumUri);
		let text = await (await fetch(url)).text();
		if (text) return JSON.parse(text);
		return null;
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
	eboWebSocketCtrl;
	baseUrl;
	static DEFAULT_IMG_URL = "images/default_cover.png";
	player;
	constructor(model, mopidy, eboWebSocketCtrl, mopdyProxy, player) {
		super(mopidy);
		this.model = model;
		this.player = player;
		this.mopidyProxy = mopdyProxy;
		this.webProxy = new WebProxy();
		this.localStorageProxy = new LocalStorageProxy(model);
		this.eboWebSocketCtrl = eboWebSocketCtrl;
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
			this.model.setHistory(await this.mopidyProxy.fetchHistory());
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
			this.model.setPlayState("stopped");
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
		this.eboWebSocketCtrl.on("event:streamHistoryChanged", (data) => {
			let streamTitles = data.stream_titles;
			this.model.setActiveStreamLinesHistory(streamTitles);
		});
		this.model.addEboEventListener("playbackStateChanged.eboplayer", async () => {
			await this.updateStreamLines();
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
		if (!this.model.selectedTrack) this.model.setSelectedTrack(trackModel.track.uri);
		await this.updateStreamLines();
	}
	async updateStreamLines() {
		if (this.model.getPlayState() == "playing") {
			if (!this.model.currentTrack) {
				this.model.setActiveStreamLinesHistory(NoStreamTitles);
				return;
			}
			let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack);
			this.model.setActiveStreamLinesHistory(lines);
		} else this.model.setActiveStreamLinesHistory(NoStreamTitles);
	}
	async fetchLargestImagesOrDefault(uris) {
		function getImageUrl(uri, baseUrl) {
			let arr = images[uri];
			arr.sort((imgA, imgB) => imgA.width * imgA.height - imgB.width * imgB.height);
			if (arr.length == 0) return Controller.DEFAULT_IMG_URL;
			let imageUrl = arr.pop().uri;
			if (imageUrl == "") imageUrl = Controller.DEFAULT_IMG_URL;
			return baseUrl + imageUrl;
		}
		let images = await this.mopidyProxy.fetchImages(uris);
		let mappedImage = uris.map((uri) => {
			let imageUrl = getImageUrl(uri, this.baseUrl);
			return [uri, imageUrl];
		});
		return new Map(mappedImage);
	}
	setAndSaveBrowseFilter(filter) {
		this.localStorageProxy.saveCurrentBrowseFilter(filter);
		this.model.setCurrentBrowseFilter(filter);
		this.filterBrowseResults();
	}
	diveIntoBrowseResult(label, uri, type, addTextFilterBreadcrumb) {
		if (type == "track" || type == "radio") return;
		if (type == "album") playerState_default().getController().getExpandedAlbumModel(uri).then(() => {
			this.model.setAlbumToView(uri);
			this.setView(Views.Album);
		});
		if (addTextFilterBreadcrumb) {
			let browseFilter = this.model.getCurrentBrowseFilter();
			let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
			this.model.pushBreadCrumb(breadCrumb1);
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
		this.setAndSaveBrowseFilter(newBrowseFilter);
		this.fetchRefsForCurrentBreadCrumbs().then(() => {
			this.filterBrowseResults();
		});
	}
	resetToBreadCrumb(id) {
		let breadCrumb = playerState_default().getModel().getBreadCrumbs().get(id);
		let breadCrumbs = playerState_default().getModel().getBreadCrumbs();
		if (breadCrumb instanceof BreadCrumbBrowseFilter) {
			this.model.resetBreadCrumbsTo(id);
			let browseFilter = this.model.popBreadCrumb().data;
			this.setAndSaveBrowseFilter(browseFilter);
			this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
			this.fetchRefsForCurrentBreadCrumbs().then(() => {
				this.filterBrowseResults();
			});
		} else if (breadCrumb instanceof BreadCrumbRef) {
			if (isBreadCrumbForArtist(breadCrumb)) {
				this.model.resetBreadCrumbsTo(id);
				this.model.popBreadCrumb();
				this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
			} else if (isBreadCrumbForAlbum(breadCrumb)) {
				this.model.setAlbumToView(breadCrumb.data.uri);
				this.setView(Views.Album);
			}
		} else if (breadCrumb instanceof BreadCrumbHome) {
			this.model.resetBreadCrumbsTo(id);
			this.setAndSaveBrowseFilter(new BrowseFilter());
			this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
			this.fetchRefsForCurrentBreadCrumbs().then(() => {
				this.filterBrowseResults();
			});
		}
	}
	async lookupTrackCached(trackUri) {
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
				albumInfo: trackList[0].album,
				tracks: trackList.map((track) => track.uri)
			};
		});
		let partialAlbumModels = await Promise.all(albumModelsPending);
		let images = await this.fetchLargestImagesOrDefault(partialAlbumModels.map((album) => album.albumInfo.uri));
		this.model.addImagesToCache(images);
		let albumModels = partialAlbumModels.map((m) => {
			return {
				...m,
				imageUrl: this.model.getImageFromCache(m.albumInfo.uri)
			};
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
	async getExpandedTrackModel(trackUri) {
		let track = await this.lookupTrackCached(trackUri);
		if (track.type == "stream") {
			let streamLines = await this.fetchStreamLines(trackUri);
			return {
				stream: track,
				historyLines: streamLines
			};
		} else {
			let album = await this.lookupAlbumsCached([track.track.album.uri]);
			return {
				track,
				album: album[0]
			};
		}
	}
	async getExpandedAlbumModel(albumUri) {
		let album = (await this.lookupAlbumsCached([albumUri]))[0];
		let meta = await this.getMetaDataCached(albumUri);
		let tracks = await Promise.all(album.tracks.map((trackUri) => this.lookupTrackCached(trackUri)));
		return {
			album,
			tracks,
			meta
		};
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
	async getCurrertTrackInfoCached() {
		let trackUri = this.model.getCurrentTrack();
		if (!trackUri) return TrackNone;
		return await this.lookupTrackCached(trackUri);
	}
	async fetchAllRefs() {
		let roots = await this.mopidyProxy.fetchRootDirs();
		let subDir1 = await this.mopidyProxy.browse(roots[1].uri);
		let allTracks = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=track");
		let allAlbums = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=album");
		let allArtists = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=artist");
		let allGenres = await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=genre");
		let playLists = await this.mopidyProxy.fetchPlayLists();
		let radioStreamsPlayList = playLists.find((playlist) => playlist.name == "[Radio Streams]");
		let playlists = playLists.filter((playlist) => playlist.name != "[Radio Streams]");
		let radioStreams;
		if (radioStreamsPlayList) radioStreams = await this.mopidyProxy.fetchPlaylistItems(radioStreamsPlayList.uri);
		return new AllRefs(roots, subDir1, allTracks, allAlbums, allArtists, allGenres, radioStreams, playlists);
	}
	filterBrowseResults() {
		this.model.filterCurrentRefs();
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
		this.model.setCurrentRefs(this.model.getAllRefs());
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
		await this.player.add(results.refs.map((r) => r.ref.ref.uri));
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/buttonBarView.ts
var ButtonBarView = class extends View {
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
			} else {
				comp.setAttribute("text", trackModel.track.track.name);
				comp.setAttribute("allow_play", "true");
				comp.setAttribute("allow_prev", "false");
				comp.setAttribute("allow_next", "false");
				comp.setAttribute("image_url", trackModel.album.imageUrl);
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
	get rendered() {
		return this._rendered;
	}
	static globalCss = [];
	static cssCache = /* @__PURE__ */ new Map();
	shadow;
	styleTemplate;
	divTemplate;
	connected = false;
	_rendered = false;
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
		if (!this._rendered) return;
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
		this._rendered = true;
	}
	getShadow() {
		return this.shadow;
	}
	setClassFromBoolAttribute(el, attName) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
	updateBoolAtrribute(newValue, name) {
		if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
		this[name] = newValue == "true";
	}
	static define(comp) {
		if (comp.tagName == EboComponent.NO_TAG_NAME) throw "Component class should have tagName defined.";
		customElements.define(comp.tagName, comp);
	}
	addShadowEventListener(id, type, listener) {
		this.shadow.getElementById(id).addEventListener(type, listener);
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
				this.updateBoolAtrribute(newValue, name);
				break;
		}
		if (!(this.min <= this.position && this.position <= this.max)) throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
		this.requestRender();
	}
	connectedCallback() {}
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
		if (history.length > 0 && trackList.length > 0 && history[0].ref.uri == trackList[0].track.uri) history.shift();
		for (let i = history.length - 1; i >= 0; i--) this.insertHistoryLine(history[i], body);
		for (let track of trackList) this.insertTrackLine(track.track.name, track.track.uri, body, [], track.tlid);
		let uris = trackList.map((tl) => tl.track.uri);
		uris = [...uris, ...history.map((h) => h.ref.uri)];
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
		let currentTrack = await playerState_default().getController().getCurrertTrackInfoCached();
		if (!currentTrack) return;
		if (currentTrack.type == "none") return;
		let currentUri = currentTrack.track.uri;
		let trs = [...timelineTable.querySelectorAll(`tr[data-uri="${currentUri}"]`)];
		if (trs.length == 0) return;
		let tr = trs[trs.length - 1];
		if (this.clickedRow?.dataset?.uri != currentTrack.track.uri) tr.scrollIntoView({ block: "nearest" });
		timelineTable.querySelectorAll("tr").forEach((tr$1) => tr$1.classList.remove("current", "textGlow"));
		tr.classList.add("current", "textGlow");
	}
	insertHistoryLine(line, body) {
		let title = line.ref.name.split(" - ").pop();
		this.insertTrackLine(title, line.ref.uri, body, ["historyLine"]);
	}
	insertTrackLine(title, uri, body, classes = [], tlid) {
		let tr = document.createElement("tr");
		body.appendChild(tr);
		tr.classList.add("trackLine", ...classes);
		tr.dataset.uri = uri;
		if (tlid) tr.dataset.tlid = tlid.toString();
		this.setTrackLineContent(tr, title);
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
				artist = track.track.artists[0].name;
				album = track.track.album.name;
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
	img = "";
	albumClickEvent;
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
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    min-width: 200px;
                    min-height: 200px;
                    background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
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
                }
                #wrapper.front {
                    #back {
                        display: none;
                    }                
                }
                .info {
                    font-size: .7em;
                }
                ebo-album-tracks-view {
                    height: 100%;
                }
            </style>
        `;
	static htmlText = `
            <div id="wrapper" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="image" style="visibility: hidden" src="" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
            </div>        
        `;
	constructor() {
		super(EboBigTrackComp.styleText, EboBigTrackComp.htmlText);
		this.albumClickEvent = new CustomEvent("albumClick", {
			bubbles: true,
			cancelable: false,
			composed: true,
			detail: "todo: tadaaa!"
		});
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboBigTrackComp.progressBarAttributes.includes(name)) {
			this[name] = newValue;
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
				this.updateBoolAtrribute(newValue, name);
				break;
		}
		this.requestRender();
	}
	render(shadow) {
		[
			"name",
			"stream_lines",
			"extra"
		].forEach((attName) => {
			shadow.getElementById(attName).innerHTML = this[attName];
		});
		let progressBarElement = shadow.querySelector("ebo-progressbar");
		EboBigTrackComp.progressBarAttributes.forEach((attName) => {
			progressBarElement.setAttribute(attName, this[attName]);
		});
		let img = shadow.getElementById("image");
		img.src = this.img;
		this.addShadowEventListener("image", "click", (ev) => {
			this.dispatchEvent(this.albumClickEvent);
		});
		this.requestUpdate();
	}
	update(shadow) {
		if (this.albumInfo.type == AlbumDataType.Loaded) shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
		let img = shadow.getElementById("image");
		if (this.img != "") {
			img.style.visibility = "";
			img.src = this.img;
		} else img.style.visibility = "hidden";
	}
};

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
	uri;
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
		let track = await playerState_default().getController().getExpandedTrackModel(uri);
		this.setComponentData(track);
	}
	setComponentData(track) {
		let name = "no current track";
		let info = "";
		let position;
		let button;
		let imageUrl;
		if (isInstanceOfExpandedStreamModel(track)) {
			name = track.stream.name;
			position = "100";
			button = "false";
			imageUrl = track.stream.imageUrl;
		} else {
			name = track.track.title;
			info = track.album.albumInfo.name;
			position = "60";
			button = "true";
			imageUrl = track.album.imageUrl;
			let artists = track.track.track.artists.map((a) => a.name).join(", ");
			let composers = track.track.track.composers?.map((c) => c.name)?.join(", ") ?? "";
			if (artists) info += "<br>" + artists;
			if (composers) info += "<br>" + composers;
		}
		let comp = document.getElementById(this.componentId);
		comp.setAttribute("name", name);
		comp.setAttribute("info", info);
		comp.setAttribute("position", position);
		comp.setAttribute("button", button);
		comp.setAttribute("img", imageUrl);
		this.onStreamLinesChanged();
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboAlbumTracksComp.ts
var EboAlbumTracksComp = class EboAlbumTracksComp extends EboComponent {
	_streamInfo;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.requestRender();
	}
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
	_albumInfo;
	constructor() {
		super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);
		this.albumInfo = void 0;
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
			tdData.innerText = track.track.name;
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
		if (this.streamInfo) this.streamInfo.historyLines.forEach((lineGroup) => {
			let td = tbody.appendChild(document.createElement("tr")).appendChild(document.createElement("td"));
			td.innerHTML = lineGroup.join("<br>");
			td.classList.add("selectable");
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
//#region mopidy_eboplayer2/www/typescript/views/mainView.ts
var MainView = class extends View {
	bind() {
		document.getElementById("headerSearchBtn").addEventListener("click", () => {
			this.onBrowseButtonClick();
		});
		let browseComp = document.getElementById("browseView");
		browseComp.addEboEventListener("browseFilterChanged.eboplayer", () => {
			playerState_default().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
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
		playerState_default().getModel().addEboEventListener("refsFiltered.eboplayer", () => {
			this.onRefsFiltered();
		});
		playerState_default().getModel().addEboEventListener("breadCrumbsChanged.eboplayer", () => {
			this.onBreadCrumbsChanged();
		});
		playerState_default().getModel().addEboEventListener("browseFilterChanged.eboplayer", () => {
			this.onBrowseFilterChanged();
		});
		playerState_default().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
			await this.onSelectedTrackChanged();
		});
		playerState_default().getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
			await this.onTrackListChanged();
		});
		playerState_default().getModel().addEboEventListener("viewChanged.eboplayer", () => {
			this.setCurrentView();
		});
		playerState_default().getModel().addEboEventListener("albumToViewChanged.eboplayer", async () => {
			await this.onAlbumToViewChanged();
		});
		document.getElementById("currentTrackBigView").addEventListener("albumClick", async () => {
			this.onAlbumClick();
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
	}
	onRefsFiltered() {
		let browseComp = document.getElementById("browseView");
		browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? {
			refs: [],
			availableRefTypes: /* @__PURE__ */ new Set()
		};
		browseComp.renderResults();
	}
	onBreadCrumbsChanged() {
		let browseComp = document.getElementById("browseView");
		browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs() ?? [];
	}
	onBrowseFilterChanged() {
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
	setCurrentView() {
		let view = playerState_default().getModel().getView();
		this.showView(view);
	}
	showView(view) {
		let browseBtn = document.getElementById("headerSearchBtn");
		let layout = document.getElementById("layout");
		let prevViewClass = [...layout.classList].filter((c) => [
			"browse",
			"bigAlbum",
			"bigTrack"
		].includes(c))[0];
		layout.classList.remove("browse", "bigAlbum", "bigTrack");
		switch (view) {
			case Views.Browse:
				layout.classList.add("browse");
				location.hash = Views.Browse;
				browseBtn.dataset.goto = Views.NowPlaying;
				browseBtn.title = "Now playing";
				let browseComp = document.getElementById("browseView");
				browseComp.browseFilter = playerState_default().getModel().getCurrentBrowseFilter();
				browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? {
					refs: [],
					availableRefTypes: /* @__PURE__ */ new Set()
				};
				browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs() ?? [];
				browseComp.setFocusAndSelect();
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
		}
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.TrackList];
	}
	onAlbumClick() {
		this.showView(Views.Album);
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
			if (track.type == "file") {
				let albumModel = await playerState_default().getController().getExpandedAlbumModel(track.track.album.uri);
				this.setAlbumComponentData(albumModel);
			} else {
				let albumComp = document.getElementById("bigAlbumView");
				let streamModel = await playerState_default().getController().getExpandedTrackModel(track.track.uri);
				albumComp.albumInfo = void 0;
				albumComp.streamInfo = streamModel;
				albumComp.setAttribute("img", streamModel.stream.imageUrl);
				albumComp.setAttribute("name", streamModel.stream.name);
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
		albumComp.streamInfo = void 0;
		albumComp.setAttribute("img", albumModel.album.imageUrl);
		albumComp.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
		albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
	}
	async onPlayItemListClick(detail) {
		if (detail.source == "albumView") {
			let albumUri = playerState_default().getModel().getAlbumToView();
			let album = (await playerState_default().getController().lookupAlbumsCached([albumUri]))[0];
			await playerState_default().getPlayer().clearAndPlay([album.albumInfo.uri]);
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
		if (!isInstanceOfExpandedStreamModel(trackModel)) {
			let text = await (await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri)).text();
			console_yellow(text);
		}
	}
	async onSaveClicked(detail) {
		if (detail.source == "albumView") {}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboBrowseComp.ts
var EboBrowseComp = class EboBrowseComp extends EboComponent {
	static tagName = "ebo-browse-view";
	static listSource = "browseView";
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
	}
	_results = EmptySearchResults;
	get browseFilter() {
		return this._browseFilter;
	}
	set browseFilter(value) {
		if (JSON.stringify(this._browseFilter) == JSON.stringify(value)) return;
		this._browseFilter = value;
		this.requestRender();
	}
	_browseFilter;
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
                display: flex;
                flex-direction: row;
                & input {
                    flex-grow: 1;
                    background-color: transparent;
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
                width: 2em;
                height: 2em;
                object-fit: contain;
                margin-right: .5em;
            }
            #searchResultsTable {
                width: 100%;
                border-collapse: collapse;
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
            #searchResults {
                height: 100%;
                display: flex;
                flex-direction: column;
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
        </style>
        `;
	static htmlText = `
<div id="wrapper">
    <div id="breadCrumbs"></div>
    <div id="filterBox">
        <div id="searchBox">
            <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIconFilter"></button>
            <input id="searchText" type="text" autofocus>
        </div>
        <div id="filterButtons">
            <ebo-button id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIconFilter"></ebo-button>
            <ebo-button id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIconFilter"></ebo-button>
            <ebo-button id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIconFilter"></ebo-button>
            <ebo-button id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIconFilter"></ebo-button>
            <ebo-button id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIconFilter"></ebo-button>
            <ebo-button id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIconFilter"></ebo-button>
            <button> ALL </button>
            <button> &nbsp;&nbsp;(?) </button>
        </div>
    </div>    
    <div id="searchResults">
        <ebo-list-button-bar list_source="${this.listSource}"></ebo-list-button-bar>
        <div id="searchInfo">
        </div>  
        <div id="tableWrapper" class="">
            <table id="searchResultsTable">
                <colgroup>
                    <col span="1" style="width: auto;">
                    <col span="1" style="width: 1em;">
                </colgroup>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>        
        `;
	constructor() {
		super(EboBrowseComp.styleText, EboBrowseComp.htmlText);
		this.browseFilterChangedEvent = new CustomEvent("browseFilterChanged", {
			bubbles: true,
			cancelable: false,
			composed: true,
			detail: "todo"
		});
		this._browseFilter = new BrowseFilter();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "name":
			case "stream_lines":
			case "extra":
				this[name] = newValue;
				break;
			case "enabled":
			case "show_back":
				this.updateBoolAtrribute(newValue, name);
				break;
		}
		this.requestRender();
	}
	onConnected() {}
	setFocusAndSelect() {
		let searchText = this.getShadow().getElementById("searchText");
		searchText?.focus();
		searchText?.select();
	}
	render(shadow) {
		shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {});
		this.renderBrowseFilter(shadow);
		this.renderBreadCrumbs();
		this.renderResults();
		this.requestUpdate();
	}
	renderBrowseFilter(shadow) {
		let inputElement = shadow.getElementById("searchText");
		inputElement.addEventListener("keyup", (ev) => {
			this._browseFilter.searchText = inputElement.value;
			this.dispatchEvent(this.browseFilterChangedEvent);
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
		this.dispatchEboEvent("browseFilterChanged.eboplayer", {});
	}
	update(shadow) {
		[...shadow.querySelectorAll("ebo-button")].filter((el) => el.id.startsWith("filter")).forEach((btn) => this.updateFilterButton(btn));
		let inputElement = shadow.getElementById("searchText");
		inputElement.value = this._browseFilter.searchText;
	}
	updateFilterButton(btn) {
		let propName = btn.id.replace("filter", "").charAt(0).toLowerCase() + btn.id.replace("filter", "").slice(1);
		btn.setAttribute("pressed", this._browseFilter[propName].toString());
		if (this.results) btn.setAttribute("disabled", (!this.results.availableRefTypes.has(propName)).toString());
	}
	setSearchInfo(text) {
		let searchInfo = this.getShadow().getElementById("searchInfo");
		if (searchInfo) searchInfo.innerHTML = text;
	}
	renderBreadCrumbs() {
		if (!this.rendered) return;
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
		return assertUnreachable(crumb);
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
	renderResults() {
		if (!this.rendered) return;
		this.setSearchInfo("");
		let body = this.getShadow().getElementById("searchResultsTable").tBodies[0];
		body.innerHTML = "";
		if (this.results.refs.length == 0) return;
		body.innerHTML = this.results.refs.map((result) => {
			let refType = result.ref.type;
			return `
                    <tr data-uri="${result.ref.ref.uri}" data-type="${refType}">
                    <td>${result.ref.ref.name}</td>
                    <td>...</td>
                    </tr>`;
		}).join("\n");
		body.querySelectorAll("tr").forEach((tr) => {
			tr.addEventListener("dblclick", (ev) => {
				this.onRowDoubleClicked(ev).then((r) => {});
			});
			tr.addEventListener("click", (ev) => {
				this.onRowClicked(ev);
			});
		});
		this.requestUpdate();
	}
	onRowClicked(ev) {
		let row = ev.currentTarget;
		this.dispatchEboEvent("browseResultClick.eboplayer", {
			"label": row.cells[0].innerText,
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
		this.activeTimer = void 0;
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
	static styleText = `
        <style>
            img {
                width: 100%;
                opacity: 0.5;
                &.pressed { 
                    opacity: 1; 
                    &.disabled { 
                        opacity: .2; /*if needed, set this too a lower value then when disabled+not pressed. */
                    }
                }
                &.disabled { 
                    opacity: .2; 
                }
            }
        </style>
    `;
	static htmlText = `
        <button>
            <img id="image" src="" alt="Button image">
        </button>
        `;
	constructor() {
		super(EboButton.styleText, EboButton.htmlText);
		this.pressTimer = new MouseTimer(this, (source) => this.onClick(source), (source, clickCount) => this.onMultiClick(source, clickCount), (source) => this.onFilterButtonTimeOut(source));
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "img":
				this[name] = newValue;
				break;
			case "pressed":
			case "disabled":
				this.updateBoolAtrribute(newValue, name);
				break;
		}
		this.requestRender();
	}
	render(shadow) {
		let imgTag = shadow.getElementById("image");
		this.setClassFromBoolAttribute(imgTag, "pressed");
		this.setClassFromBoolAttribute(imgTag, "disabled");
		imgTag.src = this.img ?? "";
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
	}
	onClick(eboButton) {
		if (this.disabled) return;
		let button = this.getShadow().querySelector("button");
		this.pressed = !this.pressed;
		this.setClassFromBoolAttribute(button, "pressed");
		this.setAttribute("pressed", this.pressed.toString());
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
	_streamInfo;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
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
	_albumInfo;
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
                    width: 90vw;
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
                        position: absolute;
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
            </style>
        `;
	static list_source = "albumView";
	static htmlText = `
            <div id="wrapper" class="front">
                <div id="top">
                    <div class="albumCoverContainer">
                        <img id="image" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                    <ebo-list-button-bar list_source="${this.list_source}"></ebo-list-button-bar>
                </div>
                <div id="bottom">
                    <div id="albumTableWrapper">
                        <ebo-album-tracks-view img="" ></ebo-album-tracks-view>
                    </div>
                </div>
            </div>        
        `;
	constructor() {
		super(EboBigAlbumComp.styleText, EboBigAlbumComp.htmlText);
		this.albumInfo = void 0;
		this.albumClickEvent = new CustomEvent("albumClick", {
			bubbles: true,
			cancelable: false,
			composed: true,
			detail: "todo: tadaaa!"
		});
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboBigAlbumComp.progressBarAttributes.includes(name)) {
			this[name] = newValue;
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
		tracksComp.streamInfo = this.streamInfo;
		let img = shadow.getElementById("image");
		if (this.img != "") {
			img.style.visibility = "";
			img.src = this.img;
		} else img.style.visibility = "hidden";
	}
	render(shadow) {}
	onActiveTrackChanged() {
		let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view");
		tracksComp.activeTrackUri = this.activeTrackUri;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboButtonBarComp.ts
var EboButtonBar = class EboButtonBar extends EboComponent {
	static tagName = "ebo-button-bar";
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
		super(EboButtonBar.styleText, EboButtonBar.htmlText);
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
				this.updateBoolAtrribute(newValue, name);
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
			switch (btnPlay.querySelector("i").title) {
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
		let btnPlayIcon = this.getShadow().getElementById("btnPlay").querySelector("i");
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
//#region mopidy_eboplayer2/www/typescript/components/eboListButtonBar.ts
var EboListButtonBar = class EboListButtonBar extends EboComponent {
	static tagName = "ebo-list-button-bar";
	static observedAttributes = [
		"show_add_btn",
		"show_play_btn",
		"list_source"
	];
	show_add_btn;
	show_play_btn;
	list_source;
	static styleText = `
        <style>
            #buttons {
                display: flex;
                flex-direction: row;
                margin-bottom: .5em;
            }
        </style>
    `;
	static htmlText = `
        <div id="buttons">
            <button id="btnPlay" class="roundBorder"><i class="fa fa-play"></i></button>
            <button id="btnAdd" class="roundBorder"><i class="fa fa-plus"></i></button>
            <button id="btnReplace" class="roundBorder">Replace</button>
            <button id="btnEdit" class="roundBorder"><i class="fa fa-pencil"></i></button>
            <button id="btnSave" class="roundBorder"><i class="fa fa-save"></i></button>
        </div>                   
    `;
	constructor() {
		super(EboListButtonBar.styleText, EboListButtonBar.htmlText);
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "show_add_btn":
			case "show_play_btn":
				this.updateBoolAtrribute(newValue, name);
				break;
			case "list_source":
				this.list_source = newValue;
				break;
		}
		this.requestRender();
	}
	render(shadow) {
		this.addShadowEventListener("btnPlay", "click", (ev) => {
			this.dispatchEboEvent("playItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnAdd", "click", (ev) => {
			this.dispatchEboEvent("addItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnReplace", "click", (ev) => {
			this.dispatchEboEvent("replaceItemListClicked.eboplayer", { source: this.list_source });
		});
		this.addShadowEventListener("btnSave", "click", (ev) => {
			this.dispatchEboEvent("saveClicked.eboplayer", {
				source: this.list_source,
				uri: this.dataset.uri
			});
		});
		this.requestUpdate();
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
		let trackList = numberedDictToArray(tracks);
		this.model.setTrackList(trackList);
		return trackList;
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
		return await this.commands.core.tracklist.add(null, null, uris);
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
		let historyObject = await this.commands.core.history.getHistory();
		let historyLines = numberedDictToArray(historyObject, (line) => {
			return {
				timestamp: line["0"],
				ref: line["1"]
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
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/gui.ts
function getWebSocketUrl() {
	let webSocketUrl = document.body.dataset.websocketUrl;
	if (webSocketUrl.startsWith("{{")) webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;
	return webSocketUrl;
}
document.addEventListener("DOMContentLoaded", function() {
	Promise.all([fetch(`${rootDir}css/global.css`).then((res) => res.text()), fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then((res) => res.text())]).then((texts) => {
		EboComponent.setGlobalCss(texts);
		EboComponent.define(EboProgressBar);
		EboComponent.define(EboBigTrackComp);
		EboComponent.define(EboAlbumTracksComp);
		EboComponent.define(EboBrowseComp);
		EboComponent.define(EboButton);
		EboComponent.define(EboBigAlbumComp);
		EboComponent.define(EboButtonBar);
		EboComponent.define(EboMenuButton);
		EboComponent.define(EboListButtonBar);
		setupStuff();
	});
});
function setupStuff() {
	let connectOptions = {
		webSocketUrl: getWebSocketUrl(),
		autoConnect: false
	};
	let mopidy = new Mopidy(connectOptions);
	let eboWebSocketCtrl = new JsonRpcController("ws://192.168.1.111:6680/eboplayer2/ws/", 1e3, 64e3);
	let model = new Model();
	let mopidyProxy = new MopidyProxy(new Commands(mopidy));
	let player = new PlayController(model, mopidyProxy);
	let controller = new Controller(model, mopidy, eboWebSocketCtrl, mopidyProxy, player);
	controller.initSocketevents();
	let state$1 = new State(mopidy, model, controller, player);
	setState(state$1);
	let mainView = new MainView();
	let headerView = new HeaderView();
	let currentTrackView = new BigTrackViewCurrentOrSelectedAdapter("currentTrackBigView");
	let buttonBarView = new ButtonBarView("buttonBar", mainView);
	let historyView = new TimelineView();
	playerState_default().addViews(mainView, headerView, currentTrackView, buttonBarView, historyView);
	if (location.hash == Views.Browse) controller.setView(Views.Browse);
	else controller.setView(Views.NowPlaying);
	mopidy.connect();
	eboWebSocketCtrl.connect();
}
let rootDir = document.location.pathname.replace("index.html", "");

//#endregion
export { getWebSocketUrl };
//# sourceMappingURL=bundle.js.map