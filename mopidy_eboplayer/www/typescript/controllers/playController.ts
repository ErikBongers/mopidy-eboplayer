import {Model} from "../model";
import {MopidyProxy} from "../proxies/mopidyProxy";
import models, {TlId} from "../../js/mopidy";
import {AllUris} from "../modelTypes";
import {MopidyRepository} from "../proxies/mopidyRepository";

export class PlayController {
    protected model: Model;
    protected mopidyRepository: MopidyRepository;

    constructor(model: Model, mopidyRepository: MopidyRepository) {
        this.model = model;
        this.mopidyRepository = mopidyRepository;
    }

    async clear() {
        await this.mopidyRepository.clearTrackList();
        this.model.setTrackList([]);
    }
    async clearAndPlay(uris: AllUris[]) {
        await this.mopidyRepository.clearTrackList();
        let trackList = await this.add(uris);
        await this.play(trackList[0].tlid);
    }

    async play(tlid: TlId | undefined = undefined) {
        tlid = tlid ?? this.model.getTrackList()[0].tlid;
        await this.mopidyRepository.playTracklistItem(tlid);
    }

    async add(uris: AllUris[]) {
        let tracks = await this.mopidyRepository.addTracksToTracklist(uris);
        this.model.addToTrackList(tracks);
        return tracks;
    }
}