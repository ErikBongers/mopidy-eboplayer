//#region mopidy_eboplayer2/static/js/mopidy.ts
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
	class Playlist {
		uri;
		name;
		tracks;
		last_modified;
		length;
	}
	_models.Playlist = Playlist;
})(models || (models = {}));
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
function snakeToCamel(name) {
	return name.replace(/(_[a-z])/g, (match) => match.toUpperCase().replace("_", ""));
}
var Mopidy = class Mopidy extends EventEmitter {
	_options;
	_backoffDelay;
	_pendingRequests;
	_webSocket;
	constructor(options) {
		super();
		this._options = this._configure({
			backoffDelayMin: 1e3,
			backoffDelayMax: 64e3,
			autoConnect: true,
			webSocketUrl: "",
			...options
		});
		this._backoffDelay = this._options.backoffDelayMin;
		this._pendingRequests = {};
		this._webSocket = null;
		this._delegateEvents();
		if (this._options.autoConnect) this.connect();
	}
	_configure(options) {
		if (options.webSocketUrl) return options;
		let protocol = typeof document !== "undefined" && document.location.protocol === "https:" ? "wss://" : "ws://";
		let currentHost = typeof document !== "undefined" && document.location.host || "localhost";
		options.webSocketUrl = `${protocol}${currentHost}/mopidy/ws`;
		return options;
	}
	_delegateEvents() {
		this.removeAllListeners("websocket:close");
		this.removeAllListeners("websocket:error");
		this.removeAllListeners("websocket:incomingMessage");
		this.removeAllListeners("websocket:open");
		this.removeAllListeners("state:offline");
		this.on("websocket:close", this._cleanup);
		this.on("websocket:error", this._handleWebSocketError);
		this.on("websocket:incomingMessage", this._handleMessage);
		this.on("websocket:open", this._resetBackoffDelay);
		this.on("websocket:open", this._getApiSpec);
		this.on("state:offline", this._reconnect);
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
	connect() {
		if (this._webSocket) {
			if (this._webSocket.readyState === WebSocket.OPEN) return;
			this._webSocket.close();
		}
		this._webSocket = new WebSocket(this._options.webSocketUrl);
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
	_cleanup(closeEvent) {
		Object.keys(this._pendingRequests).forEach((requestId) => {
			const { reject } = this._pendingRequests[requestId];
			delete this._pendingRequests[requestId];
			const error = new ConnectionError("WebSocket closed");
			error.closeEvent = closeEvent;
			reject(error);
		});
		this.emit("state", "state:offline");
		this.emit("state:offline");
	}
	_reconnect() {
		setTimeout(() => {
			this.emit("state", ["reconnectionPending", { timeToAttempt: this._backoffDelay }]);
			this.emit("reconnectionPending", { timeToAttempt: this._backoffDelay });
			setTimeout(() => {
				this.emit("state", "reconnecting");
				this.emit("reconnecting");
				this.connect();
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
		if (this._webSocket) this._webSocket.close();
	}
	_handleWebSocketError(error) {
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
	_handleMessage(message) {
		try {
			const data = JSON.parse(message.data);
			if (Object.hasOwnProperty.call(data, "id")) this._handleResponse(data);
			else if (Object.hasOwnProperty.call(data, "event")) this._handleEvent(data);
			else console.warn(`Unknown message type received. Message was: ${message.data}`);
		} catch (error) {
			if (error instanceof SyntaxError) console.warn(`WebSocket message parsing failed. Message was: ${message.data}`);
			else throw error;
		}
	}
	_handleResponse(responseMessage) {
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
	_handleEvent(eventMessage) {
		const data = { ...eventMessage };
		delete data.event;
		const eventName = `event:${snakeToCamel(eventMessage.event)}`;
		this.emit("event", [eventName, data]);
		this.emit(eventName, data);
	}
	_getApiSpec() {
		return this.send({ method: "core.describe" }).then(this._createApi.bind(this)).catch(this._handleWebSocketError.bind(this));
	}
	_createApi(methods) {
		const caller = (method) => (...args) => {
			let message = { method };
			if (args.length === 0) return this.send(message);
			if (args.length > 1) return Promise.reject(/* @__PURE__ */ new Error("Expected zero arguments, a single array, or a single object."));
			if (!Array.isArray(args[0]) && args[0] !== Object(args[0])) return Promise.reject(/* @__PURE__ */ new TypeError("Expected an array or an object."));
			let message2 = {
				method,
				params: args
			};
			return this.send(message2);
		};
		const getPath = (fullName) => {
			let path = fullName.split(".");
			if (path.length >= 1 && path[0] === "core") path = path.slice(1);
			return path;
		};
		const createObjects = (objPath) => {
			let parentObj = this;
			objPath.forEach((objName) => {
				const camelObjName = snakeToCamel(objName);
				parentObj[camelObjName] = parentObj[camelObjName] || {};
				parentObj = parentObj[camelObjName];
			});
			return parentObj;
		};
		const createMethod = (fullMethodName) => {
			const methodPath = getPath(fullMethodName);
			const methodName = snakeToCamel(methodPath.slice(-1)[0]);
			const object = createObjects(methodPath.slice(0, -1));
			object[methodName] = caller(fullMethodName);
			object[methodName].description = methods[fullMethodName].description;
			object[methodName].params = methods[fullMethodName].params;
		};
		Object.keys(methods).forEach(createMethod);
		this.emit("state", "state:online");
		this.emit("state:online");
	}
	static idCounter = -1;
	_nextRequestId() {
		return ++Mopidy.idCounter;
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
//#region typescript/timer.ts
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
//#region typescript/synced_timer.ts
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
//#region typescript/playerState.ts
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
	artistsHtml = "";
	artistsText = "";
	albumHtml = "";
	albumText = "";
	streamUris = {};
	songdata = void 0;
	pageScrollPos = {};
	uriSchemes = {};
	playlists = {};
	customTracklists = [];
	browseStack = [];
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
		for (const dataType of requiredData) await this.controller.getData(dataType);
	}
};
let state = void 0;
function setState(newState) {
	state = newState;
}
const getState = () => state;
var playerState_default = getState;

//#endregion
//#region typescript/model.ts
let TrackType = /* @__PURE__ */ function(TrackType$1) {
	TrackType$1[TrackType$1["None"] = 0] = "None";
	TrackType$1[TrackType$1["File"] = 1] = "File";
	TrackType$1[TrackType$1["Stream"] = 2] = "Stream";
	return TrackType$1;
}({});
let EboplayerEvents = /* @__PURE__ */ function(EboplayerEvents$1) {
	EboplayerEvents$1["volumeChanged"] = "eboplayer.volumeChanged";
	EboplayerEvents$1["connectionChanged"] = "eboplayer.connectionChanged";
	EboplayerEvents$1["playStateChanged"] = "eboplayer.playbackStateChanged";
	EboplayerEvents$1["messageChanged"] = "eboplayer.messageChanged";
	EboplayerEvents$1["currentTrackChanged"] = "eboplayer.currentTrackChanged";
	EboplayerEvents$1["activeStreamLinesChanged"] = "eboplayer.activeStreamLinesChanged";
	EboplayerEvents$1["historyChanged"] = "eboplayer.historyChanged";
	EboplayerEvents$1["trackListChanged"] = "eboplayer.trackListChanged";
	return EboplayerEvents$1;
}({});
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
	return PlayState$1;
}({});
var Model = class Model extends EventTarget {
	static NoTrack = { type: TrackType.None };
	currentTrack = Model.NoTrack;
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
	playState;
	activeStreamLines;
	history;
	trackList = [];
	libraryCache = {};
	constructor() {
		super();
		this.libraryCache = {};
	}
	setConnectionState(state$1) {
		this.connectionState = state$1;
		if (this.connectionState == ConnectionState.Online) this.clearMessage();
		else this.setErrorMessage("Offline");
		this.dispatchEvent(new Event(EboplayerEvents.connectionChanged));
	}
	getConnectionState = () => this.connectionState;
	getCurrentTrack = () => this.currentTrack;
	setCurrentTrack(track) {
		this.currentTrack = track;
		this.dispatchEvent(new Event(EboplayerEvents.currentTrackChanged));
	}
	clearCurrentTrack() {
		this.setCurrentTrack(Model.NoTrack);
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
	setActiveStreamLinesHistory(lines) {
		this.activeStreamLines = lines;
		this.dispatchEvent(new Event(EboplayerEvents.activeStreamLinesChanged));
	}
	getActiveStreamLines = () => this.activeStreamLines;
	setHistory(history$1) {
		this.history = history$1;
		this.dispatchEvent(new Event(EboplayerEvents.historyChanged));
	}
	getHistory = () => this.history;
	setTrackList(trackList) {
		this.trackList = trackList;
		this.dispatchEvent(new Event(EboplayerEvents.trackListChanged));
	}
	getTrackList = () => this.trackList;
	addToLibraryCache(tracks) {
		this.libraryCache = {
			...this.libraryCache,
			...tracks
		};
	}
	getTrackFromCache(uri) {
		return this.libraryCache[uri];
	}
};

//#endregion
//#region typescript/views/dataRequester.ts
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
//#region typescript/views/view.ts
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
//#region typescript/views/headerView.ts
var HeaderView = class extends View {
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
			this.onMessageChangegd();
		});
	}
	onMessageChangegd() {
		let msg = playerState_default().getModel().getCurrentMessage();
		let headerSpan = document.getElementById("contentHeadline");
		headerSpan.innerText = msg.message;
		if (msg.type == MessageType.Error) headerSpan.classList.add("warning");
		else headerSpan.classList.remove("warning", "error");
	}
	getRequiredDataTypes() {
		return [];
	}
};

//#endregion
//#region typescript/process_ws.ts
function transformTlTrackDataToModel(tlTrack) {
	return transformTrackDataToModel(tlTrack?.track);
}
function processGetPlaylists(resultArr) {
	if (!resultArr || resultArr === "") {
		document.getElementById("playlistslist").innerHTML = "";
		return;
	}
	let tmp = "";
	let favourites = "";
	let starred = "";
	for (let i = 0; i < resultArr.length; i++) {
		let li_html = "<li><a href=\"#\" onclick=\"return library.showTracklist(this.id);\" id=\"" + resultArr[i].uri + "\">";
		if (isFavouritesPlaylist(resultArr[i])) favourites = li_html + "&hearts; Musicbox Favourites</a></li>";
		else tmp = tmp + li_html + "<i class=\"" + getMediaClass(resultArr[i]) + "\"></i> " + resultArr[i].name + "</a></li>";
	}
	tmp = favourites + starred + tmp;
	document.getElementById("playlistslist").innerHTML = tmp;
	/* @__PURE__ */ scrollToTracklist();
	/* @__PURE__ */ showLoading(false);
}

//#endregion
//#region typescript/library.ts
let library = {
	searchPressed: function(key) {
		return true;
	},
	initSearch: function() {},
	processSearchResults: function(resultArr) {},
	getPlaylists: function() {
		playerState_default().commands.core.playlists.asList().then(processGetPlaylists, console.error);
	},
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
//#region typescript/controls.ts
function setPlayState(nwplay) {}
function setPosition(pos) {
	if (!playerState_default().positionChanging && document.querySelector("#trackslider").value !== pos) playerState_default().syncedProgressTimer.set(pos);
}
/** *********************************************
* Volume slider                               *
* Use a timer to prevent looping of commands  *
***********************************************/
function setMute(nwmute) {}

//#endregion
//#region typescript/functionsvars.ts
const STREAMS_PLAYLIST_NAME = "[Radio Streams]";
const STREAMS_PLAYLIST_SCHEME = "m3u";
const HOSTNAME = document.body.dataset.hostname;
let radioExtensionsList = [
	"somafm",
	"tunein",
	"dirble",
	"audioaddict"
];
let uriClassList = [
	["spotify", "fa-spotify"],
	["spotifytunigo", "fa-spotify"],
	["spotifyweb", "fa-spotify"],
	["local", "fa-file-sound-o"],
	["file", "fa-file-sound-o"],
	["m3u", "fa-file-sound-o"],
	["podcast", "fa-rss-square"],
	["podcast+file", "fa-rss-square"],
	["podcast+itunes", "fa-apple"],
	["dirble", "fa-microphone"],
	["tunein", "fa-headphones"],
	["soundcloud", "fa-soundcloud"],
	["sc", "fa-soundcloud"],
	["gmusic", "fa-google"],
	["internetarchive", "fa-university"],
	["somafm", "fa-flask"],
	["youtube", "fa-youtube"],
	["yt", "fa-youtube"],
	["audioaddict", "fa-bullhorn"],
	["subsonic", "fa-folder-open"]
];
const VALID_AUDIO_EXT = [
	"aa",
	"aax",
	"aac",
	"aiff",
	"au",
	"flac",
	"gsm",
	"iklax",
	"ivs",
	"m4a",
	"m4b",
	"m4p",
	"mp3",
	"mpc",
	"ogg",
	"oga",
	"mogg",
	"opus",
	"ra",
	"rm",
	"raw",
	"tta",
	"vox",
	"wav",
	"wma",
	"wv",
	"webm"
];
function scrollToTracklist() {}
/** ****************
* Modal dialogs  *
******************/
function showLoading(on) {}
function validUri(uri) {
	return /^(http|https|mms|rtmp|rtmps|rtsp):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/.test(uri);
}
function getScheme(uri) {
	return uri.split(":")[0].toLowerCase();
}
function isPlayable(track) {
	if (typeof track.type === "undefined" || track.type === "track") {
		if (track.uri && getScheme(track.uri) === "file") {
			let ext = track.uri.split(".").pop().toLowerCase();
			return VALID_AUDIO_EXT.includes(ext);
		}
		return true;
	}
	return false;
}
function isStreamUri(uri) {
	return validUri(uri) || radioExtensionsList.indexOf(getScheme(uri)) >= 0;
}
function getMediaClass(track) {
	let defaultIcon = "fa-file-sound-o";
	let type = track.type;
	if (typeof type === "undefined" || type === "track") {
		if (!isPlayable(track)) return "fa fa-file-o";
		else if (isStreamUri(track.uri)) return "fa fa-rss";
	} else if (type === "directory") return "fa fa-folder-o";
	else if (type === "album") defaultIcon = "fa-folder-o";
	else if (type === "artist") defaultIcon = "fa-folder-o";
	else if (type === "playlist") {}
	if (track.uri) {
		let scheme = getScheme(track.uri);
		for (let i = 0; i < uriClassList.length; i++) if (scheme === uriClassList[i][0]) return "fa " + uriClassList[i][1];
		return "fa " + defaultIcon;
	}
	return "";
}
function isFavouritesPlaylist(playlist) {
	return playlist.name === STREAMS_PLAYLIST_NAME && getScheme(playlist.uri) === STREAMS_PLAYLIST_SCHEME;
}

//#endregion
//#region scripts/commands.ts
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
//#region typescript/controller.ts
var Controller = class extends Commands {
	model;
	commands;
	constructor(model, mopidy) {
		super(mopidy);
		this.model = model;
		this.commands = new Commands(mopidy);
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
			await this.fetchHistory();
		});
		this.mopidy.on("state:offline", () => {
			this.model.setConnectionState(ConnectionState.Offline);
		});
		this.mopidy.on("event:optionsChanged", this.fetchPlaybackOptions);
		this.mopidy.on("event:trackPlaybackStarted", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
			setPlayState(true);
		});
		this.mopidy.on("event:trackPlaybackResumed", async (data) => {
			await this.setCurrentTrackAndFetchDetails(data.tl_track);
			setPlayState(true);
		});
		this.mopidy.on("event:playlistsLoaded", () => {
			/* @__PURE__ */ showLoading(true);
			library.getPlaylists();
		});
		this.mopidy.on("event:playlistChanged", (data) => {
			document.getElementById("playlisttracksdiv").style.display = "none";
			document.getElementById("playlistslistdiv").style.display = "block";
			delete playerState_default().playlists[data.playlist.uri];
			library.getPlaylists();
		});
		this.mopidy.on("event:playlistDeleted", (data) => {
			document.getElementById("playlisttracksdiv").style.display = "none";
			document.getElementById("playlistslistdiv").style.display = "block";
			delete playerState_default().playlists[data.uri];
			library.getPlaylists();
		});
		this.mopidy.on("event:volumeChanged", (data) => {
			this.model.setVolume(data.volume);
		});
		this.mopidy.on("event:muteChanged", (data) => {
			setMute(data.mute);
		});
		this.mopidy.on("event:playbackStateChanged", (data) => {
			playerState_default().getController().setPlayState(data.new_state);
		});
		this.mopidy.on("event:tracklistChanged", async () => {
			await this.fetchTracklistAndDetails();
		});
		this.mopidy.on("event:seeked", (data) => {
			setPosition(data.time_position);
			if (playerState_default().play) playerState_default().syncedProgressTimer.start();
		});
		this.mopidy.on("event:streamHistoryChanged", (data) => {
			let lines = Object.values(data.data);
			this.model.setActiveStreamLinesHistory(lines);
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
	}
	async fetchTracklistAndDetails() {
		let tracks = await this.commands.core.tracklist.getTlTracks();
		this.model.setTrackList(tracks);
	}
	async fetchCurrentTrackAndDetails() {
		let currentTrack = await this.commands.core.playback.getCurrentTlTrack();
		await this.setCurrentTrackAndFetchDetails(currentTrack);
	}
	async setCurrentTrackAndFetchDetails(data) {
		this.model.setCurrentTrack(transformTlTrackDataToModel(data));
		await this.fetchActiveStreamLines();
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
	setVolume(volume) {
		this.model.setVolume(volume);
	}
	setPlayState(state$1) {
		this.model.setPlayState(state$1);
	}
	setTracklist(trackList) {
		this.model.setTrackList(trackList);
	}
	async getData(dataType) {
		switch (dataType) {
			case EboPlayerDataType.Volume:
				let volume = await this.commands.core.mixer.getVolume();
				this.setVolume(volume);
				break;
			case EboPlayerDataType.CurrentTrack:
				let track = await this.commands.core.playback.getCurrentTlTrack();
				await this.setCurrentTrackAndFetchDetails(track);
				break;
			case EboPlayerDataType.PlayState:
				let state$1 = await this.commands.core.playback.getState();
				this.setPlayState(state$1);
				break;
			case EboPlayerDataType.StreamLines:
				await this.fetchActiveStreamLines();
				break;
			case EboPlayerDataType.TrackList:
				await this.fetchTracklistAndDetails();
				break;
		}
	}
	async fetchActiveStreamLines() {
		let lines = await (await fetch(`http://${getHostAndPort()}/eboplayer/stream/activeLines`)).json();
		this.model.setActiveStreamLinesHistory(lines);
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
		let unique = [...new Set(dedupLines)];
		let dict = await this.commands.core.library.lookup(unique.map((l) => l.ref.uri));
		this.model.addToLibraryCache(dict);
		this.model.setHistory(dedupLines);
	}
	async lookupCached(uri) {
		let tracks = this.model.getTrackFromCache(uri);
		if (tracks) return tracks;
		let dict = await this.commands.core.library.lookup([uri]);
		this.model.addToLibraryCache(dict);
		return this.model.getTrackFromCache(uri);
	}
	async playTrack(uri) {
		await this.commands.core.tracklist.clear();
		let tracks = await this.commands.core.tracklist.add(null, null, [uri]);
		let trackList = numberedDictToArray(tracks);
		this.setTracklist(trackList);
		this.commands.core.playback.play(null, trackList[0].tlid);
		await this.setCurrentTrackAndFetchDetails(trackList[0]);
	}
	async sendVolume(value) {
		await this.commands.core.mixer.setVolume(Math.floor(quadratic100(value)));
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
};
function quadratic100(x) {
	return x * x / 100;
}
function inverseQuadratic100(y) {
	return Math.floor(Math.sqrt(y * 100));
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
	let hostName = document.body.dataset.hostname;
	if (!hostName.startsWith("{{")) return hostName;
	hostName = localStorage.getItem("eboplayer.hostName");
	if (hostName) return hostName;
	return document.location.host;
}
function isStream(track) {
	return track?.track_no == void 0;
}
function transformTrackDataToModel(track) {
	if (!track) return { type: TrackType.None };
	if (isStream(track)) return {
		type: TrackType.Stream,
		track,
		name: track.name,
		infoLines: []
	};
	let model = {
		type: TrackType.File,
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

//#endregion
//#region typescript/views/bigTrackView.ts
var BigTrackView = class extends View {
	id;
	streamLines;
	constructor(id) {
		super();
		this.id = id;
		this.streamLines = "";
	}
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
			this.onCurrentTrackChangegd();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.trackListChanged, () => {
			this.onTrackListChangegd();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
			this.onStreamLinesChangegd();
		});
	}
	onStreamLinesChangegd() {
		this.streamLines = playerState_default().getModel().getActiveStreamLines().join("<br/>");
		document.getElementById(this.id).setAttribute("stream_lines", this.streamLines);
	}
	onTrackListChangegd() {
		playerState_default().getController().fetchCurrentTrackAndDetails();
	}
	onCurrentTrackChangegd() {
		let track = playerState_default().getModel().getCurrentTrack();
		if (track.type == TrackType.None) return;
		document.getElementById(this.id);
		let name = "no current track";
		let info = "";
		let position;
		let button;
		switch (track.type) {
			case TrackType.Stream:
				name = track.name;
				position = "100";
				button = "false";
				break;
			case TrackType.File:
				name = track.title;
				info = track.track.album.name;
				position = "60";
				button = "true";
				let artists = track.track.artists.map((a) => a.name).join(", ");
				let composers = track.track.composers.map((c) => c.name).join(", ");
				if (artists) info += "<br>" + artists;
				if (composers) info += "<br>" + composers;
				break;
		}
		document.getElementById(this.id).setAttribute("name", name);
		document.getElementById(this.id).setAttribute("info", info);
		document.getElementById(this.id).setAttribute("position", position);
		document.getElementById(this.id).setAttribute("button", button);
	}
	getRequiredDataTypes() {
		return [
			EboPlayerDataType.CurrentTrack,
			EboPlayerDataType.TrackList,
			EboPlayerDataType.StreamLines
		];
	}
};

//#endregion
//#region typescript/views/volumeView.ts
var VolumeView = class extends View {
	sliderId;
	isSourceOfChange = false;
	constructor(sliderId) {
		super();
		this.sliderId = sliderId;
	}
	getSlider = () => document.getElementById(this.sliderId);
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.volumeChanged, () => {
			this.onVolumeChanged();
		});
		let slider = this.getSlider();
		slider.oninput = (ev) => {
			this.sendVolume(parseInt(ev.target.value)).then();
		};
		slider.onmousedown = slider.ontouchstart = () => {
			this.isSourceOfChange = true;
		};
		slider.onmouseup = slider.ontouchend = () => {
			this.isSourceOfChange = false;
		};
	}
	onVolumeChanged() {
		if (this.isSourceOfChange) return;
		let volume = playerState_default().getModel().getVolume();
		let slider = document.getElementById(this.sliderId);
		let visualVolume = inverseQuadratic100(volume);
		slider.value = Math.floor(visualVolume).toString();
	}
	async sendVolume(value) {
		await playerState_default().getController().sendVolume(value);
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.Volume];
	}
};

//#endregion
//#region typescript/views/buttonBarView.ts
var ButtonBarView = class extends View {
	containerId;
	volumeView;
	constructor(containerId) {
		super();
		this.containerId = containerId;
		this.volumeView = new VolumeView(`${this.containerId}.volumeslider`);
		this.addChildren(this.volumeView);
	}
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.playStateChanged, () => {
			this.onPlaybackStateChangegd();
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
			this.onCurrentTrackChanged();
		});
		document.getElementById(`${this.containerId}.btnPlay`).onclick = () => {
			this.playOrStopOrPause().then((r) => {});
		};
	}
	onPlaybackStateChangegd() {
		switch (playerState_default().getModel().getPlayState()) {
			case PlayState.paused:
			case PlayState.stopped:
				this.setPlayButton("Play", ["fa-pause", "fa-stop"], "fa-play");
				break;
			case PlayState.playing:
				if (playerState_default().getModel().getCurrentTrack().type == TrackType.Stream) this.setPlayButton("Pause", ["fa-play"], "fa-stop");
				else this.setPlayButton("Pause", ["fa-play"], "fa-pause");
				break;
		}
	}
	onCurrentTrackChanged() {
		if (playerState_default().getModel().getCurrentTrack().type == TrackType.Stream) {
			View.getSubId(this.containerId, "btnNext").style.opacity = "0.5";
			View.getSubId(this.containerId, "btnPrev").style.opacity = "0.5";
		}
	}
	async playOrStopOrPause() {
		if (playerState_default().getModel().getPlayState() == PlayState.playing) if (playerState_default().getModel().getCurrentTrack().type == TrackType.Stream) return playerState_default().getController().sendStop();
		else return playerState_default().getController().sendPause();
		else return playerState_default().getController().sendPlay();
	}
	setPlayButton(title, removeClasses, addClass) {
		let btnPlayIcon = View.getSubId(this.containerId, "btnPlay").querySelector("i");
		btnPlayIcon.classList.remove(...removeClasses);
		btnPlayIcon.classList.add(addClass);
		btnPlayIcon.setAttribute("title", title);
	}
	getRequiredDataTypes() {
		return [EboPlayerDataType.PlayState];
	}
};

//#endregion
//#region typescript/components/EboComponent.ts
var EboComponent = class extends HTMLElement {
	constructor() {
		super();
	}
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		this.attributeReallyChangedCallback(name, oldValue, newValue);
	}
};

//#endregion
//#region typescript/components/eboProgressBar.ts
var EboProgressBar = class extends EboComponent {
	static tagName = "ebo-progressbar";
	shadow;
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
	styleTemplate;
	divTemplate;
	constructor() {
		super();
		this.styleTemplate = document.createElement("template");
		this.styleTemplate.innerHTML = `
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
</style>`;
		this.divTemplate = document.createElement("template");
		this.divTemplate.innerHTML = `
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
		this.shadow = this.attachShadow({ mode: "open" });
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
	render() {
		let percent = (this.position - this.min) / (this.max - this.min) * 100;
		this.shadow.innerHTML = "";
		this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
		let styleElement = this.shadow.appendChild(document.createElement("style"));
		styleElement.innerHTML = `.movingGradient { width: ${percent}%; } `;
		let fragment = this.divTemplate.content.cloneNode(true);
		this.setClassFromBoolAttribute("button", fragment.firstElementChild);
		this.setClassFromBoolAttribute("active", fragment.firstElementChild);
		this.shadow.appendChild(fragment);
	}
	setClassFromBoolAttribute(attName, el) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
};

//#endregion
//#region typescript/views/timelineView.ts
var TimelineView = class extends View {
	clickedRow;
	bind() {
		playerState_default().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
			this.onHistoryChangegd().then((r) => {});
		});
		playerState_default().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
			this.onCurrentTrackChanged();
		});
	}
	async onHistoryChangegd() {
		let history$1 = playerState_default().getModel().getHistory();
		let body = document.getElementById("timelineTable").tBodies[0];
		body.innerHTML = "";
		let allLookups = [];
		for (let line of history$1) allLookups.push(this.insertTrackLine(line, body));
		playerState_default().getController().fetchCurrentTrackAndDetails();
		Promise.all(allLookups).then(() => {
			this.setActiveTrack();
		});
		body.querySelectorAll("tr").forEach((tr) => {
			tr.addEventListener("click", (ev) => {
				this.onRowDoubleClicked(ev);
			});
			tr.addEventListener("dblclick", (ev) => {
				this.onRowClicked(ev);
			});
		});
	}
	onRowClicked(ev) {
		this.clickedRow = ev.currentTarget;
	}
	async onRowDoubleClicked(ev) {
		await playerState_default().getController().playTrack(this.clickedRow.dataset.uri);
	}
	setActiveTrack() {
		let timelineTable = document.getElementById("timelineTable");
		let currentTrack = playerState_default().getModel().getCurrentTrack();
		if (currentTrack.type == TrackType.None) return;
		{
			let currentUri = currentTrack.track.uri;
			let tr = timelineTable.querySelector(`tr[data-uri="${currentUri}"]`);
			if (!tr) return;
			if (this.clickedRow?.dataset?.uri != currentTrack.track.uri) tr.scrollIntoView({ block: "nearest" });
			timelineTable.querySelectorAll("tr").forEach((tr$1) => tr$1.classList.remove("active", "textGlow"));
			tr.classList.add("active", "textGlow");
		}
	}
	insertTrackLine(line, body) {
		let title = line.ref.name.split(" - ").pop();
		let tr = document.createElement("tr");
		body.insertAdjacentElement("afterbegin", tr);
		tr.classList.add("trackLine");
		tr.dataset.uri = line.ref.uri;
		this.setTrackLineContent(tr, title);
		body.insertAdjacentHTML("afterbegin", `
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);
		return playerState_default().getController().lookupCached(line.ref.uri).then((tracks) => {
			this.updateTrackLineFromLookup(tr, tracks, title);
		});
	}
	updateTrackLineFromLookup(tr, tracks, title) {
		let track = transformTrackDataToModel(tracks[0]);
		let artist = "⚬⚬⚬";
		let album = "⚬⚬⚬";
		switch (track.type) {
			case TrackType.File:
				title = track.title;
				artist = track.track.artists[0].name;
				album = track.track.album.name;
				break;
			case TrackType.Stream:
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
		this.setActiveTrack();
	}
};

//#endregion
//#region typescript/components/eboBigTrackView.ts
var EboBigTrackView = class EboBigTrackView extends EboComponent {
	static tagName = "ebo-big-track-view";
	shadow;
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
		...EboBigTrackView.progressBarAttributes
	];
	name = "";
	stream_lines = "";
	extra = "";
	enabled = false;
	position = "40";
	min = "0";
	max = "100";
	button = "false";
	active = "true";
	img = "images/default_cover.png";
	styleTemplate;
	divTemplate;
	constructor() {
		super();
		this.styleTemplate = document.createElement("template");
		this.styleTemplate.innerHTML = `
            <style>
                .albumCoverContainer {
                    display: flex;
                    flex-direction: column;
                    flex-wrap: wrap;
                    align-content: center;
                }
                ebo-progressbar {
                    margin-top: .5em;
                }
                .selectable {
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    -o-user-select: text;
                    user-select: text;
                }
            </style>
        `;
		this.divTemplate = document.createElement("template");
		this.divTemplate.innerHTML = `
            <div class="albumCoverContainer">
                <img id="img" src="${this.img}" alt="Album cover"/>
                <ebo-progressbar position="${this.position}" active="${this.active}" button="${this.button}"></ebo-progressbar>
            </div>

            <div id="info">
                <h3 id="name"></h3>
                <p id="stream_lines" class="selectable"></p>
                <p id="extra" class="selectable"></p>
            </div>
        `;
		this.shadow = this.attachShadow({ mode: "open" });
		this.render();
	}
	attributeReallyChangedCallback(name, _oldValue, newValue) {
		if (EboBigTrackView.progressBarAttributes.includes(name)) {
			this[name] = newValue;
			this.shadow.querySelector("ebo-progressbar").setAttribute(name, newValue);
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
	connectedCallback() {}
	render() {
		this.shadow.innerHTML = "";
		this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
		let fragment = this.divTemplate.content.cloneNode(true);
		[
			"name",
			"stream_lines",
			"extra"
		].forEach((attName) => {
			fragment.getElementById(attName).innerHTML = this[attName];
		});
		let progressBarElement = fragment.querySelector("ebo-progressbar");
		EboBigTrackView.progressBarAttributes.forEach((attName) => {
			progressBarElement.setAttribute(attName, this[attName]);
		});
		this.shadow.appendChild(fragment);
	}
	setClassFromBoolAttribute(attName, el) {
		if (this[attName] == true) el.classList.add(attName);
		else el.classList.remove(attName);
	}
};

//#endregion
//#region typescript/gui.ts
function getWebSocketUrl() {
	let webSocketUrl = document.body.dataset.websocketUrl;
	if (webSocketUrl.startsWith("{{")) webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;
	return webSocketUrl;
}
document.addEventListener("DOMContentLoaded", function() {
	let connectOptions = {
		webSocketUrl: getWebSocketUrl(),
		autoConnect: false
	};
	let mopidy = new Mopidy(connectOptions);
	let timer = new SyncedProgressTimer(8, mopidy);
	let model = new Model();
	let controller = new Controller(model, mopidy);
	controller.initSocketevents();
	let state$1 = new State(mopidy, timer, model, controller);
	setState(state$1);
	let headerView = new HeaderView();
	let currentTrackView = new BigTrackView("currentTrackBigView");
	let buttonBarView = new ButtonBarView("buttonBar");
	let historyView = new TimelineView();
	playerState_default().addViews(headerView, currentTrackView, buttonBarView, historyView);
	mopidy.connect();
});
function console_yellow(msg) {
	console.log(`%c${msg}`, "background-color: yellow");
}
customElements.define(EboProgressBar.tagName, EboProgressBar);
customElements.define(EboBigTrackView.tagName, EboBigTrackView);

//#endregion
export { console_yellow, getWebSocketUrl };
//# sourceMappingURL=bundle.js.map