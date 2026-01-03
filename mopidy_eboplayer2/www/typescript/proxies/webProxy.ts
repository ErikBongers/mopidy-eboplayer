import {Model} from "../model";
import {EboPlayerDataType} from "../views/view";
import {getHostAndPort} from "../global";
import {AlbumMetaData, AllUris, NoStreamTitles, StreamTitles, TrackUri} from "../modelTypes";

export class WebProxy {

    constructor() {
    }

    async fetchActiveStreamLines(uri: TrackUri) {
        let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/activeLines`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        return await res.json() as StreamTitles;
    }

    async fetchAllStreamLines(uri: string) {
        let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/allLines`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        return await res.json() as string[];
    }

    async fetchMetaData(albumUri: string) {
        let url = new URL(`http://${getHostAndPort()}/eboback/data/get_album_meta`);
        url.searchParams.set("uri", albumUri);
        let res = await fetch(url);
        let text = await res.text();
        if(text)
            return JSON.parse(text) as AlbumMetaData;
        return null;
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: string, sequence: number) {
        let url = new URL(`http://${getHostAndPort()}/eboback/data/add_ref_to_playlist`); //todo: put full base in var in constructor or is this too early? Or inject it!!!
        //add params to body of post request
        let data = new FormData();
        data.append("playlist_uri", playlistUri);
        data.append("item_uri", itemUri);
        data.append("ref_type", refType);
        data.append("sequence", sequence.toString());
        let res = await fetch(url, {method: 'POST', body: data});
        return await res.json();
    }
}