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
//#region mopidy_eboplayer2/www/typescript/jsonRpcController.ts
function snakeToCamel(name) {
	return name.replace(/(_[a-z])/g, (match) => match.toUpperCase().replace("_", ""));
}
var JsonRpcController = class JsonRpcController extends EventEmitter {
	_pendingRequests;
	_webSocket;
	webSocketUrl;
	constructor(webSocketUrl) {
		super();
		this.webSocketUrl = webSocketUrl;
		this._pendingRequests = {};
		this._webSocket = null;
		this.hookUpEvents();
	}
	hookUpEvents() {
		this.on("websocket:close", this.cleanup);
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
		};
		this._webSocket.onmessage = (message) => {
			this.emit("websocket:incomingMessage", message);
		};
	}
	cleanup(closeEvent) {
		Object.keys(this._pendingRequests).forEach((requestId) => {
			const { reject } = this._pendingRequests[requestId];
			delete this._pendingRequests[requestId];
			const error = new ConnectionError("WebSocket closed");
			error.closeEvent = closeEvent;
			reject(error);
		});
	}
	close() {
		if (this._webSocket) this._webSocket.close();
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
		if (Object.hasOwnProperty.call(responseMessage, "result")) resolve(responseMessage.result);
		else if (Object.hasOwnProperty.call(responseMessage, "error")) {
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
	_backoffDelay;
	rpcController;
	constructor(options) {
		this._options = this._configure({
			backoffDelayMin: 1e3,
			backoffDelayMax: 64e3,
			autoConnect: true,
			webSocketUrl: "",
			...options
		});
		this._backoffDelay = this._options.backoffDelayMin;
		this.rpcController = new JsonRpcController(this._options.webSocketUrl);
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
		this.rpcController.on("websocket:close", (closeEvent) => this._cleanup(closeEvent));
		this.rpcController.on("websocket:open", () => this._resetBackoffDelay());
		this.rpcController.on("websocket:open", () => this._onWebsocketOpen());
		this.rpcController.on("state:offline", () => this._reconnect());
	}
	eventOff(eventName, callback) {
		if (!eventName) {
			this.rpcController.removeAllListeners();
			return;
		}
		if (!callback) {
			this.rpcController.removeAllListeners(eventName);
			return;
		}
		this.rpcController.removeListener(eventName, callback);
	}
	_cleanup(closeEvent) {
		this.rpcController.emit("state", "state:offline");
		this.rpcController.emit("state:offline");
	}
	_reconnect() {
		setTimeout(() => {
			this.rpcController.emit("state", ["reconnectionPending", { timeToAttempt: this._backoffDelay }]);
			this.rpcController.emit("reconnectionPending", { timeToAttempt: this._backoffDelay });
			setTimeout(() => {
				this.rpcController.emit("state", "reconnecting");
				this.rpcController.emit("reconnecting");
				this.rpcController.connect();
			}, this._backoffDelay);
			this._backoffDelay *= 2;
			if (this._backoffDelay > this._options.backoffDelayMax) this._backoffDelay = this._options.backoffDelayMax;
		}, 0);
	}
	_resetBackoffDelay() {
		this._backoffDelay = this._options.backoffDelayMin;
	}
	close() {
		this.eventOff("state:offline", this._reconnect);
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
//#region mopidy_eboplayer2/www/typescript/timer.ts
let now = function() {
	return (/* @__PURE__ */ new Date()).getTime();
};
var ProgressTimer = class {
	callback;
	fallbackTargetFrameRate = 30;
	disableRequestAnimationFrame = false;
	_updateId = null;
	_state = null;
	_schedule;
	_cancel;
	constructor(options) {
		if (typeof options === "function") this.callback = options;
		else {
			this.callback = options.callback;
			this.fallbackTargetFrameRate = options.fallbackTargetFrameRate;
			this.disableRequestAnimationFrame = options.disableRequestAnimationFrame;
		}
		this._updateId = null;
		this._state = null;
		let frameDuration = 1e3 / this.fallbackTargetFrameRate;
		let useFallback = typeof window.requestAnimationFrame === "undefined" || typeof window.cancelAnimationFrame === "undefined" || options["disableRequestAnimationFrame"] || false;
		let update = this._update.bind(this);
		if (useFallback) {
			this._schedule = function(timestamp) {
				let timeout = Math.max(timestamp + frameDuration - now(), 0);
				return window.setTimeout(update, Math.floor(timeout));
			};
			this._cancel = window.clearTimeout.bind(window);
		} else {
			this._schedule = window.requestAnimationFrame.bind(window, update);
			this._cancel = window.cancelAnimationFrame.bind(window);
		}
		this.reset();
	}
	set(position, duration = void 0) {
		if (!duration) duration = this._state.duration;
		duration = Math.floor(Math.max(duration === null ? Infinity : duration || Infinity, 0));
		position = Math.floor(Math.min(Math.max(position || 0, 0), duration));
		this._state = {
			initialTimestamp: null,
			initialPosition: position,
			position,
			duration
		};
		if (this._updateId === null) this.callback(position, duration);
		return this;
	}
	start() {
		if (this._updateId === null) this._updateId = this._schedule(0);
		return this;
	}
	stop() {
		if (this._updateId !== null) {
			this._cancel(this._updateId);
			this.set(this._state.position, this._state.duration);
			this._updateId = null;
		}
		return this;
	}
	reset() {
		return this.stop().set(0, Infinity);
	}
	_update(timestamp) {
		let state$1 = this._state;
		timestamp = timestamp || now();
		state$1.initialTimestamp = state$1.initialTimestamp || timestamp;
		state$1.position = state$1.initialPosition + timestamp - state$1.initialTimestamp;
		let userPosisition = Math.min(Math.floor(state$1.position), state$1.duration);
		this.callback(userPosisition, state$1.duration);
		this._updateId = this._schedule(timestamp);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/synced_timer.ts
var SYNC_STATE = /* @__PURE__ */ function(SYNC_STATE$1) {
	SYNC_STATE$1[SYNC_STATE$1["NOT_SYNCED"] = 0] = "NOT_SYNCED";
	SYNC_STATE$1[SYNC_STATE$1["SYNCING"] = 1] = "SYNCING";
	SYNC_STATE$1[SYNC_STATE$1["SYNCED"] = 2] = "SYNCED";
	return SYNC_STATE$1;
}(SYNC_STATE || {});
var SyncedProgressTimer = class SyncedProgressTimer {
	_maxAttempts;
	_mopidy;
	syncState = SYNC_STATE.NOT_SYNCED;
	_isSyncScheduled = false;
	_scheduleID = null;
	_syncAttemptsRemaining;
	_previousSyncPosition = null;
	_duration = null;
	_isConnected = false;
	positionNode;
	durationNode;
	_progressTimer;
	constructor(maxAttempts, mopidy) {
		this._maxAttempts = maxAttempts;
		this._mopidy = mopidy;
		this._syncAttemptsRemaining = this._maxAttempts;
		this.positionNode = document.createTextNode("");
		this.durationNode = document.createTextNode("");
		this._progressTimer = new ProgressTimer((position, duration) => {
			this.timerCallback(position, duration);
		});
	}
	static format(milliseconds) {
		if (milliseconds === Infinity) return "";
		else if (milliseconds === 0) return "0:00";
		let seconds = Math.floor(milliseconds / 1e3);
		const minutes = Math.floor(seconds / 60);
		seconds = seconds % 60;
		let secondString = seconds < 10 ? "0" + seconds : seconds.toString();
		return minutes + ":" + secondString;
	}
	timerCallback(position, duration) {
		this._update(position);
		if (this._isSyncScheduled && this._isConnected) this._doSync(position, duration);
	}
	_update(position) {
		switch (this.syncState) {
			case SYNC_STATE.NOT_SYNCED:
				this.positionNode.nodeValue = "(wait)";
				break;
			case SYNC_STATE.SYNCING:
				this.positionNode.nodeValue = "(sync)";
				break;
			case SYNC_STATE.SYNCED:
				this._previousSyncPosition = position;
				this.positionNode.nodeValue = SyncedProgressTimer.format(position);
				break;
		}
	}
	_scheduleSync(milliseconds) {
		clearTimeout(this._scheduleID);
		this._isSyncScheduled = false;
		if (milliseconds >= 0) this._scheduleID = setTimeout(() => {
			this._isSyncScheduled = true;
		}, milliseconds);
	}
	_doSync(position, duration) {}
	set(position, duration = void 0) {
		this.syncState = SYNC_STATE.NOT_SYNCED;
		this._syncAttemptsRemaining = this._maxAttempts;
		if (this._duration && this._duration < position) position = this._duration - 1;
		if (arguments.length === 1) this._progressTimer.set(position);
		else {
			this._duration = duration;
			this._progressTimer.set(position, duration);
			this.durationNode.nodeValue = SyncedProgressTimer.format(duration);
		}
		this.updatePosition(position);
		return this;
	}
	start() {
		this.syncState = SYNC_STATE.NOT_SYNCED;
		this._scheduleSync(0);
		this._progressTimer.start();
		return this;
	}
	stop() {
		this._progressTimer.stop();
		this._scheduleSync(-1);
		if (this.syncState !== SYNC_STATE.SYNCED && this._previousSyncPosition) this.positionNode.nodeValue = SyncedProgressTimer.format(this._previousSyncPosition);
		return this;
	}
	reset() {
		this.stop();
		this.set(0, Infinity);
		return this;
	}
	updatePosition(position) {
		if (!(this._duration === Infinity && position === 0)) this.positionNode.nodeValue = SyncedProgressTimer.format(position);
		else this.positionNode.nodeValue = "";
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/playerState.ts
var State = class {
	mopidy;
	syncedProgressTimer;
	play = false;
	random = false;
	repeat = false;
	consume = false;
	single = false;
	mute = false;
	positionChanging = false;
	popupData = {};
	songlength = 0;
	streamUris = {};
	playlists = {};
	customTracklists = [];
	model;
	controller;
	constructor(mopidy, syncedProgressTimer, model, controller) {
		this.mopidy = mopidy;
		this.syncedProgressTimer = syncedProgressTimer;
		this.model = model;
		this.controller = controller;
	}
	views = [];
	getModel = () => this.model;
	getController = () => this.controller;
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
		for (const dataType of requiredData) {
			await this.controller.mopidyProxy.fetchRequiredData(dataType);
			await this.controller.webProxy.fetchRequiredData(dataType);
		}
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
var BreadCrumbStack = class {
	breadCrumbStack = [];
	push(crumb) {
		this.breadCrumbStack.push(crumb);
	}
	pop() {
		return this.breadCrumbStack.pop();
	}
	list = () => this.breadCrumbStack;
	resetTo(id) {
		let index = this.breadCrumbStack.findIndex((breadCrumb, index$1, obj) => {
			return breadCrumb.id == id;
		});
		this.breadCrumbStack = this.breadCrumbStack.slice(0, index + 1);
	}
	clear() {
		this.breadCrumbStack = [];
	}
	getLast() {
		if (this.breadCrumbStack.length == 0) return void 0;
		return this.breadCrumbStack[this.breadCrumbStack.length - 1];
	}
	get(id) {
		return this.breadCrumbStack.find((crumb) => crumb.id == id);
	}
	setArray(breadCrumbsArray) {
		this.breadCrumbStack = breadCrumbsArray;
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/modelTypes.ts
let ItemType = /* @__PURE__ */ function(ItemType$1) {
	ItemType$1[ItemType$1["None"] = 0] = "None";
	ItemType$1[ItemType$1["File"] = 1] = "File";
	ItemType$1[ItemType$1["Stream"] = 2] = "Stream";
	ItemType$1[ItemType$1["Album"] = 3] = "Album";
	return ItemType$1;
}({});
var BreadCrumbBrowseFilter = class extends BreadCrumb {
	constructor(label, filter) {
		super(label, filter, "browseFilter");
	}
};
var BreadCrumbRef = class extends BreadCrumb {
	constructor(label, ref) {
		super(label, ref, "ref");
	}
};
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
};
const TrackNone = { type: ItemType.None };
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
let PlayState = /* @__PURE__ */ function(PlayState$1) {
	PlayState$1["stopped"] = "stopped";
	PlayState$1["playing"] = "playing";
	PlayState$1["paused"] = "paused";
	PlayState$1["unknown"] = "unknown";
	return PlayState$1;
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
let EboplayerEvents = /* @__PURE__ */ function(EboplayerEvents$1) {
	EboplayerEvents$1["volumeChanged"] = "eboplayer.volumeChanged";
	EboplayerEvents$1["connectionChanged"] = "eboplayer.connectionChanged";
	EboplayerEvents$1["playStateChanged"] = "eboplayer.playbackStateChanged";
	EboplayerEvents$1["messageChanged"] = "eboplayer.messageChanged";
	EboplayerEvents$1["currentTrackChanged"] = "eboplayer.currentTrackChanged";
	EboplayerEvents$1["selectedTrackChanged"] = "eboplayer.selectedTrackChanged";
	EboplayerEvents$1["activeStreamLinesChanged"] = "eboplayer.activeStreamLinesChanged";
	EboplayerEvents$1["historyChanged"] = "eboplayer.historyChanged";
	EboplayerEvents$1["trackListChanged"] = "eboplayer.trackListChanged";
	EboplayerEvents$1["browseFilterChanged"] = "eboplayer.browseFilterChanged";
	EboplayerEvents$1["currentRefsLoaded"] = "eboplayer.currentRefsLoaded";
	EboplayerEvents$1["refsFiltered"] = "eboplayer.refsFiltered";
	EboplayerEvents$1["longPress"] = "eboplayer.longPress";
	EboplayerEvents$1["breadCrumbsChanged"] = "eboplayer.breadCrumbsChanged";
	EboplayerEvents$1["playPressed"] = "eboplayer.playPressed";
	EboplayerEvents$1["pausePressed"] = "eboplayer.pausePressed";
	EboplayerEvents$1["stopPressed"] = "eboplayer.stopPressed";
	EboplayerEvents$1["changingVolume"] = "eboplayer.changingVolume";
	EboplayerEvents$1["viewChanged"] = "eboplayer.viewChanged";
	EboplayerEvents$1["albumToViewChanged"] = "eboplayer.albumToViewChanged";
	EboplayerEvents$1["albumClicked"] = "eboplayer.albumClicked";
	EboplayerEvents$1["currentImageSet"] = "eboplayer.currentImageSet";
	EboplayerEvents$1["playAlbumClicked"] = "eboplayer.playAlbumClicked";
	EboplayerEvents$1["addAlbumClicked"] = "eboplayer.addAlbumClicked";
	EboplayerEvents$1["browseResultDblClick"] = "eboplayer.browseResultDblClick";
	EboplayerEvents$1["browseResultClick"] = "eboplayer.browseResultClick";
	EboplayerEvents$1["breadCrumbClick"] = "eboplayer.breadCrumbClick";
	EboplayerEvents$1["playTrackClicked"] = "eboplayer.playTrackClicked";
	EboplayerEvents$1["addTrackClicked"] = "eboplayer.addTrackClicked";
	return EboplayerEvents$1;
}({});
var EboplayerEvent = class extends CustomEvent {
	constructor(event, detail) {
		super(event, {
			detail,
			bubbles: true,
			composed: true,
			cancelable: true
		});
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/model.ts
var Model = class extends EventTarget {
	static NoTrack = { type: ItemType.None };
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
	playState = PlayState.unknown;
	activeStreamLines;
	history;
	trackList = [];
	libraryCache = /* @__PURE__ */ new Map();
	currentBrowseFilter = new BrowseFilter();
	filterBreadCrumbStack = new BreadCrumbStack();
	allRefs;
	currentRefs;
	view = Views.NowPlaying;
	albumToViewUri;
	currentImage;
	constructor() {
		super();
	}
	pushBreadCrumb(crumb) {
		this.filterBreadCrumbStack.push(crumb);
		this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
	}
	popBreadCrumb() {
		let crumb = this.filterBreadCrumbStack.pop();
		this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
		return crumb;
	}
	getBreadCrumbs = () => this.filterBreadCrumbStack;
	resetBreadCrumbsTo(id) {
		this.filterBreadCrumbStack.resetTo(id);
		this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
	}
	clearBreadCrumbs() {
		this.filterBreadCrumbStack.clear();
		this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
	}
	setAllRefs(refs) {
		this.allRefs = refs;
	}
	getCurrentSearchResults() {
		return this.currentRefs?.getSearchResults() ?? [];
	}
	getAllRefs = () => this.allRefs;
	filterCurrentRefs() {
		if (!this.currentRefs) return;
		this.currentRefs.browseFilter = this.currentBrowseFilter;
		this.currentRefs.filter();
		this.dispatchEvent(new Event(EboplayerEvents.refsFiltered));
	}
	setConnectionState(state$1) {
		this.connectionState = state$1;
		if (this.connectionState == ConnectionState.Online) this.clearMessage();
		else this.setErrorMessage("Offline");
		this.dispatchEvent(new Event(EboplayerEvents.connectionChanged));
	}
	getConnectionState = () => this.connectionState;
	getCachedInfo(uri) {
		return this.libraryCache.get(uri);
	}
	getCurrentBrowseFilter = () => this.currentBrowseFilter;
	setCurrentBrowseFilter(browseFilter) {
		this.currentBrowseFilter = browseFilter;
		this.dispatchEvent(new Event(EboplayerEvents.browseFilterChanged));
	}
	setBrowseFilterBreadCrumbs(breadCrumbStack) {
		this.filterBreadCrumbStack = breadCrumbStack;
		this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
	}
	getCurrentTrack() {
		return this.currentTrack;
	}
	setCurrentTrack(track) {
		if (track.type == ItemType.None) {
			this.currentTrack = void 0;
			return;
		}
		this.currentTrack = track.track.uri;
		this.addToLibraryCache(this.currentTrack, track);
		this.dispatchEvent(new Event(EboplayerEvents.currentTrackChanged));
	}
	getSelectedTrack = () => this.selectedTrack;
	setSelectedTrack(uri) {
		if (uri == "") this.selectedTrack = void 0;
		else this.selectedTrack = uri;
		this.dispatchEvent(new Event(EboplayerEvents.selectedTrackChanged));
	}
	setVolume(volume) {
		this.volume = volume;
		this.dispatchEvent(new Event(EboplayerEvents.volumeChanged));
	}
	setMessage(message) {
		this.currentMessage = message;
		this.dispatchEvent(new Event(EboplayerEvents.messageChanged));
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
		this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
	}
	getVolume = () => this.volume;
	getPlayState() {
		return this.playState;
	}
	setPlayState(state$1) {
		this.playState = state$1;
		this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
	}
	setActiveStreamLinesHistory(streamTitles) {
		if (!streamTitles) return;
		streamTitles.active_titles = Object.values(streamTitles.active_titles);
		this.activeStreamLines = streamTitles;
		this.dispatchEvent(new Event(EboplayerEvents.activeStreamLinesChanged));
	}
	getActiveStreamLines = () => this.activeStreamLines;
	setHistory(history) {
		this.history = history;
		this.dispatchEvent(new Event(EboplayerEvents.historyChanged));
	}
	getHistory = () => this.history;
	setTrackList(trackList) {
		this.trackList = trackList;
		this.dispatchEvent(new Event(EboplayerEvents.trackListChanged));
	}
	getTrackList = () => this.trackList;
	addToLibraryCache(uri, item) {
		if (!this.libraryCache.has(uri)) this.libraryCache.set(uri, item);
	}
	updateLibraryCache(uri, item) {
		this.libraryCache.set(uri, item);
	}
	addItemsToLibraryCache(items) {
		for (let item of items) if (item.type == ItemType.Album) this.updateLibraryCache(item.albumInfo.uri, item);
		else this.updateLibraryCache(item.track.uri, item);
	}
	getFromCache(uri) {
		return this.libraryCache.get(uri);
	}
	setCurrentRefs(refs) {
		this.currentRefs = refs;
		this.dispatchEvent(new Event(EboplayerEvents.currentRefsLoaded));
	}
	setView(view) {
		this.view = view;
		this.dispatchEvent(new Event(EboplayerEvents.viewChanged));
	}
	getView = () => this.view;
	setAlbumToView(uri) {
		this.albumToViewUri = uri;
		this.dispatchEvent(new Event(EboplayerEvents.albumToViewChanged));
	}
	getAlbumToView = () => this.albumToViewUri;
	setCurrentImage(uri) {
		this.currentImage = uri;
		this.dispatchEvent(new Event(EboplayerEvents.currentImageSet));
	}
	getCurrentImage = () => this.currentImage;
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
	EboPlayerDataType$1[EboPlayerDataType$1["StreamLines"] = 3] = "StreamLines";
	EboPlayerDataType$1[EboPlayerDataType$1["TrackList"] = 4] = "TrackList";
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
		playerState_default().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
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
//#region mopidy_eboplayer2/www/typescript/functionsvars.ts
const HOSTNAME = document.body.dataset.hostname;
/** ****************
* Modal dialogs  *
******************/
function showLoading(on) {}
function validUri(uri) {
	return /^(http|https|mms|rtmp|rtmps|rtsp):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/.test(uri);
}
function jsonParse(data, defaultValue) {
	try {
		return JSON.parse(data);
	} catch (e) {
		console.error(e);
		return defaultValue;
	}
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/library.ts
let library = {
	searchPressed: function(key) {
		return true;
	},
	initSearch: function() {},
	processSearchResults: function(resultArr) {},
	getPlaylists: function() {},
	getBrowseDir: function(rootdir) {},
	togglePlaylists: function() {
		return true;
	},
	showTracklist: function(uri) {
		return false;
	},
	showArtist: function(nwuri, mopidy) {
		return false;
	},
	showAlbum: function(uri, mopidy) {},
	getSearchSchemes: function(searchBlacklist, mopidy) {}
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
	let length = dict["length"];
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
	return track?.track_no == void 0;
}
function transformTrackDataToModel(track) {
	if (isStream(track)) return {
		type: ItemType.Stream,
		track,
		name: track.name,
		infoLines: [],
		imageUrl: void 0
	};
	let model = {
		type: ItemType.File,
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
	if (validUri(track.name)) for (let key in playerState_default().streamUris) {
		let rs = playerState_default().streamUris[key];
		if (rs && rs[1] === track.name) model.title = rs[0] || rs[1];
	}
	if (!track.length || track.length === 0) model.songlenght = playerState_default().songlength = Infinity;
	else model.songlenght = playerState_default().songlength = track.length;
	return model;
}
function console_yellow(msg) {
	console.log(`%c${msg}`, "background-color: yellow");
}

//#endregion
//#region mopidy_eboplayer2/www/typescript/process_ws.ts
function transformTlTrackDataToModel(tlTrack) {
	return transformTrackDataToModel(tlTrack?.track);
}

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
//#region mopidy_eboplayer2/www/typescript/proxies/mopidyProxy.ts
var MopidyProxy = class {
	controller;
	model;
	commands;
	constructor(controller, model, commands) {
		this.controller = controller;
		this.model = model;
		this.commands = commands;
	}
	async fetchRootDirs() {
		return this.browse(null);
	}
	async fetchTracksforArtist() {
		return await this.commands.core.library.search({ artist: ["Sting"] }, null);
	}
	async playTracklistItem(tlid) {
		await this.commands.core.playback.play(null, tlid);
	}
	async addTrackToTracklist(uri) {
		return await this.commands.core.tracklist.add(null, null, [uri]);
	}
	async clearTrackList() {
		await this.commands.core.tracklist.clear();
	}
	async browse(uri) {
		return await this.commands.core.library.browse(uri);
	}
	async sendVolume(value) {
		await this.commands.core.mixer.setVolume(value);
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
	async fetchRequiredData(dataType) {
		switch (dataType) {
			case EboPlayerDataType.Volume:
				let volume = await this.commands.core.mixer.getVolume();
				this.controller.setVolume(volume);
				break;
			case EboPlayerDataType.CurrentTrack:
				let track = await this.commands.core.playback.getCurrentTlTrack();
				await this.controller.setCurrentTrackAndFetchDetails(track);
				break;
			case EboPlayerDataType.PlayState:
				let state$1 = await this.commands.core.playback.getState();
				this.controller.setPlayState(state$1);
				break;
			case EboPlayerDataType.TrackList:
				await this.fetchTracklistAndDetails();
				break;
		}
	}
	async fetchTracks(uris) {
		if (typeof uris == "string") uris = [uris];
		return await this.commands.core.library.lookup(uris);
	}
	async fetchTracklistAndDetails() {
		let tracks = await this.commands.core.tracklist.getTlTracks();
		this.model.setTrackList(tracks);
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
		let dedupLines = filtered.filter((line) => {
			if (line.ref.uri == prev.ref.uri) return false;
			prev = line;
			return true;
		});
		this.model.setHistory(dedupLines);
	}
	fetchPlaybackOptions() {
		let promises = [
			this.commands.core.tracklist.getRepeat(),
			this.commands.core.tracklist.getRandom(),
			this.commands.core.tracklist.getConsume(),
			this.commands.core.tracklist.getSingle()
		];
		Promise.all(promises).then((results) => {
			this.model.setPlaybackState({
				repeat: results[0],
				random: results[1],
				consume: results[2],
				single: results[3]
			});
		});
	}
	async fetchCurrentTrackAndDetails() {
		let currentTrack = await this.commands.core.playback.getCurrentTlTrack();
		await this.controller.setCurrentTrackAndFetchDetails(currentTrack);
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
};

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
			let breadCrumbsArray = jsonParse(breadCrumbsString, this.model.getBreadCrumbs().list());
			let breadCrumbs = new BreadCrumbStack();
			breadCrumbsArray.map((crumb) => {
				switch (crumb.type) {
					case "browseFilter":
						let browseFilter = new BrowseFilter();
						Object.assign(browseFilter, crumb.data);
						return new BreadCrumbBrowseFilter(crumb.label, browseFilter);
					case "ref": return new BreadCrumbRef(crumb.label, crumb.data);
				}
			}).forEach((crumb) => breadCrumbs.push(crumb));
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
		let obj = JSON.stringify(breadCrumbs.list());
		console.log(obj);
		localStorage.setItem(BROWSE_FILTERS_BREADCRUMBS_KEY, obj);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/refs.ts
var Refs = class {
	searchResults;
	get browseFilter() {
		return this._browseFilter;
	}
	constructor() {
		this.searchResults = [];
	}
	set browseFilter(value) {
		this._browseFilter = value;
	}
	_browseFilter;
	calculateWeight(result, browseFilter) {
		if (result.ref.name.toLowerCase().startsWith(browseFilter.searchText.toLowerCase())) result.weight += 100;
		if (result.ref.name.toLowerCase().includes(browseFilter.searchText.toLowerCase())) result.weight += 100;
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
			if (b.weight === a.weight) return a.ref.name.localeCompare(b.ref.name);
			return b.weight - a.weight;
		});
	}
	getSearchResults() {
		return this.searchResults;
	}
};
var AllRefs = class extends Refs {
	roots;
	sub;
	tracks;
	albums;
	artists;
	genres;
	radioStreams;
	playlists;
	constructor(roots, sub, tracks, albums, artists, genres, radioStreams, playlists) {
		super();
		this.roots = roots;
		this.sub = sub;
		this.tracks = tracks;
		this.albums = albums;
		this.artists = artists;
		this.genres = genres;
		this.radioStreams = radioStreams;
		this.playlists = playlists;
	}
	filter() {
		this.prefillWithTypes(this.browseFilter);
		this.searchResults = this.applyFilter(this.searchResults);
	}
	prefillWithTypes(browseFilter) {
		this.searchResults = [];
		if (browseFilter.album || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.albums.map((album) => ({
			ref: album,
			weight: 0
		})));
		if (browseFilter.artist || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.artists.map((artist) => ({
			ref: artist,
			weight: 0
		})));
		if (browseFilter.track || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.tracks.map((track) => ({
			ref: track,
			weight: 0
		})));
		if (browseFilter.genre || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.genres.map((track) => ({
			ref: track,
			weight: 0
		})));
		if (browseFilter.radio || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.radioStreams.map((track) => ({
			ref: track,
			weight: 0
		})));
		if (browseFilter.playlist || browseFilter.isNoTypeSelected()) this.searchResults.push(...this.playlists.map((track) => ({
			ref: track,
			weight: 0
		})));
	}
};
var SomeRefs = class extends Refs {
	refs;
	constructor(refs) {
		super();
		this.refs = refs;
	}
	filter() {
		this.searchResults = this.refs.map((ref) => ({
			ref,
			weight: 0
		}));
		this.searchResults = this.applyFilter(this.searchResults);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/proxies/webProxy.ts
var WebProxy = class {
	model;
	constructor(model) {
		this.model = model;
	}
	async fetchRequiredData(dataType) {
		switch (dataType) {
			case EboPlayerDataType.StreamLines:
				await this.fetchActiveStreamLines();
				break;
		}
	}
	async fetchActiveStreamLines() {
		if (!this.model.currentTrack) {
			this.model.setActiveStreamLinesHistory(NoStreamTitles);
			return;
		}
		let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/activeLines`);
		url.searchParams.set("uri", this.model.currentTrack);
		let lines = await (await fetch(url)).json();
		this.model.setActiveStreamLinesHistory(lines);
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
//#region mopidy_eboplayer2/www/typescript/controller.ts
const LIBRARY_PROTOCOL = "eboback:";
var Controller = class extends Commands {
	model;
	mopidyProxy;
	webProxy;
	localStorageProxy;
	eboWebSocketCtrl;
	baseUrl;
	DEFAULT_IMG_URL = "images/default_cover.png";
	constructor(model, mopidy, eboWebSocketCtrl) {
		super(mopidy);
		this.model = model;
		this.mopidyProxy = new MopidyProxy(this, model, new Commands(mopidy));
		this.webProxy = new WebProxy(model);
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
			await this.mopidyProxy.fetchHistory();
		});
		this.mopidy.on("state:offline", () => {
			this.model.setConnectionState(ConnectionState.Offline);
		});
		this.mopidy.on("event:optionsChanged", this.mopidyProxy.fetchPlaybackOptions);
		this.mopidy.on("event:trackPlaybackStarted", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
			this.setPlayState("playing");
		});
		this.mopidy.on("event:trackPlaybackResumed", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
		});
		this.mopidy.on("event:playlistsLoaded", () => {
			/* @__PURE__ */ showLoading(true);
			library.getPlaylists();
		});
		this.mopidy.on("event:playlistChanged", (data) => {
			delete playerState_default().playlists[data.playlist.uri];
			library.getPlaylists();
		});
		this.mopidy.on("event:playlistDeleted", (data) => {
			delete playerState_default().playlists[data.uri];
			library.getPlaylists();
		});
		this.mopidy.on("event:volumeChanged", (data) => {
			this.model.setVolume(data.volume);
		});
		this.mopidy.on("event:muteChanged", (_data) => {});
		this.mopidy.on("event:playbackStateChanged", async (data) => {
			await this.onPlaybackStateChanged(data);
		});
		this.mopidy.on("event:tracklistChanged", async () => {
			await this.mopidyProxy.fetchTracklistAndDetails();
			await this.mopidyProxy.fetchCurrentTrackAndDetails();
		});
		this.mopidy.on("event:seeked", () => {
			if (playerState_default().play) playerState_default().syncedProgressTimer.start();
		});
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
			let streamTitles = data.data;
			this.model.setActiveStreamLinesHistory(streamTitles);
		});
	}
	async onPlaybackStateChanged(data) {
		playerState_default().getController().setPlayState(data.new_state);
		await this.updateStreamLines();
	}
	async setCurrentTrackAndFetchDetails(data) {
		if (!data) {
			this.model.setCurrentTrack(TrackNone);
			return;
		}
		let trackModel = transformTlTrackDataToModel(data);
		this.model.setCurrentTrack(trackModel);
		if (!this.model.selectedTrack) this.model.setSelectedTrack(trackModel.track.uri);
		await this.updateStreamLines();
	}
	async updateStreamLines() {
		if (this.model.getPlayState() == "playing") await this.webProxy.fetchActiveStreamLines();
		else this.model.setActiveStreamLinesHistory(NoStreamTitles);
	}
	async fetchLargestImageOrDefault(uri) {
		let arr = (await this.mopidyProxy.fetchImages([uri]))[uri];
		arr.sort((img) => img.width * img.height);
		if (arr.length == 0) return this.DEFAULT_IMG_URL;
		let imageUrl = arr.pop().uri;
		if (imageUrl == "") imageUrl = this.DEFAULT_IMG_URL;
		return this.baseUrl + imageUrl;
	}
	setVolume(volume) {
		this.model.setVolume(volume);
	}
	setPlayState(state$1) {
		this.model.setPlayState(state$1);
	}
	setTracklist(trackList) {
		this.model.setTrackList(trackList);
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
			if (breadCrumb.data.type == "artist") {
				this.model.resetBreadCrumbsTo(id);
				this.model.popBreadCrumb();
				this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
			}
		}
	}
	async lookupTrackCached(trackUri) {
		let item = this.model.getFromCache(trackUri);
		if (item) return item;
		let libraryList = await this.fetchAndConvertTracks(trackUri);
		this.model.addItemsToLibraryCache(libraryList);
		return this.model.getFromCache(trackUri);
	}
	async lookupAlbumCached(albumUri) {
		let item = this.model.getFromCache(albumUri);
		if (item) return item;
		return await this.fetchAlbum(albumUri);
	}
	async fetchAlbum(albumUri) {
		let trackList = (await this.mopidyProxy.fetchTracks(albumUri))[albumUri];
		let albumModel = {
			type: ItemType.Album,
			albumInfo: trackList[0].album,
			tracks: trackList.map((track) => track.uri),
			imageUrl: await this.fetchLargestImageOrDefault(albumUri)
		};
		this.model.addItemsToLibraryCache([albumModel]);
		return albumModel;
	}
	async fetchAndConvertTracks(uri) {
		let newListPromises = (await this.mopidyProxy.fetchTracks(uri))[uri].map(async (track) => {
			let model = transformTrackDataToModel(track);
			if (model.type == ItemType.Stream) model.imageUrl = this.DEFAULT_IMG_URL;
			return model;
		});
		return await Promise.all(newListPromises);
	}
	async getExpandedTrackModel(trackUri) {
		let track = await this.lookupTrackCached(trackUri);
		if (track.type == ItemType.Stream) {
			let streamLines = await this.fetchStreamLines(trackUri);
			return {
				stream: track,
				historyLines: streamLines
			};
		} else {
			let album = await this.lookupAlbumCached(track.track.album.uri);
			return {
				track,
				album
			};
		}
	}
	async getExpandedFileTrackModel(fileTrackUri) {
		let track = await this.lookupTrackCached(fileTrackUri);
		let album = await this.lookupAlbumCached(track.track.album.uri);
		return {
			track,
			album
		};
	}
	async getExpandedAlbumModel(albumUri) {
		let album = await this.lookupAlbumCached(albumUri);
		let meta = await this.getMetaData(albumUri);
		console.log(meta);
		let tracks = await Promise.all(album.tracks.map((trackUri) => this.lookupTrackCached(trackUri)));
		return {
			album,
			tracks,
			meta
		};
	}
	async getMetaData(albumUri) {
		return this.webProxy.fetchMetaData(albumUri);
	}
	async clearListAndPlay(uri) {
		await this.mopidyProxy.clearTrackList();
		let trackList = await this.addToPlaylist(uri);
		this.play(trackList[0].tlid);
	}
	async play(tlid) {
		this.mopidyProxy.playTracklistItem(tlid);
	}
	async addToPlaylist(uri) {
		let tracks = await this.mopidyProxy.addTrackToTracklist(uri);
		let trackList = numberedDictToArray(tracks);
		this.setTracklist(trackList);
		return trackList;
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
		if (lastCrumb instanceof BreadCrumbBrowseFilter) {
			await this.setAllRefsAsCurrent();
			return;
		}
		if (lastCrumb instanceof BreadCrumbRef) {
			if (lastCrumb.data.type == "playlist") {
				let playlistItems = await this.mopidyProxy.fetchPlaylistItems(lastCrumb.data.uri);
				playlistItems.forEach((ref) => {
					ref.name = ref.uri.replace(LIBRARY_PROTOCOL + "track:", "").replaceAll("%20", " ");
					ref.name = ref.name.split(".").slice(0, -1).join(".");
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
	playUri(uri) {
		this.clearListAndPlay(uri);
	}
	addUri(uri) {
		this.addToPlaylist(uri);
	}
	async fetchAlbumDataForTrack(track) {
		switch (track.type) {
			case ItemType.File:
				let albumUri = track.track.album.uri;
				return await this.lookupAlbumCached(albumUri);
		}
	}
	async fetchStreamLines(streamUri) {
		let stream_lines = await this.webProxy.fetchAllStreamLines(streamUri);
		let groupLines = function(grouped, line) {
			if (line == "---") {
				grouped.push([]);
				return grouped;
			}
			grouped[grouped.length - 1].push(line);
			return grouped;
		};
		return stream_lines.reduce(groupLines, new Array([])).filter((lineGroup) => lineGroup.length);
	}
	setView(view) {
		this.model.setView(view);
	}
	async fetchAllAlbums() {
		let albumsPromises = (await this.mopidyProxy.browse(LIBRARY_PROTOCOL + "directory?type=album")).map(async (ref) => {
			return await this.lookupAlbumCached(ref.uri);
		});
		let albums = await Promise.all(albumsPromises);
		console.log(albums);
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
		playerState_default().getModel().addEventListener(EboplayerEvents.playStateChanged, () => {
			this.onPlaybackStateChangegd();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
			this.onCurrentTrackChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
			this.onSelectedTrackChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
			this.onActiveStreamLinesChanged();
		});
		let comp = document.getElementById(this.componentId);
		comp.addEventListener(EboplayerEvents.playPressed, () => {
			this.playOrStopOrPause(EboplayerEvents.playPressed).then((r) => {});
		});
		comp.addEventListener(EboplayerEvents.stopPressed, () => {
			this.playOrStopOrPause(EboplayerEvents.stopPressed).then((r) => {});
		});
		comp.addEventListener(EboplayerEvents.pausePressed, () => {
			this.playOrStopOrPause(EboplayerEvents.pausePressed).then((r) => {});
		});
		comp.addEventListener(EboplayerEvents.albumClicked, () => {
			this.onButtonBarImgClicked();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.volumeChanged, () => {
			this.onVolumeChanged();
		});
		comp.addEventListener(EboplayerEvents.changingVolume, async (ev) => {
			let value = parseInt(ev.detail.volume);
			await playerState_default().getController().mopidyProxy.sendVolume(value);
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.viewChanged, () => {
			this.showHideInfo();
		});
	}
	onVolumeChanged() {
		let volume = playerState_default().getModel().getVolume();
		document.getElementById(this.componentId).setAttribute("volume", volume.toString());
	}
	async onPlaybackStateChangegd() {
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
	async playOrStopOrPause(event) {
		switch (event) {
			case EboplayerEvents.playPressed:
				await playerState_default().getController().mopidyProxy.sendPlay();
				break;
			case EboplayerEvents.stopPressed:
				await playerState_default().getController().mopidyProxy.sendStop();
				break;
			case EboplayerEvents.pausePressed:
				await playerState_default().getController().mopidyProxy.sendPause();
				break;
		}
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
	connectedCallback() {
		this.shadow = this.attachShadow({ mode: "open" });
		this.fetchCssAndCache().then(() => {
			this.connected = true;
			this.onConnected();
			this.render();
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
	update() {
		this.updateBatching.schedule();
	}
	doUpdate() {
		if (!this.connected) return;
		if (!this._rendered) return;
		this.updateWhenRendered(this.shadow);
	}
	updateWhenRendered(shadow) {}
	render() {
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
		this.renderPrepared(this.shadow);
		this._rendered = true;
	}
	getShadow() {
		return this.shadow;
	}
	setClassFromBoolAttribute(attName, el) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
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
		this.render();
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
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		if (!(this.min <= this.position && this.position <= this.max)) throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
		this.render();
	}
	connectedCallback() {}
	renderPrepared(shadow) {
		let percent = (this.position - this.min) / (this.max - this.min) * 100;
		let styleElement = shadow.appendChild(document.createElement("style"));
		styleElement.innerHTML = `.movingGradient { width: ${percent}%; } `;
		this.setClassFromBoolAttribute("button", shadow.firstElementChild);
		this.setClassFromBoolAttribute("active", shadow.firstElementChild);
	}
	setClassFromBoolAttribute(attName, el) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/views/timelineView.ts
var TimelineView = class extends View {
	clickedRow;
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
			this.rebuildTimeline().then((r) => {});
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.trackListChanged, () => {
			this.rebuildTimeline().then((r) => {});
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
			this.onCurrentTrackChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
			this.onSelectedTrackChanged();
		});
	}
	async rebuildTimeline() {
		let history = playerState_default().getModel().getHistory() ?? [];
		let trackList = playerState_default().getModel().getTrackList() ?? [];
		let body = document.getElementById("timelineTable").tBodies[0];
		body.innerHTML = "";
		if (history.length > 0 && trackList.length > 0 && history[0].ref.uri == trackList[0].track.uri) history.shift();
		let allLookups = [];
		for (let i = history.length - 1; i >= 0; i--) allLookups.push(this.insertHistoryLine(history[i], body));
		for (let track of trackList) allLookups.push(this.insertTrackLine(track.track.name, track.track.uri, body, [], track.tlid));
		Promise.all(allLookups).then(() => {
			this.setCurrentTrack();
		});
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
		if (this.clickedRow.dataset.tlid) await playerState_default().getController().play(parseInt(this.clickedRow.dataset.tlid));
		else await playerState_default().getController().clearListAndPlay(this.clickedRow.dataset.uri);
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
		if (currentTrack.type == ItemType.None) return;
		let currentUri = currentTrack.track.uri;
		let trs = [...timelineTable.querySelectorAll(`tr[data-uri="${currentUri}"]`)];
		if (trs.length == 0) return;
		let tr = trs[trs.length - 1];
		if (this.clickedRow?.dataset?.uri != currentTrack.track.uri) tr.scrollIntoView({ block: "nearest" });
		timelineTable.querySelectorAll("tr").forEach((tr$1) => tr$1.classList.remove("current", "textGlow"));
		tr.classList.add("current", "textGlow");
	}
	async insertHistoryLine(line, body) {
		let title = line.ref.name.split(" - ").pop();
		await this.insertTrackLine(title, line.ref.uri, body, ["historyLine"]);
	}
	async insertTrackLine(title, uri, body, classes = [], tlid) {
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
		const track = await playerState_default().getController().lookupTrackCached(uri);
		this.updateTrackLineFromLookup(tr, track, title);
	}
	updateTrackLineFromLookup(tr, track, title) {
		let artist = "⚬⚬⚬";
		let album = "⚬⚬⚬";
		switch (track.type) {
			case ItemType.File:
				title = track.title;
				artist = track.track.artists[0].name;
				album = track.track.album.name;
				break;
			case ItemType.Stream:
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
		this.render();
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
                    align-content: center;
                    overflow: hidden;
                }
                img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    min-width: 200px;
                    min-height: 200px;
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
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		this.render();
	}
	renderPrepared(shadow) {
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
		this.update();
	}
	updateWhenRendered(shadow) {
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
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, async () => {
			this.onCurrentOrSelectedChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, async () => {
			this.onCurrentOrSelectedChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
			this.onStreamLinesChanged();
		});
	}
	onCurrentOrSelectedChanged() {
		let currentTrackUri = playerState_default().getModel().getCurrentTrack();
		let selectedTrackUri = playerState_default().getModel().getSelectedTrack();
		this.setUri(selectedTrackUri ?? currentTrackUri);
	}
	getRequiredDataTypes() {
		return [
			EboPlayerDataType.CurrentTrack,
			EboPlayerDataType.TrackList,
			EboPlayerDataType.StreamLines,
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
		this.render();
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
		this.render();
	}
	_activeTrackUri = null;
	static tagName = "ebo-album-tracks-view";
	static observedAttributes = ["img"];
	_albumInfo;
	constructor() {
		super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);
		this.albumInfo = void 0;
		this.render();
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
		this.render();
	}
	renderPrepared(shadow) {
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
				this.dispatchEvent(new EboplayerEvent(EboplayerEvents.addTrackClicked, { uri: track.track.uri }));
			});
			tdButton.querySelector("#playTrack")?.addEventListener("click", (ev) => {
				ev.target.closest("ebo-menu-button").closeMenu();
				this.dispatchEvent(new EboplayerEvent(EboplayerEvents.playTrackClicked, { uri: track.track.uri }));
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
		browseComp.addEventListener("browseFilterChanged", (ev) => {
			playerState_default().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
		});
		browseComp.addEventListener(EboplayerEvents.breadCrumbClick, (ev) => {
			this.onBreadcrumbClick(ev.detail.breadcrumbId);
		});
		browseComp.addEventListener(EboplayerEvents.browseResultClick, (ev) => {
			this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
		});
		browseComp.addEventListener(EboplayerEvents.browseResultDblClick, async (ev) => {
			await this.onBrowseResultDblClick(ev.detail.uri);
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.refsFiltered, () => {
			this.onRefsFiltered();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.breadCrumbsChanged, () => {
			this.onBreadCrumbsChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.browseFilterChanged, () => {
			this.onBrowseFilterChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
			this.onSelectedTrackChanged();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.viewChanged, () => {
			this.setCurrentView();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.albumToViewChanged, async () => {
			await this.onAlbumToViewChanged();
		});
		document.getElementById("currentTrackBigView").addEventListener("albumClick", async (e) => {
			this.onAlbumClick();
		});
		let albumComp = document.getElementById("bigAlbumView");
		albumComp.addEventListener(EboplayerEvents.playAlbumClicked, () => {
			this.onAlbumPlayClick();
		});
		albumComp.addEventListener(EboplayerEvents.addAlbumClicked, () => {
			this.onAlbumAddClick();
		});
		albumComp.addEventListener(EboplayerEvents.playTrackClicked, (ev) => {
			this.onPlayTrackClicked(ev.detail.uri);
		});
		albumComp.addEventListener(EboplayerEvents.addTrackClicked, (ev) => {
			this.onAddTrackClicked(ev.detail.uri);
		});
	}
	onRefsFiltered() {
		let browseComp = document.getElementById("browseView");
		browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? [];
		browseComp.renderResults();
	}
	onBreadCrumbsChanged() {
		let browseComp = document.getElementById("browseView");
		browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs()?.list() ?? [];
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
				browseComp.results = playerState_default()?.getModel()?.getCurrentSearchResults() ?? [];
				browseComp.breadCrumbs = playerState_default()?.getModel()?.getBreadCrumbs()?.list() ?? [];
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
		return [EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines];
	}
	onAlbumClick() {
		this.showView(Views.Album);
	}
	async onSelectedTrackChanged() {
		let uri = playerState_default().getModel().getSelectedTrack();
		playerState_default().getController().lookupTrackCached(uri).then(async (track) => {
			if (track.type == ItemType.File) {
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
		albumComp.setAttribute("name", albumModel.album.albumInfo.name);
		albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
	}
	onAlbumPlayClick() {
		let albumComp = document.getElementById("bigAlbumView");
		playerState_default().getController().playUri(albumComp.dataset.albumUri);
	}
	onAlbumAddClick() {
		let albumComp = document.getElementById("bigAlbumView");
		playerState_default().getController().addUri(albumComp.dataset.albumUri);
	}
	async onBrowseResultDblClick(uri) {
		await playerState_default().getController().clearListAndPlay(uri);
	}
	onBrowseResultClick(label, uri, type) {
		playerState_default().getController().diveIntoBrowseResult(label, uri, type, true);
	}
	onBreadcrumbClick(breadcrumbId) {
		playerState_default().getController().resetToBreadCrumb(breadcrumbId);
	}
	onPlayTrackClicked(uri) {
		playerState_default().getController().playUri(uri);
	}
	async onAddTrackClicked(uri) {
		let trackModel = await playerState_default().getController().getExpandedTrackModel(uri);
		if (!isInstanceOfExpandedStreamModel(trackModel)) {
			let text = await (await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri)).text();
			console_yellow(text);
		}
	}
};

//#endregion
//#region mopidy_eboplayer2/www/typescript/components/eboBrowseComp.ts
var EboBrowseComp = class EboBrowseComp extends EboComponent {
	static tagName = "ebo-browse-view";
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
	_results = [];
	get browseFilter() {
		return this._browseFilter;
	}
	set browseFilter(value) {
		if (JSON.stringify(this._browseFilter) == JSON.stringify(value)) return;
		this._browseFilter = value;
		this.render();
	}
	_browseFilter;
	static observedAttributes = [];
	browseFilterChangedEvent;
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
                    border-bottom: 1px solid #ffffff80;
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

            </style>
        `;
	static htmlText = `
<div id="wrapper">
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
        <button> &nbsp;&nbsp;(i) </button>
    </div>
    <div id="breadCrumbs"></div>
    <div id="searchResults">
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
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		this.render();
	}
	onConnected() {}
	setFocusAndSelect() {
		let searchText = this.getShadow().getElementById("searchText");
		searchText?.focus();
		searchText?.select();
	}
	renderPrepared(shadow) {
		shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {});
		this.renderBrowseFilter(shadow);
		this.renderBreadCrumbs();
		this.renderResults();
		this.update();
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
			btn.addEventListener(EboplayerEvents.longPress, (ev) => {
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
		this.update();
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
		this.dispatchEvent(this.browseFilterChangedEvent);
	}
	updateWhenRendered(shadow) {
		shadow.querySelectorAll("ebo-button").forEach((btn) => this.updateFilterButton(btn));
		let inputElement = shadow.getElementById("searchText");
		inputElement.value = this._browseFilter.searchText;
	}
	updateFilterButton(btn) {
		if (btn.id.startsWith("filter")) {
			let propName = btn.id.replace("filter", "").charAt(0).toLowerCase() + btn.id.replace("filter", "").slice(1);
			btn.setAttribute("pressed", this._browseFilter[propName].toString());
		}
	}
	setSearchInfo(text) {
		let searchInfo = this.getShadow().getElementById("searchInfo");
		if (searchInfo) searchInfo.innerHTML = text;
	}
	renderBreadCrumbs() {
		if (!this.rendered) return;
		let breadCrumbsDiv = this.getShadow().getElementById("breadCrumbs");
		breadCrumbsDiv.innerHTML = "Ĥ > " + this.breadCrumbs.map((crumb) => this.renderBreadcrumb(crumb)).join(" > ");
		breadCrumbsDiv.querySelectorAll("button").forEach((btn) => {
			btn.addEventListener("click", (ev) => {
				this.onBreadCrumbClicked(ev);
			});
		});
	}
	renderBreadcrumb(crumb) {
		if (crumb instanceof BreadCrumbRef) return `<button data-id="${crumb.id}" class="uri">${crumb.label}</button>`;
		else if (crumb instanceof BreadCrumbBrowseFilter) return `<button data-id="${crumb.id}" class="filter">"${crumb.label}"</button>`;
	}
	renderResults() {
		if (!this.rendered) return;
		this.setSearchInfo("");
		let body = this.getShadow().getElementById("searchResultsTable").tBodies[0];
		body.innerHTML = "";
		if (this.results.length == 0) return;
		body.innerHTML = this.results.map((result) => {
			let refType = result.ref.type;
			if (refType == "directory") {
				if (result.ref.uri.includes(LIBRARY_PROTOCOL + "directory?genre=")) refType = "genre";
			}
			return `
                    <tr data-uri="${result.ref.uri}" data-type="${refType}">
                    <td>${result.ref.name}</td>
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
	}
	onRowClicked(ev) {
		let row = ev.currentTarget;
		this.dispatchEvent(new CustomEvent(EboplayerEvents.browseResultClick, { detail: {
			"label": row.cells[0].innerText,
			"uri": row.dataset.uri,
			"type": row.dataset.type
		} }));
	}
	async onRowDoubleClicked(ev) {
		let row = ev.currentTarget;
		this.dispatchEvent(new EboplayerEvent(EboplayerEvents.browseResultDblClick, { uri: row.dataset.uri }));
	}
	onBreadCrumbClicked(ev) {
		let btn = ev.currentTarget;
		this.dispatchEvent(new EboplayerEvent(EboplayerEvents.breadCrumbClick, { breadcrumbId: parseInt(btn.dataset.id) }));
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
		"click"
	];
	pressed = false;
	img;
	imgPressed;
	opacityOff = .5;
	pressTimer;
	static styleText = `
        <style>
            img {
                width: 100%;
                opacity: 0.5;
                &.pressed { 
                    opacity: 1; 
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
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		this.render();
	}
	renderPrepared(shadow) {
		let imgTag = shadow.getElementById("image");
		this.setClassFromBoolAttribute("pressed", imgTag);
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
		let button = this.getShadow().querySelector("button");
		this.pressed = !this.pressed;
		this.setClassFromBoolAttribute("pressed", button);
		this.setAttribute("pressed", this.pressed.toString());
		let event = new PressedChangeEvent(this.pressed);
		this.dispatchEvent(event);
	}
	onFilterButtonTimeOut(source) {
		this.dispatchEvent(new Event(EboplayerEvents.longPress, {
			bubbles: true,
			composed: true
		}));
	}
	setClassFromBoolAttribute(attName, el) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
	onMultiClick(eboButton, clickCount) {
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
		this.update();
	}
	_streamInfo;
	get streamInfo() {
		return this._streamInfo;
	}
	set streamInfo(value) {
		this._streamInfo = value;
		this.update();
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
                    #buttons {
                        display: flex;
                        flex-direction: row;
                        margin-bottom: .5em;
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
                    <div id="buttons">
                        <button id="btnPlay" class="roundBorder">Play</button>
                        <button id="btnAdd" class="roundBorder">Add</button>
                    </div>                
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
		this.update();
	}
	renderPrepared(shadow) {
		this.addShadowEventListener("btnPlay", "click", (ev) => {
			this.onBtnPlayClick();
		});
		this.addShadowEventListener("btnAdd", "click", (ev) => {
			this.onBtnAddClick();
		});
		this.update();
	}
	onBtnPlayClick() {
		this.dispatchEvent(new Event(EboplayerEvents.playAlbumClicked));
	}
	onBtnAddClick() {
		this.dispatchEvent(new Event(EboplayerEvents.addAlbumClicked));
	}
	updateWhenRendered(shadow) {
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
                background-color: rgba(184, 134, 11, 0.53);
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
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		this.update();
	}
	renderPrepared(shadow) {
		let slider = shadow.getElementById("volumeSlider");
		slider.oninput = (ev) => {
			this.isVolumeSliding = true;
			this.volume = quadratic100(parseInt(slider.value));
			this.dispatchEvent(new CustomEvent(EboplayerEvents.changingVolume, {
				bubbles: true,
				composed: true,
				detail: { volume: this.volume }
			}));
		};
		slider.onmousedown = slider.ontouchstart = () => {
			this.isVolumeSliding = true;
		};
		slider.onmouseup = slider.ontouchend = () => {
			this.isVolumeSliding = false;
		};
		let btnPlay = shadow.getElementById("btnPlay");
		btnPlay.addEventListener("click", (ev) => {
			let title = btnPlay.querySelector("i").title;
			let eventName;
			switch (title) {
				case "Play":
					eventName = EboplayerEvents.playPressed;
					break;
				case "Pause":
					eventName = EboplayerEvents.pausePressed;
					break;
				case "Stop":
					eventName = EboplayerEvents.stopPressed;
					break;
			}
			this.dispatchEvent(new CustomEvent(eventName, {
				bubbles: true,
				composed: true
			}));
		});
		shadow.getElementById("buttonBarImg").addEventListener("click", (ev) => {
			this.dispatchEvent(new Event(EboplayerEvents.albumClicked));
		});
	}
	updateWhenRendered(shadow) {
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
                xposition: absolute;
                position-anchor: --popup-button;
                margin: 0;
                inset: auto;
                bottom: anchor(top);
                right: anchor(right);
                opacity: 0;
                margin-left: 0.25rem;
                background-color: var(--body-background);
                
                &:popover-open {
                    xdisplay: grid;
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
		this.render();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		switch (name) {
			case "img":
				this[name] = newValue;
				break;
			case "pressed":
				if (!["true", "false"].includes(newValue)) throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
				this[name] = newValue == "true";
				break;
		}
		this.render();
	}
	renderPrepared() {}
	closeMenu() {
		this.getShadow().getElementById("menu").hidePopover();
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
		setupStuff();
	});
});
function setupStuff() {
	let connectOptions = {
		webSocketUrl: getWebSocketUrl(),
		autoConnect: false
	};
	let mopidy = new Mopidy(connectOptions);
	let eboWebSocketCtrl = new JsonRpcController("ws://192.168.1.111:6680/eboplayer2/ws/");
	let timer = new SyncedProgressTimer(8, mopidy);
	let model = new Model();
	let controller = new Controller(model, mopidy, eboWebSocketCtrl);
	controller.initSocketevents();
	let state$1 = new State(mopidy, timer, model, controller);
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