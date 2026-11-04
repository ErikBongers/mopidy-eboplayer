import models from "../../js/mopidy";
import { AllUris, MopidyHistoryLine, PlaylistUri, ImageLookup, PlaybackFlags } from "../modelTypes";
import { SearchResult } from "../refs";
import {MopidyRepository} from "./mopidyRepository";
import {MopidyProxy} from "../proxies/mopidyProxy";

export class MopidyOnlineRepository implements MopidyRepository {
    constructor(private mopidyProxy: MopidyProxy) {
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
        return this.mopidyProxy.browse<T>(uri);
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
    lookup(uris: AllUris | AllUris[]): Promise<any> {
        return this.mopidyProxy.lookup(uris);
    }
    fetchTracklist(): Promise<models.TlTrack[]> {
        return this.mopidyProxy.fetchTracklist();
    }
    fetchHistory(): Promise<MopidyHistoryLine[]> {
        return this.mopidyProxy.fetchHistory();
    }
    fetchCurrentTrack(): Promise<models.TlTrack | null> {
        return this.mopidyProxy.fetchCurrentTrack();
    }
    fetchPlayLists(): Promise<models.Ref<PlaylistUri>[]> {
        return this.mopidyProxy.fetchPlayLists();
    }
    fetchPlaylistItems(uri: string): Promise<models.Ref<AllUris>[] | null> {
        return this.mopidyProxy.fetchPlaylistItems(uri);
    }
    fetchImages(uris: AllUris[]): Promise<ImageLookup> {
        return this.mopidyProxy.fetchImages(uris);
    }
    fetchVolume(): Promise<number> {
        return this.mopidyProxy.fetchVolume();
    }
    fetchCurrentTlTrack(): Promise<models.TlTrack> {
        return this.mopidyProxy.fetchCurrentTlTrack();
    }
    fetchPlayState(): Promise<string> {
        return this.mopidyProxy.fetchPlayState();
    }
    savePlaylist(playlist: models.Playlist) {
        return this.mopidyProxy.savePlaylist(playlist);
    }
    setRepeat(repeat: boolean) {
        return this.mopidyProxy.setRepeat(repeat);
    }
    setSingle(single: boolean) {
        return this.mopidyProxy.setSingle(single);
    }
    getPlaybackFlags(): Promise<PlaybackFlags> {
        return this.mopidyProxy.getPlaybackFlags();
    }

}