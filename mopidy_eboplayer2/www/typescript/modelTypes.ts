import models from "../js/mopidy";
import {BreadCrumb} from "./breadCrumb";
import Ref = models.Ref;
import Track = models.Track;
import Image = models.Image;

export enum ItemType { None, File, Stream, Album}

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

export type ImageLookup = {[string: string]: Image[]}

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
    type: ItemType.File;
    track: models.Track;
    title: string,
    composer?: string,
    performer: string,
    songlenght: number,
    imageUri: string,
    //...more properties?
}

export interface StreamTrackModel {
    type: ItemType.Stream;
    track: models.Track;
    name: string,
    infoLines: string[],
    imageUri: string,
}

export interface NoneTrackModel {
    type: ItemType.None;
}

export const TrackNone = {type: ItemType.None} as NoneTrackModel;

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
    playPressed = "eboplayer.playPressed",
    pausePressed = "eboplayer.pausePressed",
    stopPressed = "eboplayer.stopPressed",
    changingVolume = "eboplayer.changingVolume",
    viewChanged = "eboplayer.viewChanged",
    albumToViewChanged = "eboplayer.albumToViewChanged",
    albumClicked = "eboplayer.albumClicked",
    currentImageSet = "eboplayer.currentImageSet",
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

export enum AlbumDataType {
    None,
    Loading,
    Loaded,
    StreamLinesLoaded
}

interface AlbumDataNone {
    type: AlbumDataType.None;
}

interface AlbumDataLoading {
    type: AlbumDataType.Loading;
}

export interface AlbumDataLoaded {
    type: AlbumDataType.Loaded;
    album: AlbumModel;
}

export interface AlbumModel {
    type: ItemType.Album;
    tracks: FileTrackModel[];
    albumTrack?: models.Track; //todo: get rid of this
    albumInfo: models.Album;
}

export interface AlbumStreamLinesLoaded {
    type: AlbumDataType.StreamLinesLoaded;
    lines: string[][];
    albumTrack: models.Track;
}

export const AlbumNone: AlbumDataNone = {
    type: AlbumDataType.None
}
const AlbumLoading: AlbumDataLoading = {
    type: AlbumDataType.Loading
}
export type AlbumData = AlbumDataLoaded | AlbumDataNone | AlbumDataLoading | AlbumStreamLinesLoaded;

export enum Views {
    NowPlaying = "#NowPlaying",
    Browse = "#Browse",
    Album = "#Album"
}