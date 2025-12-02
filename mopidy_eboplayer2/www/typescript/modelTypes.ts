import models from "../js/mopidy";
import {BreadCrumb} from "./breadCrumb";
import Ref = models.Ref;

export enum TrackType { None, File, Stream}

export type Uri = string;
export class BreadCrumbBrowseFilter extends BreadCrumb<BrowseFilter> {
    constructor(label: string, filter: BrowseFilter) {
        super(label, filter, "browseFilter");
    }
}
export class BreadCrumbRef extends BreadCrumb<Ref> {
    constructor(label: string, ref: Ref) {
        super(label, ref, "ref");
    }
}
export type FilterBreadCrumbType = BreadCrumbRef | BreadCrumbBrowseFilter;

export class BrowseFilter {
    searchText: string;
    album: boolean;
    track: boolean;
    radio: boolean;
    artist: boolean;
    playlist: boolean;
    genre: boolean;

    constructor() {
        this.searchText = "";
        this.track = false;
        this.artist = false;
        this.genre = false;
        this.radio = false;
        this.playlist = false;
        this.album = false;
    }

    isNoTypeSelected(): boolean {
        return !(this.album || this.track || this.radio || this.artist || this.playlist || this.genre);
    }
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
    currentRefsLoaded = "eboplayer.currentRefsLoaded",
    refsFiltered = "eboplayer.refsFiltered",
    longPress = "eboplayer.longPress",
    breadCrumbsChanged = "eboplayer.breadCrumbsChanged",
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