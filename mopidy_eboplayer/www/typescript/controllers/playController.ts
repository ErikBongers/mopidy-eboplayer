import {Model} from "../model";
import {TlId} from "../../js/mopidy";
import {AllUris} from "../modelTypes";
import {NetworkProxy} from "../network";
import {NetworkStateMachine} from "../networkStateMachine";

export class PlayController {
    protected model: Model;
    protected network: NetworkStateMachine;

    constructor(model: Model, network: NetworkStateMachine) {
        this.model = model;
        this.network = network;
    }

    async clear() {
        await this.network.getProxy().mopidyRepository.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.network.getProxy().mopidyRepository.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.network.getProxy().mopidyRepository.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.network.getProxy().mopidyRepository.addTracksToTracklist(uris);
        this.model.addToTrackList(tracks);
        return tracks;
    }
}