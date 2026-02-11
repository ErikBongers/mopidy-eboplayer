import models, {Branded} from "../js/mopidy";
import {BreadCrumb} from "./breadCrumb";
import {ExpandedRef} from "./refs";
import {Controller} from "./controllers/controller";
import {getBaseUrl, getDefaultImageUrl} from "./global";
import Ref = models.Ref;
import Image = models.Image;
import Artist = models.Artist;

declare const __brand: unique symbol;

export type RememberId = Branded<string, "RememberId">;

export interface RememberDef {
    id: RememberId,
    text: string,
}

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

export interface AlbumModel {
    type: "album";
    tracks: TrackUri[];
    albumInfo: models.Album | null;
    ref: ExpandedRef
}

export interface FileTrackModel {
    type: "file";
    track: models.Track;
    title: string;
    composer?: string;
    performer: string;
    songlenght: number;
    ref: ExpandedRef;
}

export interface StreamTrackModel {
    type: "stream";
    track: models.Track;
    name: string;
    ref: ExpandedRef;
}

export interface NoneTrackModel {
    type: "none";
}

export const TrackNone = {type: "none"} as NoneTrackModel;

export class ExpandedFileTrackModel {
    track: FileTrackModel;
    album: AlbumModel | null;

    constructor(track: FileTrackModel, album: AlbumModel | null) {
        this.track = track;
        this.album = album;
    }

    get bigImageUrl() {
        return getBaseUrl() +  "/eboback/image/" + (this.track.ref.idMaxImage);
    }
}

export class ExpandedStreamModel {
    stream: StreamTrackModel;
    historyLines: ExpandedHistoryLineGroup[];

    constructor(stream: StreamTrackModel, historyLinew: ExpandedHistoryLineGroup[]) {
        this.stream = stream;
        this.historyLines = historyLinew;
    }

    get bigImageUrl() {
        return getBaseUrl() + "/eboback/image/" + (this.stream.ref?.idMaxImage?? "-- no expanded ref or image --");
    }
}

export interface AlbumMetaData {
    showTrackNumbers: boolean,
    albumTitle: string,
    imageFile: string
}

export interface CachedAlbumMetaData {
    meta: AlbumMetaData | null,
}

export class ExpandedAlbumModel {
    album: AlbumModel;
    meta: AlbumMetaData | null;
    controller: Controller;

    constructor(album: AlbumModel, controller: Controller, meta: AlbumMetaData | null) {
        this.album = album;
        this.controller = controller;
        this.meta = meta;
    }

    get bigImageUrl(): string {
        if(this.album.ref.idMaxImage)
            return getBaseUrl() + "/eboback/image/" + this.album.ref.idMaxImage;
        return getDefaultImageUrl(this.album.ref.refType);
    }

    async getTrackModels() {
        let trackModels: FileTrackModel[] = [];
        for(let trackUri of this.album.tracks) {
            let model = await this.controller.lookupTrackCached(trackUri);
            if(model)
                trackModels.push(model as FileTrackModel);
        }
        return trackModels;
    }

    async getGenres(): Promise<GenreDef[]> {
        let trackModels = await this.getTrackModels();
        let genreDefPromises = [...new Set(trackModels
            .filter(track => track.track.genre != undefined)
            .map(track => track.track.genre as string))]
            .map(async genre => (await this.controller.getGenreDefsCached()).get(genre))
            .filter(genre => genre != undefined) as Promise<GenreDef>[];
        return Promise.all(genreDefPromises);
    }

    async getArtists()  {
        let trackModels = await this.getTrackModels();
        let artistMap: Map<string, Artist> = new Map();
        trackModels
            .map(track => track.track.artists?? [])
            .flat()
            .forEach(artist => artistMap.set(artist.name, artist));
        return [...artistMap.values()]
    }

    async getComposers() {
        let trackModels = await this.getTrackModels();
        let artistMap: Map<string, Artist> = new Map();
        trackModels
            .map(track => track.track.composers?? [])
            .flat()
            .forEach(artist => artistMap.set(artist.name, artist));
        return [...artistMap.values()]
    }

    /// using this function forces all data to be collected in one 'transaction', avoiding a race condition in between async calls.
    async getAllDetails() {
        let all = await Promise.all([this.getTrackModels(), this.getArtists(), this.getComposers(), this.getGenres()]);
        return {tracks: all[0], artists: all[1], composers: all[2], genreDefs: all[3]};
    }
}

export interface ExpandedHistoryLineGroup {
    remembered: boolean,
    lines: string[]
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

export interface MopidyHistoryLine {
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
    WhatsNew = "#WhatsNew",
    Remembered = "#Remembered",
}

export interface GenreDef {
    ref: Ref<GenreUri>;
    replacement: string | null;
}

export interface HistoryLineDef {
    moment: Date;
    type: "track"; //todo: other types?
    uri: TrackUri;
    name: string;
    ref_count: number;
    album: string;
    artist: string;
}

export enum EboPlayerDataType {//todo: move to types.
    Volume,
    CurrentTrack,
    PlayState,
    TrackList,
}