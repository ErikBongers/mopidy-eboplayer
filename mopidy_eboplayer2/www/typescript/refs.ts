import models from "../js/mopidy";
import Ref = models.Ref;

import {AlbumUri, AllUris, ArtistUri, BrowseFilter, GenreUri, PlaylistUri, RadioUri, TrackUri} from "./modelTypes";
import Track = models.Track;
import Artist = models.Artist;

export interface SearchResult {
    ref: Ref<AllUris>;
    weight: number;
}

export abstract class Refs {
    searchResults: SearchResult[];

    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }

    protected constructor() {
        this.searchResults = [];
    }

    set browseFilter(value: BrowseFilter) {
        this._browseFilter = value;
    }
    private _browseFilter: BrowseFilter;

    abstract filter(): void;

    protected calculateWeight(result: SearchResult, browseFilter: BrowseFilter) {
        if (result.ref.name.toLowerCase().startsWith(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (result.ref.name.toLowerCase().includes(browseFilter.searchText.toLowerCase()))
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
                    return a.ref.name.localeCompare(b.ref.name);
                }
                return b.weight - a.weight
            });
    }

    getSearchResults(): SearchResult[] {
        return this.searchResults;
    }
}

export class AllRefs extends Refs {
    roots: Ref<AllUris>[]; //todo: is DirectoryUri
    sub: Ref<AllUris>[];
    tracks: Ref<TrackUri>[];
    albums: Ref<AlbumUri>[];
    artists: Ref<ArtistUri>[];
    genres: Ref<GenreUri>[];
    radioStreams: Ref<RadioUri>[];
    playlists: Ref<PlaylistUri>[];

    constructor( roots: Ref<AllUris>[], sub: Ref<AllUris>[], tracks: Ref<TrackUri>[], albums: Ref<AlbumUri>[], artists: Ref<ArtistUri>[], genres: Ref<GenreUri>[], radioStreams: Ref<RadioUri>[], playlists: Ref<PlaylistUri>[]) {
        super();
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks;
        this.albums = albums;
        this.artists = artists;
        this.genres = genres;
        this.radioStreams = radioStreams;
        this.playlists = playlists;
    }

    filter() {
        this.prefillWithTypes(this.browseFilter);
        this.searchResults = this.applyFilter(this.searchResults);
    }

    private prefillWithTypes(browseFilter: BrowseFilter) {
        this.searchResults = [];
        if(browseFilter.album || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.albums.map(album => ({ref: album, weight: 0})));
        if(browseFilter.artist || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.artists.map(artist => ({ref: artist, weight: 0})));
        if(browseFilter.track || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.tracks.map(track => ({ref: track, weight: 0})));
        if(browseFilter.genre || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.genres.map(track => ({ref: track, weight: 0})));
        if(browseFilter.radio || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.radioStreams.map(track => ({ref: track, weight: 0})));
        if(browseFilter.playlist || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.playlists.map(track => ({ref: track, weight: 0})));
    }
}

export class SomeRefs extends Refs {
    refs: Ref<AllUris>[];

    constructor(refs: Ref<AllUris>[]) {
        super();
        this.refs = refs;
    }

    filter() {
        this.searchResults = this.refs.map(ref => ({ref: ref, weight: 0}));
        this.searchResults = this.applyFilter(this.searchResults);
    }
}