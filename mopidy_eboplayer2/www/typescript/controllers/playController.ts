import {Model} from "../model";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {MopidyDict, numberedDictToArray} from "../global";
import models, {TlId} from "../../js/mopidy";
import {AllUris, PlayState} from "../modelTypes";
import TlTrack = models.TlTrack;

export class PlayController {
    protected model: Model;
    protected mopidyProxy: MopidyProxy;

    constructor(model: Model, mopidyProxy: MopidyProxy) {
        this.model = model;
        this.mopidyProxy = mopidyProxy;
    }

    async clear() {
        await this.mopidyProxy.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.mopidyProxy.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.mopidyProxy.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.mopidyProxy.addTracksToTracklist(uris) as MopidyDict<TlTrack>;
        let trackList = numberedDictToArray(tracks);
        this.model.setTrackList(trackList);
        return trackList;
    }
}