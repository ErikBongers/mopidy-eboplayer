// Type definitions for js v1.2.0, Mopidy v3.0.2 WebSocket API

import {EventEmitter} from "../typescript/eventEmitter";

export interface Options {
    /**
     * URL used when creating new WebSocket objects.
     *
     * In a browser environment, it defaults to
     * ws://${document.location.host}/mopidy/ws. If the current page is served
     * over HTTPS, it defaults to using wss:// instead of ws://.
     *
     * In a non-browser environment, where document.location isn't available, it
     * defaults to ws://localhost/mopidy/ws.
     */
    webSocketUrl: string;
    /**
     * Whether or not to connect to the WebSocket on instance creation. Defaults
     * to true.
     */
    autoConnect?: boolean;
    /**
     * The minimum number of milliseconds to wait after a connection error before
     * we try to reconnect. For every failed attempt, the backoff delay is doubled
     * until it reaches backoffDelayMax. Defaults to 1000.
     */
    backoffDelayMin?: number;
    /**
     * The maximum number of milliseconds to wait after a connection error before
     * we try to reconnect. Defaults to 64000.
     */
    backoffDelayMax?: number;
    /**
     * If set, this object will be used to log errors from Mopidy.js. This is
     * mostly useful for testing Mopidy.js. Defaults to console.
     */
}

type URI = string;

namespace models {
    export type ModelType = "album" | "artist" | "directory" | "playlist" | "track";

    export class TlTrack {
        readonly tlid: number;
        readonly track: Track;
    }
    export class Track {
        readonly uri: URI;
        readonly name: string;
        readonly artists: Artist[];
        readonly album: Album;
        readonly composers: Artist[];
        readonly performers: Artist[];
        readonly genre: string;
        readonly track_no: number;
        readonly disc_no: number;
        readonly date: string;
        readonly length: number;
        readonly bitrate: string;
        readonly comment: string;
        readonly musicbrainz_id: string;
        readonly last_modified: number;
    }
    class SearchResult {
        readonly uri: URI;
        readonly tracks: Track[];
        readonly artists: Artist[];
        readonly albums: Album[];
    }

    class Artist {
        readonly uri: URI;
        readonly name: string;
        readonly sortname: string;
        readonly musicbrainz_id: string;
    }

    class Album {
        readonly uri: URI;
        readonly name: string;
        readonly artists: Artist[];
        readonly num_tracks: number;
        readonly num_discs: number;
        readonly date: string;
        readonly musicbrainz_id: string;
    }

    class Image {
        readonly uri: URI;
        readonly width: number;
        readonly height: number;
    }

    export class Playlist {
        readonly uri: URI;
        readonly name: string;
        readonly tracks: Track[];
        readonly last_modified: number;
        readonly length: number;
    }

    export class Ref {
        readonly uri: URI;
        name?: string;
        readonly type: ModelType;
    }
}
export default models

export namespace core {
    export type PlaybackState = "playing" | "paused" | "stopped";
    type QueryField =
        | "uri"
        | "track_name"
        | "album"
        | "artist"
        | "albumartist"
        | "composer"
        | "performer"
        | "track_no"
        | "genre"
        | "date"
        | "comment"
        | "any";
    type Query = { [key in QueryField]?: string[] };


}

function snakeToCamel(name: string) {
  return name.replace(/(_[a-z])/g, (match) =>
    match.toUpperCase().replace("_", "")
  );
}

export class Mopidy extends EventEmitter {
    _options: Options;
    private _backoffDelay: number;
    private _pendingRequests: {}; //this initialization gets stripped by rolldown!
    private _webSocket: WebSocket;
    constructor(options: Options) {
        super();
        const defaultOptions = {
            backoffDelayMin: 1000,
                backoffDelayMax: 64000,
            autoConnect: true,
            webSocketUrl: ''
        };
        this._options = this._configure({...defaultOptions, ...options});
        this._backoffDelay = this._options.backoffDelayMin;
        this._pendingRequests = {};
        this._webSocket = null;
        this._delegateEvents();
        if (this._options.autoConnect) {
            this.connect();
        }
    }

    private _configure(options: Options) {
        if(options.webSocketUrl)
            return options;

        let protocol =
            typeof document !== "undefined" && document.location.protocol === "https:"
                ? "wss://"
                : "ws://";
        let currentHost =
            (typeof document !== "undefined" && document.location.host) ||
            "localhost";
        options.webSocketUrl = `${protocol}${currentHost}/mopidy/ws`;
        return options;
    }

  _delegateEvents() {
    // Remove existing event handlers
    this.removeAllListeners("websocket:close");
    this.removeAllListeners("websocket:error");
    this.removeAllListeners("websocket:incomingMessage");
    this.removeAllListeners("websocket:open");
    this.removeAllListeners("state:offline");
    // Register basic set of event handlers
    this.on("websocket:close", this._cleanup);
    this.on("websocket:error", this._handleWebSocketError);
    this.on("websocket:incomingMessage", this._handleMessage);
    this.on("websocket:open", this._resetBackoffDelay);
    this.on("websocket:open", this._onWebsocketOpen);
    this.on("state:offline", this._reconnect);
  }

  eventOff(eventName?: string, callback?: any) {
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
      if (this._webSocket.readyState === WebSocket.OPEN) {
        return;
      }
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
    // We asynchronously process the reconnect because we don't want to start
    // emitting "reconnectionPending" events before we've finished handling the
    // "state:offline" event, which would lead to emitting the events to
    // listeners in the wrong order.
    setTimeout(() => {
      this.emit("state", [
          "reconnectionPending",
          { timeToAttempt: this._backoffDelay}
      ]);
      this.emit("reconnectionPending", {
        timeToAttempt: this._backoffDelay,
      });
      setTimeout(() => {
        this.emit("state", "reconnecting");
        this.emit("reconnecting");
        this.connect();
      }, this._backoffDelay);
      this._backoffDelay *= 2;
      if (this._backoffDelay > this._options.backoffDelayMax) {
        this._backoffDelay = this._options.backoffDelayMax;
      }
    }, 0);
  }

  _resetBackoffDelay() {
    this._backoffDelay = this._options.backoffDelayMin;
  }

  close() {
    this.eventOff("state:offline", this._reconnect);
    if (this._webSocket) {
      this._webSocket.close();
    }
  }

  _handleWebSocketError(error) {
    console.warn("WebSocket error:", error.stack || error);
  }

  send(message: Object) {
    switch (this._webSocket.readyState) {
      case WebSocket.CONNECTING:
        return Promise.reject(
          new ConnectionError("WebSocket is still connecting")
        );
      case WebSocket.CLOSING:
        return Promise.reject(
          new ConnectionError("WebSocket is closing")
        );
      case WebSocket.CLOSED:
        return Promise.reject(
          new ConnectionError("WebSocket is closed")
        );
      default:
        return new Promise((resolve, reject) => {
          const jsonRpcMessage = {
            ...message,
            jsonrpc: "2.0",
            id: this._nextRequestId(),
          };
          this._pendingRequests[jsonRpcMessage.id] = { resolve, reject };
          this._webSocket.send(JSON.stringify(jsonRpcMessage));
          this.emit("websocket:outgoingMessage", jsonRpcMessage);
        });
    }
  }

  _handleMessage(message) {
    try {
      const data = JSON.parse(message.data);
      if (Object.hasOwnProperty.call(data, "id")) {
        this._handleRpcResponse(data);
      } else if (Object.hasOwnProperty.call(data, "event")) {
        this._handleEvent(data);
      } else {
        console.warn(
          `Unknown message type received. Message was: ${message.data}`
        );
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.warn(
          `WebSocket message parsing failed. Message was: ${message.data}`
        );
      } else {
        throw error;
      }
    }
  }

  _handleRpcResponse(responseMessage) {
    if (
      !Object.hasOwnProperty.call(this._pendingRequests, responseMessage.id)
    ) {
      console.warn(
        "Unexpected response received. Message was:",
        responseMessage
      );
      return;
    }
    const { resolve, reject } = this._pendingRequests[responseMessage.id];
    delete this._pendingRequests[responseMessage.id];
    if (Object.hasOwnProperty.call(responseMessage, "result")) {
      resolve(responseMessage.result);
    } else if (Object.hasOwnProperty.call(responseMessage, "error")) {
      const error = new ServerError(responseMessage.error.message);
      error.code = responseMessage.error.code;
      error.data = responseMessage.error.data;
      reject(error);
      console.warn("Server returned error:", responseMessage.error);
    } else {
      const error = new OtherError("Response without 'result' or 'error' received");
      error.data = { response: responseMessage };
      reject(error);
      console.warn(
        "Response without 'result' or 'error' received. Message was:",
        responseMessage
      );
    }
  }

  _handleEvent(eventMessage) {
    const data = { ...eventMessage };
    delete data.event;
    const eventName = `event:${snakeToCamel(eventMessage.event)}`;
    this.emit("event", [eventName, data]);
    this.emit(eventName, data);
  }

  _onWebsocketOpen() {
    this.emit("state", "state:online");
    this.emit("state:online");
  }

    static idCounter = -1;
    _nextRequestId () {
        return ++Mopidy.idCounter;
    }

}
export class JsonRpcController extends EventEmitter {
    private _backoffDelay: number;
    private _pendingRequests: {}; //this initialization gets stripped by rolldown!
    private _webSocket: WebSocket;
    private webSocketUrl: string;
    constructor(webSocketUrl: string) {
        super();
        this.webSocketUrl = webSocketUrl;
        this._pendingRequests = {};
        this._webSocket = null;
        this.hookUpEvents();
        //this.connect(); //todo: connect AFTER construction!  > To allow for other events to hook up.
    }

    private hookUpEvents() {
        this.on("websocket:close", this.cleanup);
        this.on("websocket:error", this.handleWebSocketError);
        this.on("websocket:incomingMessage", this.handleMessage);
    }

    connect() {
        if (this._webSocket) {
            if (this._webSocket.readyState === WebSocket.OPEN) {
                return;
            }
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

    private cleanup(closeEvent) {
        Object.keys(this._pendingRequests).forEach((requestId) => {
            const { reject } = this._pendingRequests[requestId];
            delete this._pendingRequests[requestId];
            const error = new ConnectionError("WebSocket closed");
            error.closeEvent = closeEvent;
            reject(error);
        });
    }

    close() {
        if (this._webSocket) {
            this._webSocket.close();
        }
    }

    private handleWebSocketError(error) {
        console.warn("WebSocket error:", error.stack || error);
    }

    send(message: Object) {
        switch (this._webSocket.readyState) {
            case WebSocket.CONNECTING:
                return Promise.reject(
                    new ConnectionError("WebSocket is still connecting")
                );
            case WebSocket.CLOSING:
                return Promise.reject(
                    new ConnectionError("WebSocket is closing")
                );
            case WebSocket.CLOSED:
                return Promise.reject(
                    new ConnectionError("WebSocket is closed")
                );
            default:
                return new Promise((resolve, reject) => {
                    const jsonRpcMessage = {
                        ...message,
                        jsonrpc: "2.0",
                        id: this._nextRequestId(),
                    };
                    this._pendingRequests[jsonRpcMessage.id] = { resolve, reject };
                    this._webSocket.send(JSON.stringify(jsonRpcMessage));
                    this.emit("websocket:outgoingMessage", jsonRpcMessage);
                });
        }
    }

    private handleMessage(message) {
        try {
            const data = JSON.parse(message.data);
            if (Object.hasOwnProperty.call(data, "id")) {
                this.handleRpcResponse(data);
            } else if (Object.hasOwnProperty.call(data, "event")) {
                this.handleEvent(data);
            } else {
                console.warn(
                    `Unknown message type received. Message was: ${message.data}`
                );
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.warn(
                    `WebSocket message parsing failed. Message was: ${message.data}`
                );
            } else {
                throw error;
            }
        }
    }

    private handleRpcResponse(responseMessage) {
        if (
            !Object.hasOwnProperty.call(this._pendingRequests, responseMessage.id)
        ) {
            console.warn(
                "Unexpected response received. Message was:",
                responseMessage
            );
            return;
        }
        const { resolve, reject } = this._pendingRequests[responseMessage.id];
        delete this._pendingRequests[responseMessage.id];
        if (Object.hasOwnProperty.call(responseMessage, "result")) {
            resolve(responseMessage.result);
        } else if (Object.hasOwnProperty.call(responseMessage, "error")) {
            const error = new ServerError(responseMessage.error.message);
            error.code = responseMessage.error.code;
            error.data = responseMessage.error.data;
            reject(error);
            console.warn("Server returned error:", responseMessage.error);
        } else {
            const error = new OtherError("Response without 'result' or 'error' received");
            error.data = { response: responseMessage };
            reject(error);
            console.warn(
                "Response without 'result' or 'error' received. Message was:",
                responseMessage
            );
        }
    }

    private handleEvent(eventMessage) {
        const data = { ...eventMessage };
        delete data.event;
        const eventName = `event:${snakeToCamel(eventMessage.event)}`;
        this.emit("event", [eventName, data]);
        this.emit(eventName, data);
    }

    static idCounter = -1;
    _nextRequestId () {
        return ++Mopidy.idCounter;
    }
}

class ConnectionError extends Error {
    closeEvent?: any;
    constructor(message) {
        super(message);
        this.name = "ConnectionError";
    }
}

class ServerError extends Error {
    code: any;
    data: any;
    constructor(message) {
        super(message);
        this.name = "ServerError";
    }
}

class OtherError extends Error {
    data: any;
    constructor(message) {
        super(message);
        this.name = "OtherError";
    }
}
