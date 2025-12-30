import models from "../js/mopidy";
import {BreadCrumb} from "./breadCrumb";
import Ref = models.Ref;
import Image = models.Image;

declare const __brand: unique symbol;

export type Branded<T, Brand> = T & {__brand: Brand};
export type AlbumUri = Branded<string, "AlbumUri">;
export type TrackUri = Branded<string, "TrackUri">;
export type RadioUri = Branded<string, "RadioUri">;
export type PlaylistUri = Branded<string, "PlaylistUri">;
export type GenreUri = Branded<string, "GenreUri">;
export type ArtistUri = Branded<string, "ArtistUri">;
export type ImageUri = Branded<string, "ImageUri">;
export type StreamUri = Branded<string, "StreamUri">;
export type LibraryUri = Branded<string, "LibraryUri">;
export type BrowseUri = Branded<string, "BrowseUri">;

export type AllUris = AlbumUri | TrackUri | RadioUri | PlaylistUri | GenreUri | ArtistUri | ImageUri | StreamUri | LibraryUri | BrowseUri;

export enum ItemType { None, File, Stream, Album}

export type FilterBreadCrumbTypeName = "home" | "browseFilter" | "ref";

export class BrowseFilterBreadCrumb<T> extends BreadCrumb<T, FilterBreadCrumbTypeName> {
    constructor(label: string, filter: T, type: FilterBreadCrumbTypeName) {
        super(label, filter, type);
    }
}

export type Uri = string;
export class BreadCrumbHome extends BrowseFilterBreadCrumb<null> {
    constructor(label: string, filter: null) {
        super(label, filter, "home");
    }
}
export class BreadCrumbBrowseFilter extends BrowseFilterBreadCrumb<BrowseFilter> {
    constructor(label: string, filter: BrowseFilter) {
        super(label, filter, "browseFilter");
    }
}
export class BreadCrumbRef<T extends AllUris> extends BrowseFilterBreadCrumb<Ref<T>> {
    constructor(label: string, ref: Ref<T>) {
        super(label, ref, "ref");
    }
}
export type FilterBreadCrumbType = BreadCrumbRef<AllUris> | BreadCrumbBrowseFilter;

export function isBreadCrumbForAlbum(breadCrumb: BreadCrumbRef<AllUris>): breadCrumb is BreadCrumbRef<AlbumUri> {
    return breadCrumb.data.type == "album";
}
export function isBreadCrumbForArtist(breadCrumb: BreadCrumbRef<AllUris>): breadCrumb is BreadCrumbRef<ArtistUri> {
    return breadCrumb.data.type == "artist";
}

export type ImageLookup = {[string: string]: Image[]} //todo replace with [uri:string] ?

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

export interface AlbumModel {
    type: ItemType.Album;
    tracks: string[];
    albumInfo: models.Album;
    imageUrl: string;
}

export interface FileTrackModel {
    type: ItemType.File;
    track: models.Track;
    title: string,
    composer?: string,
    performer: string,
    songlenght: number,
}

export interface StreamTrackModel {
    type: ItemType.Stream;
    track: models.Track;
    name: string,
    infoLines: string[],
    imageUrl: string,
}

export interface NoneTrackModel {
    type: ItemType.None;
}

export const TrackNone = {type: ItemType.None} as NoneTrackModel;

export interface ExpandedFileTrackModel {
    track: FileTrackModel,
    album: AlbumModel,
}

export interface AlbumMetaData {
    showTrackNumbers: boolean,
    albumTitle: string,
    imageFile: string
}

export interface CachedAlbumMetaData {
    meta?: AlbumMetaData,
}

export interface ExpandedAlbumModel {
    album: AlbumModel,
    tracks: FileTrackModel[],
    meta: AlbumMetaData,
}

export interface ExpandedStreamModel {
    stream: StreamTrackModel,
    historyLines: string[][];
}

export function isInstanceOfExpandedStreamModel(model: ExpandedAlbumModel | ExpandedStreamModel | ExpandedFileTrackModel): model is ExpandedStreamModel {
    return 'stream' in model;
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
    paused = "paused",
    unknown = "unknown"
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

export const NoStreamTitles: StreamTitles = {uri: "", active_titles: []};

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

export interface AlbumStreamLinesLoaded {
    type: AlbumDataType.StreamLinesLoaded;
    albumTrack: models.Track;
}

export const AlbumNone: AlbumDataNone = {
    type: AlbumDataType.None
}

export type AlbumData = AlbumDataLoaded | AlbumDataNone | AlbumDataLoading | AlbumStreamLinesLoaded;

export enum Views {
    NowPlaying = "#NowPlaying",
    Browse = "#Browse",
    Album = "#Album"
}
