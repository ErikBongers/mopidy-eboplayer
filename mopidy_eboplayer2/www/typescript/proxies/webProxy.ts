import {Model} from "../model";
import {EboPlayerDataType} from "../views/view";
import {getHostAndPort} from "../global";
import {AlbumMetaData, NoStreamTitles} from "../modelTypes";

export class WebProxy {
    private model: Model;

    constructor(model: Model) {
        this.model = model;
    }

    async fetchRequiredData(dataType: EboPlayerDataType) {
        switch (dataType) {
            case  EboPlayerDataType.StreamLines:
                await this.fetchActiveStreamLines();
                break;
        }
    }

    async fetchActiveStreamLines() {
        if (!this.model.currentTrack) {
            this.model.setActiveStreamLinesHistory(NoStreamTitles);
            return;
        }

        let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/activeLines`);
        url.searchParams.set("uri", this.model.currentTrack);
        let res = await fetch(url);
        let lines = await res.json();
        this.model.setActiveStreamLinesHistory(lines);
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