import models, {Branded} from "../js/mopidy";
import {BreadCrumb} from "./breadCrumb";
import Ref = models.Ref;
import Image = models.Image;
import Artist = models.Artist;

declare const __brand: unique symbol;

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

export type ItemType =  "None" | "File" | "Stream" | "Album";

export type FilterBreadCrumbTypeName = "home" | "browseFilter" | "ref";

export class BrowseFilterBreadCrumb<T> extends BreadCrumb<T, FilterBreadCrumbTypeName> {
    constructor(label: string, filter: T, type: FilterBreadCrumbTypeName) {
        super(label, filter, type);
    }
}

export type Uri = string;
export class BreadCrumbHome extends BrowseFilterBreadCrumb<null> {
    constructor() {
        super("Home", null, "home");
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
export type FilterBreadCrumb = BreadCrumbRef<AllUris> | BreadCrumbBrowseFilter | BreadCrumbHome;

export function isBreadCrumbForAlbum(breadCrumb: BreadCrumbRef<AllUris>): breadCrumb is BreadCrumbRef<AlbumUri> {
    return breadCrumb.data.type == "album";
}
export function isBreadCrumbForArtist(breadCrumb: BreadCrumbRef<AllUris>): breadCrumb is BreadCrumbRef<ArtistUri> {
    return breadCrumb.data.type == "artist";
}

export type ImageLookup = {[string: AllUris]: Image[]}

export interface BrowseFilterFlags {
    album: boolean;
    track: boolean;
    radio: boolean;
    artist: boolean;
    playlist: boolean;
    genre: boolean;
}

export class BrowseFilter implements BrowseFilterFlags{
    searchText: string;
    album: boolean;
    track: boolean;
    radio: boolean;
    artist: boolean;
    playlist: boolean;
    genre: boolean;
    addedSince: number;

    constructor() {
        this.searchText = "";
        this.track = false;
        this.artist = false;
        this.genre = false;
        this.radio = false;
        this.playlist = false;
        this.album = false;
        this.addedSince = 0;
    }

    isNoTypeSelected(): boolean {
        return !(this.album || this.track || this.radio || this.artist || this.playlist || this.genre);
    }

    isAllTypesSelected(): boolean {
        return this.album && this.track && this.radio && this.artist && this.playlist && this.genre;
    }

    getSelectedFilters() {
        return ["album", "track", "radio", "artist", "playlist", "genre"].filter(key => this[key as keyof BrowseFilterFlags] == true);
    }

    isEmpty(): boolean {
        return (
            this.isNoTypeSelected()
            || this.isAllTypesSelected()
        )
        && this.searchText == "";
    }
}

export interface PartialAlbumModel {
    type: "album";
    tracks: TrackUri[];
    albumInfo: models.Album | null;
}

export interface AlbumModel extends PartialAlbumModel {
    imageUrl: string;
}

export interface FileTrackModel {
    type: "file";
    track: models.Track;
    title: string,
    composer?: string,
    performer: string,
    songlenght: number,
}

export interface PartialStreamTrackModel {
    type: "stream";
    track: models.Track;
    name: string,
}

export interface StreamTrackModel extends PartialStreamTrackModel {
    imageUrl: string,
}

export interface NoneTrackModel {
    type: "none";
}

export const TrackNone = {type: "none"} as NoneTrackModel;

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

export class ExpandedAlbumModel {
    album: AlbumModel;
    tracks: FileTrackModel[];
    meta: AlbumMetaData | null;

    constructor(album: AlbumModel, tracks: FileTrackModel[], meta: AlbumMetaData | null) {
        this.album = album;
        this.tracks = tracks;
        this.meta = meta;
    }

    get genres(): string[] {
        return [...new Set(this.tracks
            .filter(track => track.track.genre != undefined)
            .map(track => track.track.genre as string))];
    }
    get artists()  {
        let artistMap: Map<string, Artist> = new Map();
        this.tracks
            .map(track => track.track.artists?? [])
            .flat()
            .forEach(artist => artistMap.set(artist.name, artist));
        return [...artistMap.values()]
    }

    get composers() {
        let artistMap: Map<string, Artist> = new Map();
        this.tracks
            .map(track => track.track.composers?? [])
            .flat()
            .forEach(artist => artistMap.set(artist.name, artist));
        return [...artistMap.values()]
    }
}

export interface ExpandedHistoryLineGroup {
    remembered: boolean,
    lines: string[]
}
export interface ExpandedStreamModel {
    stream: StreamTrackModel,
    historyLines: ExpandedHistoryLineGroup[]
}

export function isInstanceOfExpandedStreamModel(model: ExpandedAlbumModel | ExpandedStreamModel | ExpandedFileTrackModel | null): model is ExpandedStreamModel {
    if(!model) return false;
    return 'stream' in model;
}

export function isInstanceOfExpandedTrackModel(model: ExpandedAlbumModel | ExpandedStreamModel | ExpandedFileTrackModel | null): model is ExpandedFileTrackModel {
    if(!model) return false;
    return 'track' in model;
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

export type PlayState = "stopped" | "playing" | "paused" | "unknown"; //todo: "unknown" is not a mopidy state but a local one. Split up type?

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
    Album = "#Album",
    Settings = "#Settings",
}

export interface GenreDef {
    ref: Ref<GenreUri>;
    replacement: string | null;
}