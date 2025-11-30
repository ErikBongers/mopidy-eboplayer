import models from "../js/mopidy";
import Ref = models.Ref;

import {BrowseFilter} from "./modelTypes";

export interface SearchResult {
    ref: Ref;
    weight: number;
}

export abstract class Refs {

    abstract filter(browseFilter: BrowseFilter): void;
    abstract getSearchResults(): SearchResult[];

    protected calculateWeight(result: SearchResult, browseFilter: BrowseFilter) {
        if (result.ref.name.toLowerCase().startsWith(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (result.ref.name.toLowerCase().includes(browseFilter.searchText.toLowerCase()))
            result.weight += 100;
        if (!browseFilter.searchText)
            result.weight += 1; //No search text? Give every result a weight of 1, so that they are always shown.
    }
}

export class AllRefs extends Refs {
    roots: Ref[];
    sub: Ref[];
    tracks: Ref[];
    albums: Ref[];
    artists: Ref[];
    genres: Ref[];
    searchResults: SearchResult[];

    constructor( roots: Ref[], sub: Ref[], tracks: Ref[], albums: Ref[], artists: Ref[], genres: Ref[]) {
        super();
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks;
        this.albums = albums;
        this.artists = artists;
        this.genres = genres;
        this.searchResults = [];
    }

    filter(browseFilter: BrowseFilter) {
        this.searchResults = [];
        this.prefillWithTypes(browseFilter);
        this.searchResults.forEach(result => {
            this.calculateWeight(result, browseFilter);
        });
        this.searchResults = this.searchResults
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

    private prefillWithTypes(browseFilter: BrowseFilter) {
        if(browseFilter.album || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.albums.map(album => ({ref: album, weight: 0})));
        if(browseFilter.artist || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.artists.map(artist => ({ref: artist, weight: 0})));
        if(browseFilter.track || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.tracks.map(track => ({ref: track, weight: 0})));
        if(browseFilter.genre || browseFilter.isNoTypeSelected())
            this.searchResults.push(...this.genres.map(track => ({ref: track, weight: 0})));
    }
}