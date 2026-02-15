// Type definitions for js v1.2.0, Mopidy v3.0.2 WebSocket API

import {JsonRpcController} from "../typescript/jsonRpcController";
import {AlbumUri, AllUris, StreamUri, TrackUri} from "../typescript/modelTypes";
import MopidyEventName = core.MopidyEventName;

export type Branded<T, Brand> = T & { __brand: Brand };

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
    webSocketUrl?: string | null;
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


export interface ResolvedOptions {
    webSocketUrl: string;
    autoConnect: boolean;
    backoffDelayMin: number;
    backoffDelayMax: number;
}

type URI = string;
export type TlId = Branded<number, "TlId">;
namespace models {
    export type ModelType = "album" | "artist" | "directory" | "playlist" | "track";

    export class TlTrack {
        readonly tlid: TlId;
        readonly track: Track;
    }
    export class Track {
        readonly uri: TrackUri | StreamUri;
        readonly name?: string;
        readonly artists: Artist[];
        readonly album?: Album;
        readonly composers: Artist[];
        readonly performers: Artist[];
        readonly genre?: string;
        readonly track_no?: number;
        readonly disc_no?: number;
        readonly date?: string;
        readonly length?: number;
        readonly bitrate?: string;
        readonly comment?: string;
        readonly musicbrainz_id?: string;
        readonly last_modified?: number;
    }
    export class SearchResult {
        readonly uri: URI;
        readonly tracks: Track[];
        readonly artists: Artist[];
        readonly albums: Album[];
    }

    export class Artist {
        readonly uri: URI;
        readonly name: string;
        readonly sortname: string;
        readonly musicbrainz_id: string;
    }

    export class Album {
        readonly uri: AlbumUri;
        readonly name: string;
        readonly artists: Artist[];
        readonly num_tracks: number;
        readonly num_discs: number;
        readonly date: string;
        readonly musicbrainz_id: string;
    }

    export class Image {
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

    export class Ref<T extends AllUris> {
        readonly uri: T;
        name?: string;
        readonly type: ModelType;
    }

    export type Dict<T> =
        { length: number }
        & { [k: string]: T };
}
export default models

export namespace core {
    export type PlaybackState = "playing" | "paused" | "stopped";
    export type QueryField =
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
    export type Query = { [key in QueryField]?: string[] };

    export type MopidyEventName =
        | "event:trackPlaybackStarted"
        | "event:trackPlaybackEnded"
        | "event:trackPlaybackResumed"
        | "state:online"
        | "state:offline"
        | "event:optionsChanged"
        | "event:playlistChanged"
        | "event:playlistDeleted"
        | "event:volumeChanged"
        | "event:muteChanged"
        | "event:streamTitleChanged"
        | "event:playbackStateChanged"
        | "event:optionsValidationError"
        | "event:tracklistChanged"
        | "event:seeked"
        | "event:playlistsLoaded"
        ;

    export type FilterField = 'tlid' | "uri";
    export type FilterCriteria = {
        [key in FilterField]?: string[];
    }

}

export class Mopidy {
    _options: ResolvedOptions;
    private rpcController: JsonRpcController;
    constructor(options: Options) {
        this._options = this._configure(options);
        this.rpcController = new JsonRpcController(this._options.webSocketUrl, this._options.backoffDelayMin, this._options.backoffDelayMax);
        this._delegateEvents();
        if (this._options.autoConnect) {
            this.connect();
        }
    }

    connect() {
        this.rpcController.connect();
    }

    on(name: MopidyEventName | Function, callback?: any) {
        this.rpcController?.on(name, callback);
    }

    private _configure(options: Options): ResolvedOptions {
        let defaultOptions: ResolvedOptions = {
            backoffDelayMin: 1000,
            backoffDelayMax: 64000,
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

    private resolveWebSocketUrl(options: Options): string {
        if(options.webSocketUrl)
            return options.webSocketUrl;

        let protocol =
            typeof document !== "undefined" && document.location.protocol === "https:"
                ? "wss://"
                : "ws://";
        let currentHost =
            (typeof document !== "undefined" && document.location.host) ||
            "localhost";
        return `${protocol}${currentHost}/mopidy/ws`;
    }

    _delegateEvents() {
        this.rpcController.on("websocket:close", (closeEvent: any) => this.onWebSocketClose(closeEvent));
        this.rpcController.on("websocket:open", () => this._onWebsocketOpen());
    }

    onWebSocketClose(closeEvent: any) {
        this.rpcController.emit("state", "state:offline");
        this.rpcController.emit("state:offline");
    }

    close() {
        if (this.rpcController) {
            this.rpcController.close();
        }
    }

    send(method: string, params?: Object) {
        if(params)
            return this.rpcController?.send({method, params});
        else
            return this.rpcController?.send({method});
    }

    _onWebsocketOpen() {
    this.rpcController.emit("state", "state:online");
    this.rpcController.emit("state:online");
  }
}