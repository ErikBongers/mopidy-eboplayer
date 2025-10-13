import {models} from "../mopidy_eboplayer2/static/js/mopidy";
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
    getCurrentTrack: () => DeepReadonly<TrackModel>;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => string[];
    getHistory: () => HistoryLine[];
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

export type LibraryDict = { [index: string]: models.Track[] };

export class Model extends EventTarget implements ViewModel {
    static NoTrack: TrackModel = { type: TrackType.None } as NoneTrackModel;
    currentTrack: TrackModel = Model.NoTrack;
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
    private activeStreamLines: string[];
    private history: HistoryLine[];
    private trackList: TlTrack[] = [];
    private libraryCache: LibraryDict = {};

    constructor() {
        super();
        this.libraryCache = {};
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

    getCurrentTrack = (): DeepReadonly<TrackModel> => this.currentTrack;

    setCurrentTrack(track: TrackModel) {
        this.currentTrack = track;
        this.dispatchEvent(new Event(EboplayerEvents.currentTrackChanged));
    }

    clearCurrentTrack() {
        this.setCurrentTrack(Model.NoTrack);
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

    setActiveStreamLinesHistory(lines: string[]) {
        this.activeStreamLines = lines;
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

    addToLibraryCache(tracks: LibraryDict) {
        this.libraryCache = {...this.libraryCache, ...tracks};
    }

    getTrackFromCache(uri: string) {
        return this.libraryCache[uri];
    }
}
