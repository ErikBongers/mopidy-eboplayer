import {AllUris, ImageLookup, MopidyHistoryLine, PlaybackFlags, PlaylistUri} from "../modelTypes";
import models from "../../js/mopidy";
import {SearchResult} from "../refs";
import TlTrack = models.TlTrack;
import Playlist = models.Playlist;

export interface MopidyRepository {
    fetchRootDirs(): Promise<any>;

    playTracklistItem(tlid: number): Promise<void>;

    addTracksToTracklist(uris: AllUris[]): Promise<any>;

    clearTrackList(): Promise<void>;

    browse<T extends AllUris>(uri: string | null): Promise<models.Ref<T>[]>;

    sendVolume(value: number): Promise<void>;

    sendStop(): Promise<any>;

    sendPause(): Promise<any>;

    sendPlay(): Promise<any>;

    search(uri: string): Promise<SearchResult[]>;

    lookup(uris: AllUris | AllUris[]): Promise<any>;

    fetchTracklist(): Promise<TlTrack[]>;

    fetchHistory(): Promise<MopidyHistoryLine[]>;

    fetchCurrentTrack(): Promise<models.TlTrack | null>;

    fetchPlayLists(): Promise<models.Ref<PlaylistUri>[]>;

    fetchPlaylistItems(uri: string): Promise<models.Ref<AllUris>[] | null>;

    fetchImages(uris: AllUris[]): Promise<ImageLookup>;

    fetchVolume(): Promise<number>;

    fetchCurrentTlTrack(): Promise<models.TlTrack>;

    fetchPlayState(): Promise<string>;

    savePlaylist(playlist: Playlist): any;

    setRepeat(repeat: boolean): any;

    setSingle(single: boolean): any;

    getPlaybackFlags(): Promise<PlaybackFlags>;
}