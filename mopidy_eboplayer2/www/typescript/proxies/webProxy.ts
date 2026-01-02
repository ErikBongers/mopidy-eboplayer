import {Model} from "../model";
import {EboPlayerDataType} from "../views/view";
import {getHostAndPort} from "../global";
import {AlbumMetaData, NoStreamTitles, StreamTitles, TrackUri} from "../modelTypes";

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
}