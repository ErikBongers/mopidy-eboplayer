import {WebRepository} from "./webRepository";
import {
    AlbumMetaData, AlbumUri,
    AllUris,
    GenreDef,
    GenreReplacement,
    HistoryLineDef, RememberDef,
    RememberId,
    StreamTitles,
    StreamUri,
    TrackUri
} from "../modelTypes";
import {ExpandedRef, RefType} from "../refs";
import {AlbumMetaDict, WebProxy} from "../proxies/webProxy";
import {saveAndReturn} from "../db/offlineDb";
import {FETCH_REMEMBERS} from "../def";

export class WebOnlineRepository implements WebRepository  {
    constructor(private webProxy: WebProxy) {}

    addExclExtToMopidyConfigFile(ext: string): Promise<string> {
        return this.webProxy.addExclExtToMopidyConfigFile(ext);
    }

    addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: RefType, sequence: number): Promise<any> {
        return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
    }

    albumVolumeDown(uri: AllUris): Promise<void> {
        return this.webProxy.albumVolumeDown(uri);
    }

    albumVolumeUp(uri: AllUris): Promise<void> {
        return this.webProxy.albumVolumeUp(uri);
    }

    createPlaylist(name: string): Promise<AllUris> {
        return this.webProxy.createPlaylist(name);
    }

    deleteRemember(id: RememberId): Promise<any> {
        return this.webProxy.deleteRemember(id);
    }

    fetchActiveStreamLines(uri: StreamUri): Promise<StreamTitles> {
        return this.webProxy.fetchActiveStreamLines(uri);
    }

    fetchAllRefs(): Promise<{ allRefs: ExpandedRef<AllUris>[]; tracksNoAlbumRefs: ExpandedRef<TrackUri>[] }> {
        return this.webProxy.fetchAllRefs();
    }

    fetchAllStreamLines(uri: string): Promise<string[]> {
        return this.webProxy.fetchAllStreamLines(uri);
    }

    fetchAllTracksWithoutAlbum(): Promise<ExpandedRef<TrackUri>[]> {
        return this.webProxy.fetchAllTracksWithoutAlbum();
    }

    fetchGenreDefs(): Promise<GenreDef[]> {
        return this.webProxy.fetchGenreDefs();
    }

    fetchGenreReplacements(): Promise<GenreReplacement[]> {
        return this.webProxy.fetchGenreReplacements();
    }

    fetchHistory(): Promise<HistoryLineDef[]> {
        return this.webProxy.fetchHistory();
    }

    fetchMetaData(albumUri: string): Promise<AlbumMetaData | null> {
        return this.webProxy.fetchMetaData(albumUri);
    }

    fetchMetaDatas(albumUris: AlbumUri[]): Promise<{} | AlbumMetaDict> {
        return this.webProxy.fetchMetaDatas(albumUris);
    }

    fetchRemembers(): Promise<RememberDef[]> {
        return saveAndReturn(FETCH_REMEMBERS, this.webProxy.fetchRemembers());
    }

    getFavorites(): Promise<AllUris[]> {
        return this.webProxy.getFavorites();
    }

    getFavoritesPlaylistName(): Promise<string> {
        return this.webProxy.getFavoritesPlaylistName();
    }

    getMixers(): Promise<string[]> {
        return this.webProxy.getMixers();
    }

    getMopidyConfigFile(): Promise<string> {
        return this.webProxy.getMopidyConfigFile();
    }

    remember(text: string): Promise<any> {
        return this.webProxy.remember(text);
    }

    setAlbumGenre(albumUri: AlbumUri, genre: string): Promise<null> {
        return this.webProxy.setAlbumGenre(albumUri, genre);
    }

    toggleFavorite(uri: AllUris): Promise<boolean> {
        return this.webProxy.toggleFavorite(uri);
    }

    uploadAlbumData(albumUri: AlbumUri): Promise<null> {
        return this.webProxy.uploadAlbumData(albumUri);
    }

    uploadAlbumImages(albumUri: AlbumUri, imageUrl: string): Promise<null> {
        return this.webProxy.uploadAlbumImages(albumUri, imageUrl);
    }
}