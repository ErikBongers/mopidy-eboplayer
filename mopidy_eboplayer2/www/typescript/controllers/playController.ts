import {Model} from "../model";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {numberedDictToArray} from "../global";
import models, {TlId} from "../../js/mopidy";
import {PlayState} from "../modelTypes";
import TlTrack = models.TlTrack;

export class PlayController {
    protected model: Model;
    protected mopidyProxy: MopidyProxy;

    constructor(model: Model, mopidyProxy: MopidyProxy) {
        this.model = model;
        this.mopidyProxy = mopidyProxy;
    }

    async clearAndPlay(uris: string[]) {
        await this.mopidyProxy.clearTrackList();
        let trackList = await this.add(uris);
        // noinspection ES6MissingAwait
        this.play(trackList[0].tlid); //todo: await?
    }

    async play(tlid: TlId) {
        // noinspection ES6MissingAwait
        this.mopidyProxy.playTracklistItem(tlid); //todo: await?
    }

    async add(uris: string[]) {
        let tracks = await this.mopidyProxy.addTracksToTracklist(uris);
        let trackList = numberedDictToArray(tracks) as models.TlTrack[];
        this.setTracklist(trackList);
        return trackList;
    }

    private setTracklist(trackList: TlTrack[]) {
        this.model.setTrackList(trackList);
    }

}