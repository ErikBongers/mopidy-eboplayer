import {Model} from "../model";
import {Commands} from "../commands";
import models, {core, Mopidy} from "../../js/mopidy";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort} from "../global";
import {createAllRefs, RefType} from "../refs";
import {
    AlbumModel,
    AlbumUri,
    AllUris,
    ConnectionState,
    ExpandedAlbumModel,
    ExpandedFileTrackModel,
    ExpandedStreamModel,
    MessageType,
    NoStreamTitles,
    PlaylistUri,
    PlayState,
    RememberId,
    StreamTitles,
    StreamUri,
    TrackNone,
    TrackUri
} from "../modelTypes";
import {JsonRpcController} from "../jsonRpcController";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import {View} from "../views/view";
import {CacheHandler} from "./cacheHandler";
import {ViewController} from "./viewController";
import {BrowseController} from "./browseController";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Playlist = models.Playlist;
import PlaybackState = core.PlaybackState;

export const LIBRARY_PROTOCOL = "eboback:";

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
class Controller extends Commands {
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public webProxy: WebProxy;
    public localStorageProxy: LocalStorageProxy;
    private eboWsFrontCtrl: JsonRpcController;
    private eboWsBackCtrl: JsonRpcController;
    protected player: PlayController;
    cache: CacheHandler;
    viewController: ViewController;
    browseController: BrowseController;

    constructor(model: Model, mopidy: Mopidy, eboWsFrontCtrl: JsonRpcController, eboWsBackCtrl: JsonRpcController, mopdyProxy: MopidyProxy, player: PlayController, cache: CacheHandler) {
        super(mopidy);
        this.cache = cache;
        this.model  = model;
        this.player = player;
        this.mopidyProxy = mopdyProxy;
        this.webProxy = new WebProxy(getHostAndPort());
        this.localStorageProxy = new LocalStorageProxy(model);
        this.eboWsFrontCtrl = eboWsFrontCtrl;
        this.eboWsBackCtrl = eboWsBackCtrl;
        this.viewController = new ViewController(model, mopidy, this);
        this.browseController = new BrowseController(this, model);
    }

    async getInitialData(views: View[])  {
        this.model.setVolume(await this.mopidyProxy.fetchVolume());
        await this.setCurrentTrackAndFetchDetails(await this.mopidyProxy.fetchCurrentTlTrack());
        this.model.setPlayState((await this.mopidyProxy.fetchPlayState()) as PlayState);
        this.model.setPlaybackMode(await this.mopidyProxy.getPlaybackFlags());
        this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
        await this.fetchAllAlbums();
        this.localStorageProxy.loadCurrentBrowseFilter();
        this.localStorageProxy.loadBrowseFiltersBreadCrumbs();
        await this.browseController.fetchRefsForCurrentBreadCrumbs();
        await this.browseController.filterBrowseResults();
        await this.cache.getGenreReplacementsCached();
        await this.cache.getRemembersCached();
        await this.cache.getGenreDefs();
        await this.cache.getFavorites();
        await this.updateStreamLines();
    }

    initialize (views: View[]) {
        this.mopidy.on('state:online', async () => {
            this.model.setConnectionState(ConnectionState.Online);
            await this.getInitialData(views);
            this.model.setHistory(await this.webProxy.fetchHistory());
            this.viewController.setInitialView();
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', async () =>{
            this.model.setPlaybackMode(await this.mopidyProxy.getPlaybackFlags());
        });

        this.mopidy.on('event:trackPlaybackStarted', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:trackPlaybackEnded', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:playlistsLoaded', ()  => {
            // library.getPlaylists();
        });

        this.mopidy.on('event:playlistChanged', (data: {playlist: Playlist}) => {
            // delete this.stateplaylists[data.playlist.uri];
            // library.getPlaylists();
        });

        this.mopidy.on('event:playlistDeleted', (data: {uir: PlaylistUri}) => {
            // delete this.stateplaylists[data.uri];
            // library.getPlaylists();
        });

        this.mopidy.on('event:volumeChanged', (data: {volume: number}) => {
            this.model.setVolume(data.volume);
        });

        this.mopidy.on('event:muteChanged', (_data: any) => {
        });

        this.mopidy.on('event:playbackStateChanged', async (data: {new_state: PlaybackState}) => {
            await this.onPlaybackStateChanged(data);
        });

        this.mopidy.on('event:tracklistChanged', async () => {
            this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
            await this.setCurrentTrackAndFetchDetails(await this.mopidyProxy.fetchCurrentTrack());
        });

        this.mopidy.on('event:seeked', () => {
        });

        //log all events:
        this.mopidy.on((data: any) => {
            if(data instanceof MessageEvent) {
                try {
                    let dataObject = JSON.parse(data.data);
                    if((dataObject.event ?? "") == "stream_title_changed")
                        return;
                } catch (e) {} //not valid json.
            }
            if(typeof(data) == "object") {
                if((data.title && Object.keys(data).length) == 1)
                    return;
            }
            if(data instanceof Array) {
                if (data.length && data[0] == "event:streamTitleChanged")
                    return;
            }
        });
        this.eboWsFrontCtrl.on("event:streamHistoryChanged", (data: {stream_titles: StreamTitles}) => {
            let streamTitles: StreamTitles = data.stream_titles;
            this.model.setActiveStreamLines(streamTitles);
            this.model.setStreamLinesHistory(streamTitles.uri as StreamUri, null);
        });
        this.eboWsFrontCtrl.on("event:programTitleChanged", (data: {program_title: string}) => {
            this.model.setCurrentProgramTitle(data.program_title);
        });
        this.eboWsBackCtrl.on((data: any) => {
        });
        this.eboWsBackCtrl.on("event:scanStarted", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
        });
        this.eboWsBackCtrl.on("event:scanStatus", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
        });
        this.eboWsBackCtrl.on("event:scanFinished", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
            this.model.dispatchEboEvent("scanFinished.eboplayer", {});
        });
        this.eboWsFrontCtrl.on("event:volumeAdjustChanged", async (data: {uri: AllUris, volumeAdjust: number}) => {
            await this.onVolumeAdjustChanged(data.uri, data.volumeAdjust);
        });
    }

    async onVolumeAdjustChanged(uri: AllUris, volumeAdjust: number) {
        let album = await this.cache.getMetaDataCached(uri); //todo: this could be a track uri!!!
        if(album) {
            album.volumeAdjust = volumeAdjust;
            this.model.dispatchEboEvent("volumeAdjustChanged.eboplayer", {volumeAdjust, uri});
        }
    }

    async fetchAllAlbums() {
        let albumRefs = await this.mopidyProxy.browse(LIBRARY_PROTOCOL+"directory?type=album") as Ref<AlbumUri>[];
        return await this.cache.lookupAlbumsCached(albumRefs.map(ref => ref.uri));
    }

    private async onPlaybackStateChanged(data: { new_state: PlaybackState; }) {
        this.model.setPlayState(data.new_state);
        await this.updateStreamLines();
    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        if(!data) {
            this.model.setCurrentTrack(TrackNone);
            return;
        }
        let trackModel = await this.cache.lookupTrackCached(data.track.uri as TrackUri);
        this.model.setCurrentTrack(trackModel);
        if(!this.model.selectedTrack) {
            let uri = trackModel?.track?.uri as TrackUri | undefined;
            this.model.setSelectedTrack(uri?? null);
        }
        await this.updateStreamLines();

        //todo: do this only when a track is started?s
        // this.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // this.core.mixer.getMute().then(processMute, console.error)
    }

    private async updateStreamLines() {
        if (this.model.getPlayState() != "playing") {
            this.model.setActiveStreamLines(NoStreamTitles);
            return;
        }
        if (this.model.currentTrack == null) {
            this.model.setActiveStreamLines(NoStreamTitles);
            return;
        }

        let trackModel = await this.cache.lookupTrackCached(this.model.currentTrack);
        if (trackModel?.type == "stream") {
            let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack as StreamUri);
            this.model.setActiveStreamLines(lines);
        } else {
            this.model.setActiveStreamLines(NoStreamTitles);
        }
    }

    async getExpandedTrackModel(trackUri: TrackUri | StreamUri | null): Promise<ExpandedStreamModel | ExpandedFileTrackModel | null>{
        if(!trackUri)
            return null;
        let track = await this.cache.lookupTrackCached(trackUri);
        if(track?.type == "stream") {
            // noinspection UnnecessaryLocalVariableJS
            return new ExpandedStreamModel(track, this);
        }
        if(track) {
            let uri = track?.track?.album?.uri;
            let album: AlbumModel | null = null;
            if(uri) {
                let albums = await this.cache.lookupAlbumsCached([uri]);
                album = albums[0];
            }
            return new ExpandedFileTrackModel(track, album, this);
        }
        throw new Error("trackUri not found in library");
    }

    async getExpandedAlbumModel(albumUri: AlbumUri): Promise<ExpandedAlbumModel> {
        let album =  (await this.cache.lookupAlbumsCached([albumUri]))[0];
        let meta = await this.cache.getMetaDataCached(albumUri) ?? null;

        return new ExpandedAlbumModel(album, this, meta);
    }

    setSelectedTrack(uri: TrackUri | StreamUri | null) {
        this.model.setSelectedTrack(uri);
    }

    async fetchAllRefs() {
        let allRefs = await this.webProxy.fetchAllRefs();

        return createAllRefs(this.cache, allRefs);
    }

    async setAllRefsAsCurrent() {
        this.model.setCurrentRefs(await this.cache.getAllRefsCached());
    }

    async addCurrentSearchResultsToPlayer() {
        let results = this.model.getCurrentSearchResults();
        await this.player.add(results.refs.map(r => r.item.uri));
    }

    async createPlaylist(name: string) {
        return this.webProxy.createPlaylist(name)
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: RefType, sequence: number) {
        return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
    }

    async remember(streamUri: StreamUri, lines: string) {
        let _status = await this.webProxy.remember(lines);
        this.model.setRemembers(null);
        this.model.setStreamLinesHistory(streamUri, null);
    }

    async deleteRemember(id: RememberId) {
        await this.webProxy.deleteRemember(id);
        this.model.setRemembers(null);
        let streamUri = this.model.getRadioToView();
        if(streamUri)
            this.model.setStreamLinesHistory(streamUri, null);
    }

    async startScan() {
        this.model.clearScanStatus();
        await this.eboWsBackCtrl.send({method: "start_scan"}, "fireAndForget");
    }

    async readMopidyConfig() {
        let config = await this.webProxy.getMopidyConfigFile();
    }

    async addExclExtToMopidyConfig(ext: string) {
        await this.webProxy.addExclExtToMopidyConfigFile(ext)
    }

    async setRepeat(repeat: boolean) {
        await this.mopidyProxy.setRepeat(repeat);
    }

    async setSingle(single: boolean) {
        await this.mopidyProxy.setSingle(single);
    }

    async saveAlbumGenre(albumUri: AlbumUri, genre: string) {
        await this.webProxy.setAlbumGenre(albumUri, genre);
    }

    async toggleFavorite(uri: AllUris) {
        await this.webProxy.toggleFavorite(uri);
        this.model.setFavorites(null);
        await this.cache.getFavorites();
    }

    async setAlbumVolumeDown(uri: AllUris) {
        await this.webProxy.albumVolumeDown(uri);
    }

    async setAlbumVolumeUp(uri: AllUris) {
        await this.webProxy.albumVolumeUp(uri);
    }

    async isFavorite(uri: AllUris | undefined | null) {
        if(!uri)
            return false;
        let favorites = await this.cache.getFavorites();
        return favorites.has(uri);
    }

    showTempMessage(message: string, type: MessageType) {
        this.model.setTempMessage({message, type});
    }
}

export default Controller
