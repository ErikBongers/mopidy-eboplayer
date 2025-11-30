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
    genres: Ref[];
    searchResults: SearchResult[];
    lastFilter: BrowseFilter | undefined;

    constructor( roots: Ref[], sub: Ref[], tracks: Ref[], albums: Ref[], artists: Ref[], genres: Ref[]) {
        this.roots = roots;
        this.sub = sub;
        this.tracks = tracks;
        this.albums = albums;
        this.artists = artists;
        this.genres = genres;
        this.searchResults = [];
    }

    filter(browseFilter: BrowseFilter) {
        //todo: perhaps do an incremental filter?
        this.lastFilter = browseFilter;
        this.searchResults = [];
        this.prefillWithTypes();
        this.searchResults.forEach(result => {
            this.calculateWeight(result);
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

    private calculateWeight(result: SearchResult) {
        if(result.ref.name.toLowerCase().startsWith(this.lastFilter.searchText.toLowerCase()))
            result.weight+= 100;
        if (result.ref.name.toLowerCase().includes(this.lastFilter.searchText.toLowerCase()))
            result.weight+= 100;
        if(!this.lastFilter.searchText)
            result.weight+= 1; //No search text? Give every result a weight of 1, so that they are always shown.
    }

    private prefillWithTypes() {
        if(this.lastFilter.album || this.lastFilter.isNoTypeSelected())
            this.searchResults.push(...this.albums.map(album => ({ref: album, weight: 0})));
        if(this.lastFilter.artist || this.lastFilter.isNoTypeSelected())
            this.searchResults.push(...this.artists.map(artist => ({ref: artist, weight: 0})));
        if(this.lastFilter.track || this.lastFilter.isNoTypeSelected())
            this.searchResults.push(...this.tracks.map(track => ({ref: track, weight: 0})));
        if(this.lastFilter.genre || this.lastFilter.isNoTypeSelected())
            this.searchResults.push(...this.genres.map(track => ({ref: track, weight: 0})));
    }
}