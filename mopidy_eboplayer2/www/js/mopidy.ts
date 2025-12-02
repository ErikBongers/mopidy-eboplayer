// Type definitions for js v1.2.0, Mopidy v3.0.2 WebSocket API

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

interface StrictEvents extends core.CoreListener {
    /**
     * The events from Mopidy are also emitted under the aggregate event named
     * event.
     */
    event: (args?: unknown) => void;

    /**
     * Client state
     *
     * You can get notified about when the js client is connected to the
     * server and ready for method calls, when it's offline, and when it's
     * trying to reconnect to the server by looking at the events
     */
    "state:online": () => void;
    "state:offline": () => void;
    reconnectionPending: ({ timeToAttempt }: { timeToAttempt: number }) => void;
    reconnecting: () => void;
    /**
     * The client state events are also emitted under the aggregate event named
     * state.
     */
    state: (args?: unknown) => void;

    /**
     * WebSocket events
     *
     * You can introspect what happens internally on the WebSocket by looking at
     * the events.
     *
     * Of course, you can also do this using the web developer tools in any
     * modern browser.
     */
    "websocket:close": any;
    "websocket:error": any;
    "websocket:incomingMessage": any;
    "websocket:open": any;
    "websocket:outgoingMessage": any;
}

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

    // ----------------- Events -----------------

    /**
     * Core events
     *
     * You can get events sent from the Mopidy server by looking at the events
     * with the name prefix 'event:'
     */
    export interface CoreListener {
        /**
         * Called whenever the mute state is changed.
         */
        "event:muteChanged": ({
                                  mute,
                              }: {
            /**
             * the new mute state
             */
            mute: boolean;
        }) => void;
        "event:optionsChanged": () => void;
        "event:playbackStateChanged": ({
                                           old_state,
                                           new_state,
                                       }: {
            old_state: PlaybackState;
            new_state: PlaybackState;
        }) => void;
        "event:playlistChanged": ({
                                      playlist,
                                  }: {
            playlist: models.Playlist;
        }) => void;
        "event:playlistDeleted": ({
                                      /**
                                       * the URI of the deleted playlist
                                       */
                                      uri,
                                  }: {
            uri: URI;
        }) => void;
        "event:playlistsLoaded": () => void;
        /**
         * Called whenever the time position changes by an unexpected amount, e.g.
         * at seek to a new time position.
         */
        "event:seeked": ({
                             /**
                              * the position that was seeked to in milliseconds
                              */
                             time_position,
                         }: {
            time_position: number;
        }) => void;
        /**
         * Called whenever the currently playing stream title changes.
         */
        "event:streamTitleChanged": ({
                                         /**
                                          * the new stream title
                                          */
                                         title,
                                     }: {
            title: string;
        }) => void;

        /**
         * Called whenever playback of a track ends.
         */
        "event:trackPlaybackEnded": ({
                                         /**
                                          * the track that was played before playback stopped
                                          */
                                         tl_track,
                                         /**
                                          * the time position in milliseconds
                                          */
                                         time_position,
                                     }: {
            tl_track: models.TlTrack;
            time_position: number;
        }) => void;
        /**
         * Called whenever track playback is paused.
         */
        "event:trackPlaybackPaused": ({
                                          /**
                                           * the track that was playing when playback paused
                                           */
                                          tl_track,
                                          /**
                                           * the time position in milliseconds
                                           */
                                          time_position,
                                      }: {
            tl_track: models.TlTrack;
            time_position: number;
        }) => void;
        /**
         * Called whenever track playback is resumed.
         */
        "event:trackPlaybackResumed": ({
                                           /**
                                            * the track that was playing when playback resumed
                                            */
                                           tl_track,
                                           /**
                                            * the time position in milliseconds
                                            */
                                           time_position,
                                       }: {
            tl_track: models.TlTrack;
            time_position: number;
        }) => void;
        /**
         * Called whenever a new track starts playing.
         */
        "event:trackPlaybackStarted": ({
                                           /**
                                            * the track that just started playing
                                            */
                                           tl_track,
                                       }: {
            tl_track: models.TlTrack;
        }) => void;
        /**
         * Called whenever the tracklist is changed.
         */
        "event:tracklistChanged": () => void;
        /**
         * Called whenever the volume is changed.
         */
        "event:volumeChanged": ({
                                    /**
                                     * the new volume in the range [0..100]
                                     */
                                    volume,
                                }: {
            volume: number;
        }) => void;
    }

    // ----------------- CONTROLLERS -----------------

    // https://docs.mopidy.com/en/latest/api/core/#tracklist-controller
    interface TracklistController {
        /**
         * Add tracks to the tracklist.
         *
         * If `uris` is given instead of `tracks`, the URIs are looked up in the library
         * and the resulting tracks are added to the tracklist.
         *
         * If `at_position` is given, the tracks are inserted at the given position in
         * the tracklist. If `at_position` is not given, the tracks are appended to
         * the end of the tracklist.
         *
         * Triggers the `mopidy.core.CoreListener.tracklist_changed()` event.
         */
        add({
                tracks,
                at_position,
                uris,
            }: {
            /**
             * The tracks to add
             */
            tracks?: models.Track[];
            /**
             * The position in tracklist to add tracks
             */
            at_position?: number;
            /**
             * list of URIs for tracks to add
             */
            uris?: string[];
        }): Promise<models.TlTrack[]>;

        /**
         * Remove the matching tracks from the tracklist.
         * Uses `filter()` to lookup the tracks to remove.
         *
         * Triggers the `mopidy.core.CoreListener.tracklist_changed()` event.
         */
        remove({
                   criteria,
               }: {
            /**
             * (dict, of (string, list) pairs) – one or more rules to match by
             */
            criteria: { [key: string]: string[] };
        }): Promise<models.TlTrack[]>;

        /**
         * Clear the tracklist
         *
         * Triggers the `mopidy.core.CoreListener.tracklist_changed()` event.
         */
        clear(): Promise<void>;

        /**
         * Move the tracks in the slice `[start:end]` to `to_position`.
         *
         * Triggers the `mopidy.core.CoreListener.tracklist_changed()` event.
         */
        move({
                 start,
                 end,
                 to_position,
             }: {
            /**
             * position of first track to move
             */
            start: number;
            /**
             * position after last track to move
             */
            end: number;
            /**
             * new position for the tracks
             */
            to_position: number;
        }): Promise<void>;

        /**
         * Shuffles the entire tracklist. If `start` and `end` is given
         * only shuffles the slice `[start:end]`.
         *
         * Triggers the `mopidy.core.CoreListener.tracklist_changed()` event.
         */
        shuffle({
                    start,
                    end,
                }: {
            /**
             * position of first track to shuffle
             */
            start?: number;
            /**
             * position after last track to shuffle
             */
            end?: number;
        }): Promise<void>;

        /**
         * Get tracklist as list of `mopidy.models.TlTrack`
         */
        getTlTracks(): Promise<models.TlTrack[]>;

        /**
         * The position of the given track in the tracklist.
         *
         * If neither tl_track or tlid is given we return the index of the
         * currently playing track.
         */
        index({
                  tl_track,
                  tlid,
              }: {
            /**
             * The track to find the index of
             */
            tl_track?: models.TlTrack;
            /**
             * TLID of the track to find the index of
             */
            tlid?: number;
        }): Promise<number | null>;

        /**
         * Get the tracklist version.
         *
         * Integer which is increased every time the tracklist is changed.
         * Is not reset before Mopidy is restarted.
         */
        getVersion(): Promise<number>;

        /**
         * Get length of the tracklist
         */
        getLength(): Promise<number>;

        /**
         * Get tracklist as list of `mopidy.models.Track`
         */
        getTracks(): Promise<models.Track[]>;

        /**
         * Returns a slice of the tracklist, limited by the given start and end
         * positions.
         */
        slice({
                  start,
                  end,
              }: {
            /**
             * position of first track to include in slice
             */
            start: number;
            /**
             * position after last track to include in slice
             */
            end: number;
        }): Promise<models.TlTrack[]>;

        /**
         *
         * Filter the tracklist by the given criteria.
         *
         * Each rule in the criteria consists of a model field and a list of values to compare it against. If * the model field matches any of the values, it may be returned.
         *
         * Only tracks that match all the given criteria are returned.
         */
        filter({
                   criteria,
               }: {
            /**
             * (dict, of (string, list) pairs) – one or more rules to match by
             */
            criteria: { [key: string]: string[] };
        }): Promise<models.TlTrack[]>;

        // ----------------- FUTURE STATE -----------------

        /**
         * The TLID of the track that will be played after the current track.
         *
         * Not necessarily the same TLID as returned by `get_next_tlid()`.
         */
        getEotTlid(): Promise<number | null>;

        /**
         * The tlid of the track that will be played if calling `mopidy.core.PlaybackController.next()`.
         *
         * For normal playback this is the next track in the tracklist. If repeat is enabled the next
         * track can loop around the tracklist. When random is enabled this should be a random track,
         * all tracks should be played once before the tracklist repeats.
         */
        getNextTlid(): Promise<number | null>;

        /**
         * Returns the TLID of the track that will be played if calling
         * `mopidy.core.PlaybackController.previous()`.
         *
         * For normal playback this is the previous track in the tracklist. If random and/or
         * consume is enabled it should return the current track instead.
         */
        getPreviousTlid(): Promise<number | null>;

        /**
         * The track that will be played after the given track.
         *
         * Not necessarily the same track as `next_track()`.
         */
        eotTrack({
                     tl_track,
                 }: {
            /**
             * The reference track
             */
            tl_track?: models.TlTrack;
        }): Promise<models.TlTrack | null>;

        // ----------------- DEPRECATED -----------------

        /**
         * @deprecated Deprecated since version 3.0: Use `get_next_tlid()` instead.
         */
        nextTrack({
                      tl_track,
                  }: {
            tl_track: models.TlTrack;
        }): Promise<models.TlTrack | null>;

        /**
         * @deprecated Deprecated since version 3.0: Use `get_previous_tlid()` instead.
         */
        previousTrack({
                          tl_track,
                      }: {
            tl_track: models.TlTrack;
        }): Promise<models.TlTrack | null>;

        // ----------------- OPTIONS -----------------

        /**
         * Get consume mode.
         *
         * True - Tracks are removed from the tracklist when they have been played.
         * False - Tracks are not removed from the tracklist.
         */
        getConsume(): Promise<boolean>;

        /**
         * Set consume mode.
         *
         * True - Tracks are removed from the tracklist when they have been played.
         * False - Tracks are not removed from the tracklist.
         */
        setConsume({ value }: { value: boolean }): Promise<void>;

        /**
         * Get random mode.
         */
        getRandom(): Promise<boolean>;

        /**
         * Set random mode.
         *
         * True - Tracks are selected at random from the tracklist.
         * False - Tracks are played in the order of the tracklist.
         */
        setRandom({ value }: { value: boolean }): Promise<void>;

        /**
         * Get repeat mode.
         */
        getRepeat(): Promise<boolean>;

        /**
         * Set repeat mode.
         *
         * To repeat a single track, set both `repeat` and `single`.
         */
        setRepeat({ value }: { value: boolean }): Promise<void>;

        /**
         * Get single mode
         */
        getSingle(): Promise<boolean>;

        /**
         * Set single mode.
         *
         * True - Playback is stopped after current song, unless in repeat mode.
         * False - Playback continues after current song.
         */
        setSingle({ value }: { value: boolean }): Promise<void>;
    }

    // https://docs.mopidy.com/en/latest/api/core/#playback-controller
    interface PlaybackController {
        /**
         * Play the given track, or if the given `tl_track` and `tlid` is None,
         * play the currently active track.
         *
         * Note that the track *must* already be in the tracklist.
         */
        play({
                 track,
                 tlid,
             }: {
            track?: models.TlTrack;
            tlid?: number;
        }): Promise<void>;

        /**
         * Change to the next track.
         *
         * The current playback state will be kept. If it was playing, playing will
         * continue. If it was paused, it will still be paused, etc.
         */
        next(): Promise<void>;

        /**
         * Change to the previous track.
         *
         * The current playback state will be kept. If it was playing, playing will
         * continue. If it was paused, it will still be paused, etc.
         */
        previous(): Promise<void>;

        /**
         * Stop playing.
         */
        stop(): Promise<void>;

        /**
         * Pause playback.
         */
        pause(): Promise<void>;

        /**
         * If paused, resume playing the current track.
         */
        resume(): Promise<void>;

        /**
         * Seeks to time position given in milliseconds.
         */
        seek({
                 time_position,
             }: {
            /**
             * time position in milliseconds
             */
            time_position: number;
        }): Promise<boolean>;

        // ----------------- CURRENT TRACK -----------------

        /**
         * Get the currently playing or selected track.
         */
        getCurrentTlTrack(): Promise<models.TlTrack | null>;

        /**
         * Get the currently playing or selected track.
         *
         * Extracted from `get_current_tl_track()` for convenience.
         */
        getCurrentTrack(): Promise<models.Track | null>;

        /**
         * Get the current stream title or None.
         */
        getStreamTitle(): Promise<string | null>;

        /**
         * Get time position in milliseconds.
         */
        getTimePosition(): Promise<number | null>;

        // ----------------- PLAYBACK STATES -----------------

        /**
         * Get The playback state.
         */
        getState(): Promise<PlaybackState>;

        /**
         * Set the playback state. See:
         *  https://docs.mopidy.com/en/latest/api/core/#mopidy.core.PlaybackController.set_state
         * for possible states and transitions
         */
        setState({ new_state }: { new_state: PlaybackState }): Promise<void>;
    }

    // https://docs.mopidy.com/en/latest/api/core/#library-controller
    interface LibraryController {
        /**
         * Browse directories and tracks at the given uri.
         *
         * uri is a string which represents some directory belonging to a backend.
         * To get the intial root directories for backends pass None as the URI.
         *
         * returns a list of `mopidy.models.Ref` objects for the directories and
         * tracks at the given uri.
         *
         * The Ref objects representing tracks keep the track's original URI. A
         * matching pair of objects can look like this:
         *
         *    Track(uri='dummy:/foo.mp3', name='foo', artists=..., album=...)
         *    Ref.track(uri='dummy:/foo.mp3', name='foo')
         *
         * The Ref objects representing directories have backend specific URIs.
         * These are opaque values, so no one but the backend that created them
         * should try and derive any meaning from them. The only valid exception to
         * this is checking the scheme, as it is used to route browse requests to
         * the correct backend.
         *
         * For example, the dummy library's /bar directory could be returned like
         * this:
         *
         *    `Ref.directory(uri='dummy:directory:/bar', name='bar')`
         */
        browse({
                   uri,
               }: {
            /**
             * URI to browse
             */
            uri: URI;
        }): Promise<any>;

        /**
         * Search the library for tracks where `field` contains `values`.
         *
         * `field` can be one of `uri`, `track_name`, `album`, `artist`, `albumartist`,
         * `composer`, `performer`, `track_no`, `genre`, `date`, `comment`, or `any`.
         *
         * If `uris` is given, the search is limited to results from within the URI
         * roots. For example passing `uris=['file:']` will limit the search to the
         * local backend.
         *
         * Examples:
         *
         *     # Returns results matching 'a' in any backend
         *     search({'any': ['a']})
         *
         *     # Returns results matching artist 'xyz' in any backend
         *     search({'artist': ['xyz']})
         *
         *     # Returns results matching 'a' and 'b' and artist 'xyz' in any
         *     # backend
         *     search({'any': ['a', 'b'], 'artist': ['xyz']})
         *
         *     # Returns results matching 'a' if within the given URI roots
         *     # "file:///media/music" and "spotify:"
         *     search({'any': ['a']}, uris=['file:///media/music', 'spotify:'])
         *
         *     # Returns results matching artist 'xyz' and 'abc' in any backend
         *     search({'artist': ['xyz', 'abc']})
         */
        search({
                   query,
                   uris,
                   exact,
               }: {
            /**
             * one or more queries to search for
             */
            query: Query;
            /**
             * zero or more URI roots to limit the search to
             */
            uris?: string[];
            /**
             * if the search should use exact matching
             */
            exact?: boolean;
        }): Promise<any>;

        /**
         * Lookup the given URIs.
         *
         * If the URI expands to multiple tracks, the returned list will contain them all.
         */
        lookup({
                   uris,
               }: {
            /**
             * A list of URI's
             */
            uris: string[];
        }): Promise<{ [index: string]: models.Track[] }>;

        /**
         *
         * Refresh library. Limit to URI and below if an URI is given.
         */
        refresh({ uri }: { uri?: string }): Promise<void>;

        /**
         * Lookup the images for the given URIs
         *
         * Backends can use this to return image URIs for any URI they know about be
         * it tracks, albums, playlists. The lookup result is a dictionary mapping
         * the provided URIs to lists of images.
         *
         * Unknown URIs or URIs the corresponding backend couldn't find anything for
         * will simply return an empty list for that URI.
         */
        getImages({
                      uris,
                  }: {
            /**
             * A list of URI's
             */
            uris: string[];
        }): Promise<any>;
    }

    interface PlaylistsController {
        getUriSchemes(): Promise<string[]>;

        asList(): Promise<any>;

        getItems({ uri }: { uri: string }): Promise<any>;

        lookup({ uri }: { uri: URI }): Promise<models.Playlist | null>;

        refresh({ uri_scheme }: { uri_scheme?: string }): Promise<void>;

        create({
                   name,
                   uri_scheme,
               }: {
            name: string;
            uri_scheme?: string;
        }): Promise<models.Playlist | null>;

        save({
                 playlist,
             }: {
            playlist: models.Playlist;
        }): Promise<models.Playlist | null>;

        delete({
                   uri,
               }: {
            uri: URI;
        }): Promise<boolean>;
    }

    interface MixerController {
        getMute(): Promise<boolean | null>;
        setMute({ mute }: { mute: boolean }): Promise<boolean>;
        getVolume(): Promise<number | null>;
        setVolume({ volume }: { volume: number }): Promise<boolean>;
    }

    interface HistoryController {
        getHistory(): Promise<any>;
        getLength(): Promise<number>;
    }
}

//todo: use this one instead?
// https://javascript.plainenglish.io/building-a-simple-event-emitter-in-javascript-f82f68c214ad
class EventEmitter {
    listeners = [];
    supervisors = [];

    emit(eventName: string, ...data) {
        this.listeners.filter(({name}) => name === eventName)
            .forEach(({callback}) => {
                setTimeout(() =>  callback.call(this, ...data) , 0);
            });
        this.supervisors.forEach(callback => {
            setTimeout(() => callback.call(this, ...data), 0);
        });
    }

    on(name: string | Function, callback?: any) { //todo: make callback type more specific?
        if(typeof name === 'string' && typeof callback === 'function') {
            this.listeners.push({name, callback});
            return;
        }
        if(typeof name === 'function') {
            this.supervisors.push(name);
        }
    }

    off(eventName: string, callback: any) {
        this.removeListener(eventName, callback);
    }

    destroy() {
        this.listeners.length = 0;
    }

    removeAllListeners(eventName?: string) {
        if(!eventName) {
            this.listeners.length = 0;
            return;
        }
        this.listeners = this.listeners.filter(listener => !(listener.name === eventName ));
    }

    removeListener(eventName: string, callback: any) {
        this.listeners = this.listeners.filter(listener =>
            !(listener.name === eventName &&
                listener.callback === callback)
        );
    }
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
    this.on("websocket:open", this._getApiSpec);
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
        this._handleResponse(data);
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

  _handleResponse(responseMessage) {
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

  _getApiSpec() {
    return this.send({ method: "core.describe" })
      .then(this._createApi.bind(this))
      .catch(this._handleWebSocketError.bind(this));
  }

  _createApi(methods) {
    const caller = (method) => (...args) => {
      let message = { method,
      };
      if (args.length === 0) {
        return this.send(message);
      }
      if (args.length > 1) {
        return Promise.reject(
          new Error(
            "Expected zero arguments, a single array, or a single object."
          )
        );
      }
      if (!Array.isArray(args[0]) && args[0] !== Object(args[0])) {
        return Promise.reject(new TypeError("Expected an array or an object."));
      }
      let message2 = {
          method,
          params: args
      };
      return this.send(message2);
    };

    const getPath = (fullName) => {
      let path = fullName.split(".");
      if (path.length >= 1 && path[0] === "core") {
        path = path.slice(1);
      }
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
