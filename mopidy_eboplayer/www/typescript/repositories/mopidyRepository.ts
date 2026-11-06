import {
    AllUris,
    ImageLookup,
    LibraryDict,
    MopidyHistoryLine,
    PlaybackFlags,
    PlaylistUri,
    PlayState
} from "../modelTypes";
import models from "../../js/mopidy";
import {SearchResult} from "../refs";
import TlTrack = models.TlTrack;
import Playlist = models.Playlist;
import Dict = models.Dict;
import Track = models.Track;

export interface MopidyRepository {
    playTracklistItem(tlid: number): Promise<void>;

    addTracksToTracklist(uris: AllUris[]): Promise<any>;

    clearTrackList(): Promise<void>;

    browse<T extends AllUris>(uri: string | null): Promise<models.Ref<T>[]>;

    sendVolume(value: number): Promise<void>;

    sendStop(): Promise<any>;

    sendPause(): Promise<any>;

    sendPlay(): Promise<any>;

    search(uri: string): Promise<SearchResult[]>;

    lookup(uris: AllUris | AllUris[]): Promise<LibraryDict>;

    fetchTracklist(): Promise<TlTrack[]>;

    fetchHistory(): Promise<MopidyHistoryLine[]>;

    fetchCurrentTrack(): Promise<models.TlTrack | null>;

    fetchPlayLists(): Promise<models.Ref<PlaylistUri>[]>;

    fetchPlaylistItems(uri: string): Promise<models.Ref<AllUris>[] | null>;

    fetchImages(uris: AllUris[]): Promise<ImageLookup>;

    fetchVolume(): Promise<number>;

    fetchCurrentTlTrack(): Promise<models.TlTrack | null>;

    fetchPlayState(): Promise<PlayState>;

    savePlaylist(playlist: Playlist): Promise<models.Playlist | null>;

    setRepeat(repeat: boolean): Promise<void>;

    setSingle(single: boolean): Promise<void>;

    getPlaybackFlags(): Promise<PlaybackFlags>;
}