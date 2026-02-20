import {Model} from "../model";
import {Commands} from "../commands";
import models, {Mopidy} from "../../js/mopidy";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort, getHostAndPortDefs, isStream} from "../global";
import {createAllRefs, ExpandedRef} from "../refs";
import {AlbumModel, AlbumUri, AllUris, FileTrackModel, GenreDef, GenreReplacement, RememberDef, StreamTrackModel, StreamUri, TrackUri} from "../modelTypes";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";

export class CacheHandler extends Commands{
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public webProxy: WebProxy;
    public localStorageProxy: LocalStorageProxy;
    readonly baseUrl: string;
    protected player: PlayController;

    constructor(model: Model, mopidy: Mopidy, mopdyProxy: MopidyProxy, player: PlayController) {
        super(mopidy);
        this.model  = model;
        this.player = player;
        this.mopidyProxy = mopdyProxy;
        this.webProxy = new WebProxy(getHostAndPort());
        this.localStorageProxy = new LocalStorageProxy(model);
        let portDefs = getHostAndPortDefs();
        this.baseUrl = "";
        if(portDefs.altHost && portDefs.altHost != portDefs.host)
            this.baseUrl = "http://"+portDefs.altHost;
    }

    async lookupTrackCached(trackUri: TrackUri | StreamUri | null) {
        if(!trackUri)
            return null;
        let item = this.model.getFromLibraryCache(trackUri);
        if(item)
            return item as FileTrackModel | StreamTrackModel;

        let libraryList = await this.fetchAndConvertTracks(trackUri);
        this.model.addItemsToLibraryCache(libraryList);
        return this.model.getFromLibraryCache(trackUri) as FileTrackModel | StreamTrackModel | null; //assuming the trackUri points to a file or a stream.
    }

    private async fetchAndConvertTracks(uri: TrackUri | StreamUri) {
        let dict = await this.mopidyProxy.lookup(uri);
        let trackList = dict[uri] as models.Track[];
        let newListPromises = trackList.map(async track => this.transformTrackDataToModel(track));
        return await Promise.all(newListPromises);
    }

    private async transformTrackDataToModel(track: models.Track): Promise<FileTrackModel | StreamTrackModel> {
        let allRefsMap = await this.getAllRefsMapCached();
        if (isStream(track)) {
            return {
                type: "stream",
                track,
                name: track.name?? "--no name--",
                ref: allRefsMap.get(track.uri) as ExpandedRef
            } satisfies StreamTrackModel;
        }
        //for now, assume it's a file track
        let model: FileTrackModel = {
            type: "file",
            composer: "",
            track,
            title: track.name?? "--no name--",
            performer: "",
            songlenght: 0,
            ref: allRefsMap.get(track.uri) as ExpandedRef
        };
        //just in case...
        if (!track.name || track.name === '') {
            let parts = track.uri.split('/');
            model.title = decodeURI(parts[parts.length - 1])
        }
        return model;
    }

    async lookupAlbumsCached(albumUris: AlbumUri[]) {
        let albums: AlbumModel[] = [];
        let albumUrisToFetch: AlbumUri[] = [];
        for(let albumUri of albumUris) {
            let album = this.model.getFromLibraryCache(albumUri);
            if(album) {
                albums.push(album as AlbumModel);
            } else {
                albumUrisToFetch.push(albumUri);
            }
        }

        //fetch remaining albums
        if(albumUrisToFetch.length > 0) {
            let fetchedAlbums = await this.fetchAlbums(albumUrisToFetch);
            this.model.addItemsToLibraryCache(fetchedAlbums);
            albums = albums.concat(fetchedAlbums);
        }
        return albums;
    }

    private async fetchAlbums(albumUris: AlbumUri[]): Promise<AlbumModel[]> {
        let dict = await this.mopidyProxy.lookup(albumUris);
        let allRefs = await this.getAllRefsMapCached();
        let albumModelsPending = Object.keys(dict).map(async (albumUri: AlbumUri) => {
            let trackList = dict[albumUri] as models.Track[];
            let albumModel: AlbumModel = {
                type: "album",
                albumInfo: trackList[0].album?? null,
                tracks: trackList.map(track => track.uri as TrackUri),
                ref: allRefs.get(albumUri) as ExpandedRef //removing undefined type. Let it crash.
            }
            return albumModel;
        });
        let albumModels = await Promise.all(albumModelsPending);

        this.model.addItemsToLibraryCache(albumModels);
        return albumModels;
    }

    async lookupRemembersCached() {
        let remembers = this.model.getRemembers();
        if (remembers)
            return remembers;
        remembers = await this.webProxy.fetchRemembers();
        this.model.setRemembers(remembers);
        return remembers;
    }

    async getMetaDataCached(albumUri: string) {
        let cachedMeta = this.model.getFromMetaCache(albumUri);
        if(cachedMeta)
            return cachedMeta.meta;
        let meta = await this.webProxy.fetchMetaData(albumUri);
        this.model.addToMetaCache(albumUri, meta);
        return meta;
    }

    async getAllRefsCached() {
        let allRefs = this.model.getAllRefs();
        if(!allRefs) {
            let allExpandedRefs = await this.webProxy.fetchAllRefs();
            allRefs = await createAllRefs(this, allExpandedRefs);
            this.model.setAllRefs(allRefs);
        }
        return allRefs;
    }

    async getAllRefsMapCached() {
        await this.getAllRefsCached();
        return this.model.getAllRefsMap() as Map<AllUris, ExpandedRef>; //removing NULL from type - assuming a map has been loaded.
    }

    async getGenreReplacementsCached() {
        if(this.model.getGenreReplacements().size > 0)
            return this.model.getGenreReplacements() as Map<string, GenreReplacement>;
        let genreDefs = await this.webProxy.fetchGenreReplacements();
        this.model.setGenreReplacements(genreDefs);
        return this.model.getGenreReplacements() as Map<string, GenreReplacement>;
    }

    async getGenreReplacementCached(name: string) {
        let defs = await this.getGenreReplacementsCached();
        return defs.get(name)?? null;
    }

    async getRemembersCached() {
        if(this.model.getRemembers())
            return this.model.getRemembers() as RememberDef[];
        let remembers = await this.webProxy.fetchRemembers();
        this.model.setRemembers(remembers);
        return this.model.getRemembers() as RememberDef[]; //todo: this triggers the rememberedChanged event, which may already be a reason for this chached function call. Maybe this is ok...
    }

    async getGenreDefs() {
        if(this.model.getGenreDefs().length > 0)
            return this.model.getGenreDefs() as GenreDef[];
        let genreDefs = await this.webProxy.fetchGenreDefs();
        this.model.setGenreDefs(genreDefs);
        return this.model.getGenreDefs() as GenreDef[];
    }

    async getFavorites() {
        if(this.model.getFavorites())
            return this.model.getFavorites() as Set<AllUris>;
        let favorites = await this.webProxy.getFavorites();
        this.model.setFavorites(favorites);
        return this.model.getFavorites() as Set<AllUris>;
    }
}
