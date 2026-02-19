import {AlbumMetaData, AlbumUri, AllUris, GenreDef, GenreReplacement, HistoryLineDef, RememberDef, RememberId, StreamTitles, StreamUri, TrackUri} from "../modelTypes";
import {ExpandedRef} from "../refs";

export type AlbumMetaDict = {[uri: AlbumUri]: AlbumMetaData};

export class WebProxy {
    private ebobackBase: string;
    private eboplayerBase: string;

    constructor(hostAndPort: string) {
        this.ebobackBase = `http://${hostAndPort}/eboback/data/`;
        this.eboplayerBase = `http://${hostAndPort}/eboplayer2/`;
    }

    playerUrl(relPath: string) {
        return new URL(this.eboplayerBase+relPath);
    }
    ebobackUrl(relPath: string) {
        return new URL(this.ebobackBase+relPath);
    }

    async fetchActiveStreamLines(uri: StreamUri) {
        let url = this.playerUrl(`stream/activeLines`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        return await res.json() as StreamTitles;
    }

    async fetchAllStreamLines(uri: string) {
        let url = this.playerUrl(`stream/allLines`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        return await res.json() as string[];
    }

    async fetchMetaDatas(albumUris: AlbumUri[]) {
        let url = this.ebobackUrl(`get_album_metas`);
        //don't use url params, as max url lenght is 2048
        //don't use get aa it's body is meaningless
        let data = new FormData();
        data.append("uris", albumUris.join(","));
        let res = await fetch(url, {method: 'POST', body: data});
        let text = await res.text();
        if(text)
            return JSON.parse(text) as AlbumMetaDict;
        return {};
    }

    async fetchMetaData(albumUri: string) {
        let url = this.ebobackUrl(`get_album_meta`);
        url.searchParams.set("uri", albumUri);
        let res = await fetch(url);
        let text = await res.text();
        if(text)
            return JSON.parse(text) as AlbumMetaData;
        return null;
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: string, sequence: number) {
        let url = this.ebobackUrl(`add_ref_to_playlist`);
        //add params to body of post request
        let data = new FormData();
        data.append("playlist_uri", playlistUri);
        data.append("item_uri", itemUri);
        data.append("ref_type", refType);
        data.append("sequence", sequence.toString());
        let res = await fetch(url, {method: 'POST', body: data});
        return await res.json();
    }

    async fetchGenreReplacements() {
        let url = this.ebobackUrl(`get_genre_replacements`);
        let res = await fetch(url);
        return await res.json() as GenreReplacement[];
    }

    async fetchGenreDefs() {
        let url = this.ebobackUrl(`get_genre_defs`);
        let res = await fetch(url);
        return await res.json() as GenreDef[];
    }

    async remember(text: string) {
        let url = this.ebobackUrl(`save_remember`);
        let res = await fetch(url, {method: 'POST', body: text});
        return await res.json();
    }

    async deleteRemember(id: RememberId) {
        let url = this.ebobackUrl(`delete_remember`);
        let res = await fetch(url, {method: 'POST', body: id});
        return await res.json();
    }

    async fetchRemembers() {
        let url = this.ebobackUrl(`get_remembers`);
        let res = await fetch(url);
        return await res.json() as RememberDef[];
    }

    async fetchHistory() {
        let url = this.ebobackUrl(`get_history`);
        let res = await fetch(url);
        return await res.json() as HistoryLineDef[];
    }

    async fetchAllRefs() {
        let url = this.ebobackUrl(`get_all_refs`);
        let res = await fetch(url);
        return await res.json() as ExpandedRef[];
    }

    async updateAlbumData(albumUri: AlbumUri) {
        let url = this.ebobackUrl(`update_album_data`);
        url.searchParams.set("album_uri", albumUri);
        let res = await fetch(url);
        await res.text(); //todo: needed?
        return null;
    }
    async uploadAlbumImages(albumUri: AlbumUri, imageUrl: string) {
        let url = this.ebobackUrl(`upload_album_image`);
        url.searchParams.set("album_uri", albumUri);
        url.searchParams.set("image_url", imageUrl);
        let res = await fetch(url);
        await res.text(); //todo: needed?
        return null;
    }

    async setAlbumGenre(albumUri: AlbumUri, genre: string) {
        let url = this.ebobackUrl(`set_album_genre`);
        url.searchParams.set("album_uri", albumUri);
        url.searchParams.set("genre", genre);
        await fetch(url);
        // await res.text(); //todo: needed?
        return null;

    }

    async createPlaylist(name: string) {
        let url = this.ebobackUrl(`create_playlist`);
        url.searchParams.set("playlist_name", name);
        let res = await fetch(url);
        let result = await res.json();
        return result.playlist_uri as AllUris;
    }

    async toggleFavorite(uri: AllUris) {
        let url = this.ebobackUrl(`toggle_favorite`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        let result = await res.json();
        return result.is_favorite as boolean;
    }

    async getFavorites(): Promise<AllUris[]> {
        let url = this.ebobackUrl(`get_favorite_uris`);
        let res = await fetch(url);
        return await res.json();
    }
}