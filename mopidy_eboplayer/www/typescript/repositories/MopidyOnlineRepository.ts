import models, {core} from "../../js/mopidy";
import {
    AllUris,
    MopidyHistoryLine,
    PlaylistUri,
    ImageLookup,
    PlaybackFlags,
    PlayState,
    LibraryDict
} from "../modelTypes";
import { SearchResult } from "../refs";
import {MopidyRepository} from "./mopidyRepository";
import {MopidyProxy} from "../proxies/mopidyProxy";
import Dict = models.Dict;
import Track = models.Track;
import {getOfflineDb, SocketReply} from "../db/offlineDb";
import {FETCH_CURRENT_TLTRACK, FETCH_PLAY_STATE, FETCH_TRACKLIST, FETCH_VOLUME, GET_PLAYBACK_FLAGS} from "../def";
import PlaybackState = core.PlaybackState;
import TlTrack = models.TlTrack;

export class MopidyOnlineRepository implements MopidyRepository {
    constructor(private mopidyProxy: MopidyProxy) {
    }

    async on(name: core.MopidyEventName, data: any): Promise<void> {
        switch (name) {
            case "event:volumeChanged":
                await saveAndReturn(FETCH_VOLUME, Promise.resolve(data as number));
                return;
            case "event:playbackStateChanged":
                await saveAndReturn(FETCH_PLAY_STATE, Promise.resolve(data.new_state as PlaybackState)); //todo: make data a type.
                return;
            case "event:optionsChanged":
                await saveAndReturn(GET_PLAYBACK_FLAGS, this.getPlaybackFlags());
                return;
            case "event:trackPlaybackStarted":
            case "event:trackPlaybackResumed":
                await saveAndReturn(FETCH_CURRENT_TLTRACK, Promise.resolve(data.tl_track as TlTrack));
                return;
        }
    }
    playTracklistItem(tlid: number): Promise<void> {
        return this.mopidyProxy.playTracklistItem(tlid);
    }
    addTracksToTracklist(uris: AllUris[]): Promise<any> {
        return this.mopidyProxy.addTracksToTracklist(uris);
    }
    clearTrackList(): Promise<void> {
        return this.mopidyProxy.clearTrackList();
    }
    browse<T extends AllUris>(uri: string | null): Promise<models.Ref<T>[]> {
        return this.mopidyProxy.browse<T>(uri); // used by browseController, therfor by browseWindow
    }
    sendVolume(value: number): Promise<void> {
        return this.mopidyProxy.sendVolume(value);
    }
    sendStop(): Promise<any> {
        return this.mopidyProxy.sendStop();
    }
    sendPause(): Promise<any> {
        return this.mopidyProxy.sendPause();
    }
    sendPlay(): Promise<any> {
        return this.mopidyProxy.sendPlay();
    }
    search(uri: string): Promise<SearchResult[]> {
        return this.mopidyProxy.search(uri);
    }
    lookup(uris: AllUris | AllUris[]): Promise<LibraryDict> {
        return this.mopidyProxy.lookup(uris);
    }

    async fetchTracklist(): Promise<models.TlTrack[]> {
        return saveAndReturn(FETCH_TRACKLIST, this.mopidyProxy.fetchTracklist());
    }

    fetchHistory(): Promise<MopidyHistoryLine[]> {
        return this.mopidyProxy.fetchHistory();
    }
    fetchPlayLists(): Promise<models.Ref<PlaylistUri>[]> {
        return this.mopidyProxy.fetchPlayLists();
    }
    fetchPlaylistItems(uri: string): Promise<models.Ref<AllUris>[] | null> {
        return this.mopidyProxy.fetchPlaylistItems(uri);
    }
    fetchImages(uris: AllUris[]): Promise<ImageLookup> { //todo: unused?
        return this.mopidyProxy.fetchImages(uris);
    }
    async fetchVolume(): Promise<number> {
        return saveAndReturn(FETCH_VOLUME, this.mopidyProxy.fetchVolume());
    }
    async fetchCurrentTlTrack(): Promise<models.TlTrack | null> {
        return saveAndReturn(FETCH_CURRENT_TLTRACK, this.mopidyProxy.fetchCurrentTlTrack());
    }
    async fetchPlayState(): Promise<PlayState> {
        return saveAndReturn(FETCH_PLAY_STATE, this.mopidyProxy.fetchPlayState());
    }
    savePlaylist(playlist: models.Playlist): Promise<models.Playlist | null> {
        return this.mopidyProxy.savePlaylist(playlist);
    }
    setRepeat(repeat: boolean) {
        return this.mopidyProxy.setRepeat(repeat);
    }
    setSingle(single: boolean) {
        return this.mopidyProxy.setSingle(single);
    }
    async getPlaybackFlags(): Promise<PlaybackFlags> {
        return saveAndReturn(GET_PLAYBACK_FLAGS, this.mopidyProxy.getPlaybackFlags());
    }
}

async function saveAndReturn<D, T extends Promise<D>>(id: string, doc: T): Promise<D> {
    let db = await getOfflineDb();
    let docX: D = await doc;
    await db.SocketReplies.put({id, doc: docX});
    return docX;
}
