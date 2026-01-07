import models from "../js/mopidy";
import Ref = models.Ref;

import {AlbumUri, AllUris, ArtistUri, BrowseFilter, GenreUri, PlaylistUri, RadioUri, TrackUri} from "./modelTypes";
import Track = models.Track;
import Artist = models.Artist;

export type RefType = "album" | "artist" | "playlist" | "track" | "genre" | "radio";
export interface TypedRef {
    ref: Ref<AllUris>,
    type: RefType
}

export interface SearchResult {
    ref: TypedRef;
    weight: number;
}

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

    abstract filter(): void;

    protected calculateWeight(result: SearchResult, browseFilter: BrowseFilter) {
        if (result.ref.ref.name?.toLowerCase().startsWith(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (result.ref.ref.name?.toLowerCase().includes(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (!browseFilter.searchText)
            result.weight += 1; //No search text? Give every result a weight of 1, so that they are always shown.
    }

    setFilter(browseFilter: BrowseFilter) {
        this._browseFilter = browseFilter;
    }

    protected applyFilter(searchResults: SearchResult[]) {
        searchResults.forEach(result => {
            this.calculateWeight(result, this.browseFilter);
        });
        return searchResults
            .filter(result => result.weight > 0)
            .sort((a, b) => {
                if (b.weight === a.weight) {
                    return a.ref.ref.name?.localeCompare(b.ref.ref.name?? "")?? 0;
                }
                return b.weight - a.weight
            });
    }

    getSearchResults(): SearchResults {
        return this.searchResults;
    }

    protected getAvailableRefTypes(refs: TypedRef[]) {
        let distinctTypes = refs
            .map(r => r.type)
            .reduce((typeSet, val) => typeSet.add(val), new Set<RefType>());
        console.log(distinctTypes);
        return distinctTypes;
    }
}

export class AllRefs extends Refs {
    roots: Ref<AllUris>[]; //todo: is DirectoryUri
    sub: Ref<AllUris>[];
    tracks: TypedRef[];
    albums: TypedRef[];
    artists: TypedRef[];
    genres: TypedRef[];
    radios: TypedRef[];
    playlists: TypedRef[];
    availableRefTypes: Set<RefType>;

    constructor( roots: Ref<AllUris>[], sub: Ref<AllUris>[], tracks: Ref<TrackUri>[], albums: Ref<AlbumUri>[], artists: Ref<ArtistUri>[], genres: Ref<GenreUri>[], radios: Ref<RadioUri>[], playlists: Ref<PlaylistUri>[]) {
        super();
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks.map(track => ({type: "track" as RefType, ref: track}));
        this.albums = albums.map(album => ({type: "album" as RefType, ref: album}));
        this.artists = artists.map(artist => ({type: "artist" as RefType, ref: artist}));
        this.genres = genres.map(genre => ({type: "genre" as RefType, ref: genre}));
        this.radios = radios.map(radio => ({type: "radio" as RefType, ref: radio}));
        this.playlists = playlists.map(album => ({type: "playlist" as RefType, ref: album}));
        this.availableRefTypes = new Set();
        this.getAvailableRefTypes(this.tracks).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.albums).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.artists).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.genres).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.radios).forEach(type => this.availableRefTypes.add(type));
        this.getAvailableRefTypes(this.playlists).forEach(type => this.availableRefTypes.add(type));
    }

    filter() {
        this.searchResults = {
            refs: this.applyFilter(this.prefillWithTypes(this.browseFilter)),
            availableRefTypes: this.availableRefTypes
        };
    }

    private prefillWithTypes(browseFilter: BrowseFilter): SearchResult[] {
        let refs: SearchResult[] =  [];
        if(browseFilter.album || browseFilter.isNoTypeSelected())
            refs.push(...this.albums.map(ref => ({ref, weight: 0})));
        if(browseFilter.artist || browseFilter.isNoTypeSelected())
            refs.push(...this.artists.map(ref => ({ref, weight: 0})));
        if(browseFilter.track || browseFilter.isNoTypeSelected())
            refs.push(...this.tracks.map(ref => ({ref, weight: 0})));
        if(browseFilter.genre || browseFilter.isNoTypeSelected())
            refs.push(...this.genres.map(ref => ({ref, weight: 0})));
        if(browseFilter.radio || browseFilter.isNoTypeSelected())
            refs.push(...this.radios.map(ref => ({ref, weight: 0})));
        if(browseFilter.playlist || browseFilter.isNoTypeSelected())
            refs.push(...this.playlists.map(ref => ({ref, weight: 0})));
        return refs;
    }
}

export class SomeRefs extends Refs {
    refs: TypedRef[];
    availableRefTypes: Set<RefType>

    constructor(refs: Ref<AllUris>[]) {
        super();
        this.refs = refs.map(r => {
            return {ref: r, type: SomeRefs.toRefType(r)};
        });
        this.availableRefTypes = this.getAvailableRefTypes(this.refs);
    }

    static toRefType(ref: models.Ref<AllUris>): RefType {
        if(!["directory", "track"].includes(ref.type)) {
            return ref.type as RefType;
        }
        if(ref.uri.startsWith("eboback:stream:"))
            return "radio";
        if(ref.uri.startsWith("eboback:directory?genre"))
            return "genre";
        return ref.type as RefType; //WARNING: this really is an unknown type!
    }

    filter() {
        this.searchResults = {
            refs: this.applyFilter(this.refs.map(ref => ({ref: ref, weight: 0}))),
            availableRefTypes: this.availableRefTypes
        };
    }
}