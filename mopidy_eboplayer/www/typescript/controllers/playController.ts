import {Model} from "../model";
import {MopidyProxy} from "../proxies/mopidyProxy";
import models, {TlId} from "../../js/mopidy";
import {AllUris} from "../modelTypes";
import {MopidyRepository} from "../repositories/mopidyRepository";
import {NetworkProxy} from "../network";

export class PlayController {
    protected model: Model;
    protected networkProxy: NetworkProxy;

    constructor(model: Model, networkProxy: NetworkProxy) {
        this.model = model;
        this.networkProxy = networkProxy;
    }

    async clear() {
        await this.networkProxy.mopidyRepository.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.networkProxy.mopidyRepository.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.networkProxy.mopidyRepository.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.networkProxy.mopidyRepository.addTracksToTracklist(uris);
        this.model.addToTrackList(tracks);
        return tracks;
    }
}