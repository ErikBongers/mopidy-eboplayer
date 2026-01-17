import models from "../js/mopidy";

import {AlbumUri, AllUris, ArtistUri, BrowseFilter, GenreDef, PlaylistUri, RadioUri, TrackUri} from "./modelTypes";
import getState from "./playerState";
import Ref = models.Ref;

export type RefType = "album" | "artist" | "playlist" | "track" | "genre" | "radio";
export interface TypedRef {
    ref: Ref<AllUris>,
    type: RefType
}

export type RefSearchResult  = {
    type: "ref";
    item: TypedRef;
    weight: number;
}
export type GenreSearchResult  = {
    type: "genreDef";
    item: GenreDef;
    weight: number;
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

    protected async calculateWeight(result: SearchResult, browseFilter: BrowseFilter) {
        if (result.item.ref.name?.toLowerCase().startsWith(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (result.item.ref.name?.toLowerCase().includes(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (!browseFilter.searchText)
            result.weight += 1; //No search text? Give every result a weight of 1, so that they are always shown.
        if(result.weight > 0) {
            if(browseFilter.addedSince == 0)
                return;
            if(result.type == "ref") {
                if(browseFilter.album && result.item.type == "album") {
                    let expandedAlbum = await getState().getController().getExpandedAlbumModel(result.item.ref.uri as AlbumUri);
                    let mostRecentTrackModifiedDate = expandedAlbum.tracks
                        .filter(t => t.track.last_modified)
                        .map(t => t.track.last_modified)
                        .sort()[0];
                    if(!mostRecentTrackModifiedDate)
                        return;
                    mostRecentTrackModifiedDate /= 1000;
                    let currentPosixDate = Math.floor(Date.now() / 1000);
                    let addedSinceInSeconds = browseFilter.addedSince * 60 * 60 * 24;
                    if(currentPosixDate - mostRecentTrackModifiedDate < addedSinceInSeconds)
                        result.weight += 10;
                }
                if(browseFilter.track && result.item.type == "track")
                    result.weight += 10;
                if(browseFilter.radio && result.item.type == "radio")
                    result.weight += 10;
            }

        }
    }

    setFilter(browseFilter: BrowseFilter) {
        this._browseFilter = browseFilter;
    }

    protected async applyFilter(searchResults: SearchResult[]) {
        searchResults.forEach(result => {
            result.weight = 0;
        });
        for (const result of searchResults) {
            await this.calculateWeight(result, this.browseFilter);
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
            .map(r => r.type == "ref" ? r.item.type : "genre")
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

    static transformRefsToSearchResults(refs: Ref<AllUris>[]): SearchResult[] {
        let results = refs.map(ref => {
            let refType = SomeRefs.toRefType(ref);
            if(refType == "genre") {
                let genreDefs = getState().getModel().getGenreDefs();
                if(!genreDefs)
                    throw new Error("No genre defs found!");
                let genreDef = genreDefs.get(ref.name?? "???");
                return {
                    type: "genreDef",
                    item: genreDef,
                    weight: -1
                } as GenreSearchResult;
            }
            return {
                type: "ref",
                item: {
                    ref: ref,
                    type:SomeRefs.toRefType(ref)
                },
                weight: -1
            } as RefSearchResult;
        });
        // make genreDefs distinct and keep removed defs separate.
        return this.reduceResults(results);
    }

    static reduceResults(results: (GenreSearchResult | RefSearchResult)[]) {
        let resultsWithoutGenreDefs = results.filter(result => result.type != "genreDef"); //todo: return this list as well.
        let onlyGenreDefResults = results.filter(result => result.type == "genreDef");

        let onlyWithoutReplacementResults = onlyGenreDefResults.filter(r => r.item.replacement == null);
        let onlyWithoutReplacementResultsMap = new Map<string, GenreSearchResult>();
        onlyWithoutReplacementResults.forEach(result => {
            onlyWithoutReplacementResultsMap.set(result.item.ref.name?? "???", result);
        });

        onlyGenreDefResults.forEach(result => {
            let name: string;
            if (result.item.replacement != null) {
                name = result.item.replacement;
            } else {
                name = result.item.ref.name ?? "???";
            }
            if(!onlyWithoutReplacementResultsMap.has(name))
                onlyWithoutReplacementResultsMap.set(name, result);
        })
        return [...resultsWithoutGenreDefs, ...Array.from(onlyWithoutReplacementResultsMap.values())];
    }
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

    constructor( roots: Ref<AllUris>[], sub: Ref<AllUris>[], tracks: Ref<TrackUri>[], albums: Ref<AlbumUri>[], artists: Ref<ArtistUri>[], genres: GenreDef[], radios: Ref<RadioUri>[], playlists: Ref<PlaylistUri>[]) {
        super();
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks.map(track => ({item: {type: "track" as RefType, ref: track}, type: "ref", weight: 0}));
        this.albums = albums.map(album => ({item: {type: "album" as RefType, ref: album}, type: "ref", weight: 0}));
        this.artists = artists.map(artist => ({item: {type: "artist" as RefType, ref: artist}, type: "ref", weight: 0}));
        this.genres = Refs.reduceResults(
            genres.map(ref => ({item: ref, type: "genreDef", weight: 0}))
        );
        this.radios = radios.map(radio => ({item: {type: "radio" as RefType, ref: radio}, type: "ref", weight: 0}));
        this.playlists = playlists.map(album => ({item: {type: "playlist" as RefType, ref: album}, type: "ref", weight: 0}));
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
    availableRefTypes: Set<RefType>

    constructor(refs: Ref<AllUris>[]) {
        super();
        this.allresults = Refs.transformRefsToSearchResults(refs);
        this.availableRefTypes = this.getAvailableRefTypes(this.allresults);
    }

    async filter() {
        this.searchResults = {
            refs: await this.applyFilter(this.allresults),
            availableRefTypes: this.availableRefTypes
        };
    }
}

