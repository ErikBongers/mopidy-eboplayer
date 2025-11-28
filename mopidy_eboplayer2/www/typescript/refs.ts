import models from "../js/mopidy";
import Ref = models.Ref;

import {BrowseFilter} from "./modelTypes";

export interface SearchResult {
    ref: Ref;
    weight: number;
}

export class Refs {
    roots: Ref[];
    sub: Ref[];
    tracks: Ref[];
    albums: Ref[];
    artists: Ref[];
    searchResults: SearchResult[];
    lastFilter: BrowseFilter | undefined;

    constructor( roots: Ref[], sub: Ref[], tracks: Ref[], albums: Ref[], artists: Ref[]) {
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks;
        this.albums = albums;
        this.artists = artists;
        this.searchResults = [];
    }

    filter(browseFilter: BrowseFilter) {
        //todo: perhaps do an incremental filter?
        this.lastFilter = browseFilter;
        this.searchResults = [];
        this.prefillWithTypes();
        if(this.lastFilter.searchText) {
            this.searchResults.forEach(result => {
                this.calculateWeight(result);
            });
        }
        this.searchResults.sort((a, b) => b.weight - a.weight);
    }

    private calculateWeight(result: SearchResult) {
        if(result.ref.name.toLowerCase().startsWith(this.lastFilter.searchText.toLowerCase()))
            result.weight+= 100;
        if (result.ref.name.toLowerCase().includes(this.lastFilter.searchText.toLowerCase()))
            result.weight+= 100;
    }

    private prefillWithTypes() {
        if(this.lastFilter.album)
            this.searchResults.push(...this.albums.map(album => ({ref: album, weight: 0})));
        if(this.lastFilter.artist)
            this.searchResults.push(...this.artists.map(artist => ({ref: artist, weight: 0})));
        if(this.lastFilter.track)
            this.searchResults.push(...this.tracks.map(track => ({ref: track, weight: 0})));
        //todo: genres.
    }
}