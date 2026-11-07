import {
    AlbumMetaData,
    AlbumUri,
    AllUris,
    GenreDef,
    GenreReplacement,
    HistoryLineDef,
    RememberDef,
    RememberId,
    StreamTitles,
    StreamUri,
    TrackUri
} from "../modelTypes";
import {ExpandedRef, RefType} from "../refs";
import {AlbumMetaDict} from "../proxies/webProxy";

export interface WebRepository {
    fetchActiveStreamLines(uri: StreamUri): Promise<StreamTitles>;

    fetchAllStreamLines(uri: string): Promise<string[]>;

    fetchMetaDatas(albumUris: AlbumUri[]): Promise<{} | AlbumMetaDict>;

    fetchMetaData(albumUri: string): Promise<AlbumMetaData | null>;

    addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: RefType, sequence: number): Promise<any>;

    fetchGenreReplacements(): Promise<GenreReplacement[]>;

    fetchGenreDefs(): Promise<GenreDef[]>;

    remember(text: string): Promise<any>;

    deleteRemember(id: RememberId): Promise<any>;

    fetchRemembers(): Promise<RememberDef[]>;

    fetchHistory(): Promise<HistoryLineDef[]>;

    fetchAllRefs(): Promise<{ allRefs: ExpandedRef<AllUris>[]; tracksNoAlbumRefs: ExpandedRef<TrackUri>[] }>;

    fetchAllTracksWithoutAlbum(): Promise<ExpandedRef<TrackUri>[]>;

    uploadAlbumData(albumUri: AlbumUri): Promise<null>;

    uploadAlbumImages(albumUri: AlbumUri, imageUrl: string): Promise<null>;

    setAlbumGenre(albumUri: AlbumUri, genre: string): Promise<null>;

    createPlaylist(name: string): Promise<AllUris>;

    toggleFavorite(uri: AllUris): Promise<boolean>;

    albumVolumeDown(uri: AllUris): Promise<void>;

    albumVolumeUp(uri: AllUris): Promise<void>;

    getFavorites(): Promise<AllUris[]>;

    getFavoritesPlaylistName(): Promise<string>;

    getMopidyConfigFile(): Promise<string>;

    addExclExtToMopidyConfigFile(ext: string): Promise<string>;

    getMixers(): Promise<string[]>;
}