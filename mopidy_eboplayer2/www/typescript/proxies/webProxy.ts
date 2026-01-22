import {AlbumMetaData, AllUris, GenreDef, HistoryLineDef, StreamTitles, StreamUri, TrackUri} from "../modelTypes";

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

    async fetchGenreDefs() {
        let url = this.ebobackUrl(`get_genres`);
        let res = await fetch(url);
        return await res.json() as GenreDef[];
    }

    async remember(text: string) {
        let url = this.ebobackUrl(`save_remember`);
        let res = await fetch(url, {method: 'POST', body: text});
        return await res.json();
    }

    async fetchRemembers() {
        let url = this.ebobackUrl(`get_remembers`);
        let res = await fetch(url);
        return await res.json() as string[];
    }

    async fetchHistory() {
        let url = this.ebobackUrl(`get_history`);
        let res = await fetch(url);
        return await res.json() as HistoryLineDef[];
    }
}