import {Model} from "../model";
import {TlId} from "../../js/mopidy";
import {AllUris} from "../modelTypes";
import {NetworkProxyPointer} from "../network";

export class PlayController {
    protected model: Model;
    protected network: NetworkProxyPointer;

    constructor(model: Model, network: NetworkProxyPointer) {
        this.model = model;
        this.network = network;
    }

    async clear() {
        await this.network.networkProxy.mopidyRepository.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.network.networkProxy.mopidyRepository.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.network.networkProxy.mopidyRepository.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.network.networkProxy.mopidyRepository.addTracksToTracklist(uris);
        this.model.addToTrackList(tracks);
        return tracks;
    }
}