import models from "../../js/mopidy";
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
import Track = models.Track;
import Dict = models.Dict;

export class MopidyOfflineRepository implements MopidyRepository {
    constructor() {
    }
    playTracklistItem(tlid: number): Promise<void> {
        return Promise.resolve();
    }
    addTracksToTracklist(uris: AllUris[]): Promise<any> {
        throw new Error("OFFLINE: Cannot add tracks to tracklist");
    }
    clearTrackList(): Promise<void> {
        throw new Error("OFFLINE: Cannot clear tracklist");
    }
    browse<T extends AllUris>(uri: string | null): Promise<models.Ref<T>[]> {
        // used by browseController.fetchRefsForCurrentBreadCrumbs, therfor by browseWindow
        //  "album" | "artist" | "directory" | "playlist" | "track"
        // playlist and stream are not handled by browse.
        // so browse handles:
        // "album" -> tracks
        // "artist" -> albums
        // "track" -> ???
        // "directory" (genre?) -> custom heavy hierarchical query on server...
        //todo: implement "artist" -> albums
        return Promise.resolve([]);
    }
    sendVolume(value: number): Promise<void> {
        return Promise.resolve();
    }
    sendStop(): Promise<any> {
        return Promise.resolve();
    }
    sendPause(): Promise<any> {
        return Promise.resolve();
    }
    sendPlay(): Promise<any> {
        return Promise.resolve();
    }
    search(uri: string): Promise<SearchResult[]> {
        return Promise.resolve([]);
    }
    lookup(uris: AllUris | AllUris[]): Promise<LibraryDict> {
        return Promise.resolve({});
    }
    fetchTracklist(): Promise<models.TlTrack[]> {
        return Promise.resolve([]);
    }
    fetchHistory(): Promise<MopidyHistoryLine[]> {
        return Promise.resolve([]);
    }
    fetchCurrentTrack(): Promise<models.TlTrack | null> {
        return Promise.resolve(null);
    }
    fetchPlayLists(): Promise<models.Ref<PlaylistUri>[]> {
        return Promise.resolve([]);
    }
    fetchPlaylistItems(uri: string): Promise<models.Ref<AllUris>[] | null> {
        return Promise.resolve(null);
    }
    fetchImages(uris: AllUris[]): Promise<ImageLookup> {
        return Promise.resolve({});
    }
    fetchVolume(): Promise<number> {
        return Promise.resolve(0);
    }
    fetchCurrentTlTrack(): Promise<models.TlTrack | null> {
        return Promise.resolve(null);
    }
    fetchPlayState(): Promise<PlayState> {
        return Promise.resolve("stopped");
    }
    savePlaylist(playlist: models.Playlist): Promise<models.Playlist | null> {
        return Promise.resolve(null);
    }
    setRepeat(repeat: boolean) {
        return Promise.resolve();
    }
    setSingle(single: boolean) {
        return Promise.resolve();
    }
    getPlaybackFlags(): Promise<PlaybackFlags> {
        return Promise.resolve({
            consume: false,
            random: false,
            repeat: false,
            single: false
        } satisfies PlaybackFlags);
    }

}