import {Model} from "../model";
import {TlId} from "../../js/mopidy";
import {AllUris} from "../modelTypes";
import {PwaStateMachine} from "../stateMachine/PwaStateMachine";

export class PlayController {
    protected model: Model;
    protected network: PwaStateMachine;

    constructor(model: Model, network: PwaStateMachine) {
        this.model = model;
        this.network = network;
    }

    async clear() {
        await this.network.getNetworkProxy().mopidyRepository.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.network.getNetworkProxy().mopidyRepository.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.network.getNetworkProxy().mopidyRepository.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.network.getNetworkProxy().mopidyRepository.addTracksToTracklist(uris);
        this.model.addToTrackList(tracks);
        return tracks;
    }
}