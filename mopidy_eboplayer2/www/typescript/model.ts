import {models} from "../js/mopidy";
import TlTrack = models.TlTrack;

export enum TrackType { None, File, Stream}

export interface FileTrackModel {
    type: TrackType.File;
    track: models.Track;
    title: string,
    composer?: string,
    performer: string,
    songlenght: number,
    //...more properties?
}

export interface StreamTrackModel {
    type: TrackType.Stream;
    track: models.Track;
    name: string,
    infoLines: string[]
}

export interface NoneTrackModel {
    type: TrackType.None;
}

export enum EboplayerEvents {
    volumeChanged = "eboplayer.volumeChanged",
    connectionChanged = "eboplayer.connectionChanged",
    playStateChanged = "eboplayer.playbackStateChanged",
    messageChanged = "eboplayer.messageChanged",
    currentTrackChanged = "eboplayer.currentTrackChanged",
    selectedTrackChanged = "eboplayer.selectedTrackChanged",
    activeStreamLinesChanged = "eboplayer.activeStreamLinesChanged",
    historyChanged = "eboplayer.historyChanged",
    trackListChanged = "eboplayer.trackListChanged",
}

export type TrackModel  = NoneTrackModel | FileTrackModel | StreamTrackModel;

export type DeepReadonly<T> = T extends Function ? T :
    T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
        T;

export enum ConnectionState {Offline, Online}

export enum MessageType { None, Info, Warning, Error}

interface Message {
    type: MessageType,
    message: string
}

interface PlaybackModesState {
    repeat:  boolean,
    random: boolean,
    consume: boolean,
    single: boolean
}

export enum PlayState  {
    stopped  = "stopped",
    playing  =  "playing",
    paused = "paused"
}

export interface ViewModel extends EventTarget {
    getConnectionState: () => ConnectionState;
    getCurrentTrack: () => string;
    getSelectedTrack: () => string | undefined;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => StreamTitles;
    getHistory: () => HistoryLine[];
    getTrackInfo(uri: string): LibraryItem;
}

export interface HistoryRef {
    __model__: string,
    name: string;
    type: string;
    uri: string;
}
export interface HistoryLine {
    timestamp: number;
    ref: HistoryRef;
}

export type LibraryItem = models.Track[];
export type LibraryDict = { [index: string]: LibraryItem };

export interface StreamTitles {
    uri: string;
    active_titles: string[]
}

export class Model extends EventTarget implements ViewModel {
    static NoTrack: TrackModel = { type: TrackType.None } as NoneTrackModel;
    currentTrack: string;
    //note that selectedTrack is not part of the mopidy server.
    //don't set selectedTrack to currentTrack unless you want it displayed
    selectedTrack?: string;
    volume: number;
    connectionState: ConnectionState = ConnectionState.Offline;
    currentMessage: Message = {
        type: MessageType.None,
        message: ""
    };

    playbackModesState: PlaybackModesState = {
        repeat: false,
        random: false,
        consume: false,
        single: false
    }
    private playState: PlayState;
    private activeStreamLines: StreamTitles;
    private history: HistoryLine[];
    private trackList: TlTrack[] = [];
    private libraryCache: Map<string, LibraryItem> = new Map();

    constructor() {
        super();
    }

    setConnectionState(state: ConnectionState) {
        this.connectionState  = state;
        if(this.connectionState == ConnectionState.Online)
            this.clearMessage();
        else
            this.setErrorMessage("Offline");
        this.dispatchEvent(new Event(EboplayerEvents.connectionChanged));
    }

    getConnectionState = () => this.connectionState;

    getTrackInfo(uri: string): LibraryItem {
        return this.libraryCache.get(uri);
    }

    getCurrentTrack(): string {
        return this.currentTrack;
    }

    setCurrentTrack(track: TrackModel) {
        if(track.type == TrackType.None) {
            this.currentTrack = "";
            return;
        }
        this.currentTrack = track.track.uri;
        this.addToLibraryCache(this.currentTrack, [track.track]);
        this.dispatchEvent(new Event(EboplayerEvents.currentTrackChanged));
    }

    getSelectedTrack = () => this.selectedTrack;

    setSelectedTrack(uri?: string) {
        if(uri == "")
            this.selectedTrack = undefined;
        else
            this.selectedTrack = uri;
        this.dispatchEvent(new Event(EboplayerEvents.selectedTrackChanged));
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.dispatchEvent(new Event(EboplayerEvents.volumeChanged));
    }

    private setMessage(message: Message) {
        this.currentMessage = message;
        this.dispatchEvent(new Event(EboplayerEvents.messageChanged));
    }

    getCurrentMessage = () => this.currentMessage;

    clearMessage() {
        this.setMessage( { type: MessageType.None, message: ""});
    }
    setInfoMessage(message: string) {
        this.setMessage( { type: MessageType.Info, message});
    }
    setWarningMessage(message: string) {
        this.setMessage( { type: MessageType.Warning, message});
    }
    setErrorMessage(message: string) {
        this.setMessage( { type: MessageType.Error, message});
    }

    setPlaybackState(state: PlaybackModesState) {
        this.playbackModesState = {...state};
        this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
    }

    getVolume = () => this.volume;

    getPlayState(): PlayState {
        return this.playState;
    }

    setPlayState(state: PlayState) {
        this.playState = state;
        this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
    }

    setActiveStreamLinesHistory(streamTitles: StreamTitles) {
        this.activeStreamLines = streamTitles;
        this.dispatchEvent(new Event(EboplayerEvents.activeStreamLinesChanged));
    }

    getActiveStreamLines = () => this.activeStreamLines;

    setHistory(history: HistoryLine[]) {
        this.history = history;
        this.dispatchEvent(new Event(EboplayerEvents.historyChanged));
    }

    getHistory = () => this.history;

    setTrackList(trackList: TlTrack[]) {
        this.trackList = trackList;
        this.dispatchEvent(new Event(EboplayerEvents.trackListChanged));
    }
    getTrackList = () => this.trackList;

    //Doesn't overwrite
    addToLibraryCache(uri: string, item: LibraryItem) {
        if(!this.libraryCache.has(uri))
        this.libraryCache.set(uri, item);
    }

    updateLibraryCache(uri: string, item: LibraryItem) {
        this.libraryCache.set(uri, item);
    }

    //Overwrites!
    addDictToLibraryCache(dict: LibraryDict) {
        for(let key in dict) {
            this.updateLibraryCache(key, dict[key]);
        }
    }

    getTrackFromCache(uri: string) {
        return this.libraryCache.get(uri);
    }
}
