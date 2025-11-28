import models from "../js/mopidy";

export enum TrackType { None, File, Stream}

export interface BrowseFilter {
    searchText: string;
    album: boolean;
    track: boolean;
    radio: boolean;
    artist: boolean;
    playlist: boolean;
    genre: boolean;
}

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
    browseFilterChanged = "eboplayer.browseFilterChanged",
    refsLoaded = "eboplayer.refsLoaded",
    refsFiltered = "eboplayer.refsFiltered",
}

export type TrackModel = NoneTrackModel | FileTrackModel | StreamTrackModel;
export type DeepReadonly<T> = T extends Function ? T :
    T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
        T;

export enum ConnectionState {Offline, Online}

export enum MessageType { None, Info, Warning, Error}

export interface Message {
    type: MessageType,
    message: string
}

export interface PlaybackModesState {
    repeat: boolean,
    random: boolean,
    consume: boolean,
    single: boolean
}

export enum PlayState {
    stopped = "stopped",
    playing = "playing",
    paused = "paused"
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