import models from "../js/mopidy";

import {AlbumUri, AllUris, ArtistUri, BrowseFilter, ExpandedAlbumModel, ExpandedFileTrackModel, ExpandedStreamModel, GenreDef, GenreUri, PlaylistUri, RadioUri, TrackUri} from "./modelTypes";
import Ref = models.Ref;
import {Controller} from "./controllers/controller";
import {ViewModel} from "./model";

export type RefType = "album" | "artist" | "playlist" | "track" | "genre" | "radio";
export interface ExpandedRef {
    ref: Ref<AllUris>,
    type: RefType,
    lastModified: number | null,
}

abstract class SearchResultParent {
    protected type: "ref" | "genreDef";
    item: ExpandedRef;
    weight: number;
    imageUrl?: string;
    protected defaultImageUrl?: string;
    protected constructor(type: "ref" | "genreDef", item: ExpandedRef, weight: number, imageUrl?: string, defaultImageUrl?: string) {
        this.type = type;
        this.item = item;
        this.weight = weight;
        this.imageUrl = imageUrl;
        this.defaultImageUrl = defaultImageUrl;
    }

    getImageUrl(): string {
        return this.imageUrl ?? this.defaultImageUrl ?? "";
    }
}

export class RefSearchResult extends SearchResultParent {
    controller: Controller;
    constructor(item: ExpandedRef, weight: number, controller: Controller, imageUrl?: string, defaultImageUrl?: string) {
        super("ref", item, weight, imageUrl, defaultImageUrl);
        this.controller = controller;
    }
    getExpandedModel =  () => this.controller.getExpandedModel(this.item);
}

export class GenreSearchResult  extends SearchResultParent {
    controller: Controller;
    constructor(item: ExpandedRef, weight: number, controller: Controller, imageUrl?: string) {
        super("genreDef", item, weight, imageUrl, "images/icons/Genre.svg");
        this.controller = controller;
    }
    getExpandedModel() {
        return this.controller.getGenreDefCached(this.item.ref.name ?? "???");
    }
}

export type SearchResult = RefSearchResult | GenreSearchResult;

export interface SearchResults {
    refs: SearchResult[];
    availableRefTypes: Set<RefType>;
}

export const EmptySearchResults: SearchResults = {refs: [], availableRefTypes: new Set()};

export abstract class Refs {
    searchResults: SearchResults;

    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }

    protected constructor() {
        this.searchResults = { refs:[], availableRefTypes:new Set()};
    }

    set browseFilter(value: BrowseFilter) {
        this._browseFilter = value;
    }
    private _browseFilter: BrowseFilter;

    abstract filter(): Promise<void>;

    protected async calculateWeight(result: SearchResult, browseFilter: BrowseFilter, thresholdDate: number) {
        if(!browseFilter.isNoTypeSelected()) {
            if (result instanceof RefSearchResult) {
                if (result.item.type == "album" && !browseFilter.album
                    || result.item.type == "track" && !browseFilter.track
                    || result.item.type == "artist" && !browseFilter.artist
                    || result.item.type == "playlist" && !browseFilter.playlist
                    || result.item.type == "radio" && !browseFilter.radio)
                    return;
            }
            if (result instanceof GenreSearchResult && !browseFilter.genre)
                return;
        }
        if (result.item.ref.name?.toLowerCase().startsWith(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (result.item.ref.name?.toLowerCase().includes(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (!browseFilter.searchText)
            result.weight += 1; //No search text? Give every result a weight of 1, so that they are always shown.
        if(result.weight == 0)
            return;
        if(browseFilter.addedSince == 0)
            return;
        if(!(result instanceof RefSearchResult)) {
            result.weight = 0;
            return;
        }
        if(browseFilter.addedSince == 0)
            return;
        if((browseFilter.album || browseFilter.isNoTypeSelected()) && result.item.type == "album") {
            this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
        }
        if((browseFilter.track || browseFilter.isNoTypeSelected()) && result.item.type == "track") {
            this.calculateDateFilter(result.item.lastModified, result, browseFilter, thresholdDate);
        }
        if(browseFilter.addedSince > 0 && result.item.type != "album" && result.item.type != "track")
            result.weight = 0;
    }

    protected calculateDateFilter(modifiedDate: number|null, result: SearchResult, browseFilter: BrowseFilter, thresholdDate: number) {
        if(!modifiedDate)
            return;
        modifiedDate /= 1000;
        if(thresholdDate > modifiedDate)
            result.weight = 0;
    }

    setFilter(browseFilter: BrowseFilter) {
        this._browseFilter = browseFilter;
    }

    protected async applyFilter(searchResults: SearchResult[]) {
        searchResults.forEach(result => {
            result.weight = 0;
        });

        let currentPosixDate = Math.floor(Date.now() / 1000);
        let addedSinceInSeconds = this.browseFilter.addedSince * 60 * 60 * 24;
        let thresholdDate = currentPosixDate - addedSinceInSeconds;

        for (const result of searchResults) {
            await this.calculateWeight(result, this.browseFilter, thresholdDate);
        }
        return searchResults
            .filter(result => result.weight > 0)
            .sort((a, b) => {
                if (b.weight === a.weight) {
                    return a.item.ref.name?.localeCompare(b.item.ref.name?? "")?? 0;
                }
                return b.weight - a.weight
            });
    }

    getSearchResults(): SearchResults {
        return this.searchResults;
    }

    protected getAvailableRefTypes(refs: SearchResult[]) {
        return refs
            .map(r => r instanceof RefSearchResult ? r.item.type : "genre")
            .reduce((typeSet, val) => typeSet.add(val), new Set<RefType>());
    }

    static toRefType(ref: models.Ref<AllUris>): RefType {
        if (!["directory", "track"].includes(ref.type)) {
            return ref.type as RefType;
        }
        if (ref.uri.startsWith("eboback:stream:"))
            return "radio";
        if (ref.uri.startsWith("eboback:directory?genre"))
            return "genre";
        return ref.type as RefType; //WARNING: this really is an unknown type!
    }

    static transformRefsToSearchResults(controller: Controller, refs: Ref<AllUris>[]): SearchResult[] {
        let results = refs.map(ref => {
            let refType = SomeRefs.toRefType(ref);
            if(refType == "genre") {
                let expandedRef: ExpandedRef = {ref: ref, type: refType, lastModified: null};
                return new GenreSearchResult(expandedRef,-1, controller);
            }
            let expandedRef: ExpandedRef = {ref: ref, type: refType, lastModified: null};
            return new RefSearchResult(expandedRef,-1, controller);
        });
        // make genreDefs distinct and keep removed defs separate.
        return results;
    }

    static async reduceResults(results: (GenreSearchResult | RefSearchResult)[]) {
        let resultsWithoutGenreDefs = results.filter(result => ! (result instanceof GenreSearchResult));
        let onlyGenreDefResults = results.filter(result => result instanceof GenreSearchResult);

        let onlyWithoutReplacementResults = (await Promise.all(onlyGenreDefResults
            .map(async r => {
                return {result: r, genreDef: await r.getExpandedModel()};
            })))
            .filter(r => r.genreDef != null && r.genreDef.replacement == null)
            .map(r => r.result);
        let onlyWithoutReplacementResultsMap = new Map<string, GenreSearchResult>();
        onlyWithoutReplacementResults.forEach(result => {
            onlyWithoutReplacementResultsMap.set(result.item.ref.name?? "???", result);
        });

        for (const result of onlyGenreDefResults) {
            let name: string;
            let def = await result.getExpandedModel();
            if (def?.replacement != null) {
                name = def.replacement;
            } else {
                name = result.item.ref.name ?? "???";
            }
            if(!onlyWithoutReplacementResultsMap.has(name))
                onlyWithoutReplacementResultsMap.set(name, result);
        }
        return [...resultsWithoutGenreDefs, ...Array.from(onlyWithoutReplacementResultsMap.values())];
    }
}

export async function createAllRefs(controller: Controller, roots: Ref<AllUris>[], sub: Ref<AllUris>[], tracks: Ref<TrackUri>[], albums: Ref<AlbumUri>[], artists: Ref<ArtistUri>[], genres: Map<string, GenreDef>, radios: Ref<RadioUri>[], playlists: Ref<PlaylistUri>[]) {
    let mappedTracks: RefSearchResult[] = tracks
        .map(track => ({type: "track" as RefType, ref: track, lastModified: null} as ExpandedRef))
        .map(expandedRef => {
            return new RefSearchResult(expandedRef, 0, controller);
        });
    let trackUris = tracks.map(track => track.uri);

    await controller.lookupTracksCached(trackUris); //pre-fetch
    for(let trackRef of mappedTracks) {
        if (trackRef.item.type == 'track') {
            let track = await controller.lookupTrackCached(trackRef.item.ref.uri as TrackUri);
            trackRef.item.lastModified = track?.track?.last_modified??null;
        }
    }
    let mappedAlbums: RefSearchResult[] = albums
        .map(album => ({type: "album" as RefType, ref: album, lastModified: null} as ExpandedRef))
        .map(expandedRef => {
            return new RefSearchResult(expandedRef, 0, controller);
        });
    let albumUris = albums.map(album => album.uri);
    await controller.getMetaDatasCached(albumUris); //pre-fetch
    for(let albumRef of mappedAlbums) {
        let album = await controller.getExpandedAlbumModel(albumRef.item.ref.uri as AlbumUri);
        albumRef.item.lastModified = album.mostRecentTrackModifiedDate;
    }
    let genreResults = await Refs.reduceResults(
        [...genres.values()].map(ref => {
            let expandedRef: ExpandedRef = {ref: ref.ref, type: "genre", lastModified: null};
            return  new GenreSearchResult(expandedRef, 0, controller);
        })
    );
    return new AllRefs(controller, roots, sub, mappedTracks, mappedAlbums, artists, genreResults, radios, playlists);
}

export class AllRefs extends Refs {
    roots: Ref<AllUris>[]; //todo: is DirectoryUri
    sub: Ref<AllUris>[];
    tracks: SearchResult[];
    albums: SearchResult[];
    artists: SearchResult[];
    genres: SearchResult[];
    radios: SearchResult[];
    playlists: SearchResult[];
    availableRefTypes: Set<RefType>;

    constructor(controller: Controller, roots: Ref<AllUris>[], sub: Ref<AllUris>[], tracks: RefSearchResult[], albums: RefSearchResult[], artists: Ref<ArtistUri>[], genres: SearchResult[], radios: Ref<RadioUri>[], playlists: Ref<PlaylistUri>[]) {
        super();
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks;
        this.albums = albums;
        this.artists = artists
            .map(artist => ({type: "artist" as RefType, ref: artist, lastModified: null}) as ExpandedRef)
            .map(expandedRef => new RefSearchResult(expandedRef, 0, controller));
        this.genres = genres;
        this.radios = radios
            .map(radio => ({type: "radio" as RefType, ref: radio, lastModified: null} as ExpandedRef))
            .map(expandedRef => new RefSearchResult(expandedRef, 0, controller));
        this.playlists = playlists
            .map(album => ({type: "playlist" as RefType, ref: album, lastModified: null} as ExpandedRef))
            .map(expandedRef => new RefSearchResult(expandedRef, 0, controller));
        this.availableRefTypes = new Set();

        this.getAvailableRefTypes(this.tracks).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.albums).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.artists).forEach(type => this.availableRefTypes.add(type));
        if(this.genres.length)
            this.availableRefTypes.add("genre");
        this.getAvailableRefTypes(this.radios).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.playlists).forEach(type => this.availableRefTypes.add(type));
    }

    async filter() {
        this.searchResults = {
            refs: await this.applyFilter(this.prefillWithTypes(this.browseFilter)),
            availableRefTypes: this.availableRefTypes
        };
    }

    private prefillWithTypes(browseFilter: BrowseFilter): SearchResult[] {
        let refs: SearchResult[] =  [];
        if(browseFilter.album || browseFilter.isNoTypeSelected())
            refs.push(...this.albums);
        if(browseFilter.artist || browseFilter.isNoTypeSelected())
            refs.push(...this.artists);
        if(browseFilter.track || browseFilter.isNoTypeSelected())
            refs.push(...this.tracks);
        if(browseFilter.genre || browseFilter.isNoTypeSelected())
            refs.push(...this.genres);
        if(browseFilter.radio || browseFilter.isNoTypeSelected())
            refs.push(...this.radios);
        if(browseFilter.playlist || browseFilter.isNoTypeSelected())
            refs.push(...this.playlists);
        return refs;
    }
}

export class SomeRefs extends Refs {
    allresults: SearchResult[];
    availableRefTypes: Set<RefType>;

    constructor(controller: Controller,  refs: Ref<AllUris>[]) {
        super();
        this.allresults = Refs.transformRefsToSearchResults(controller, refs);
        this.availableRefTypes = this.getAvailableRefTypes(this.allresults);
    }

    async filter() {
        this.searchResults = {
            refs: await this.applyFilter(this.allresults),
            availableRefTypes: this.availableRefTypes
        };
    }
}

