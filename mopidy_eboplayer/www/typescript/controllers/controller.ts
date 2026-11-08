import {Model} from "../model";
import models, {core} from "../../js/mopidy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
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
import {PlayController} from "./playController";
import {View} from "../views/view";
import {CacheHandler} from "./cacheHandler";
import {ViewController} from "./viewController";
import {BrowseController} from "./browseController";
import {NetworkProxy} from "../network";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Playlist = models.Playlist;
import PlaybackState = core.PlaybackState;
import {NetworkStateMachine} from "../networkStateMachine";

export const LIBRARY_PROTOCOL = "eboback:";

//Controller
//  - updates the model and has functions called by the views.
//  - does not update the views directly.
//  - should not listen to model events, to avoid circular updates (dead loops).
class Controller {
    protected model: Model;
    public localStorageProxy: LocalStorageProxy;
    private network: NetworkStateMachine;
    protected player: PlayController;
    cache: CacheHandler;
    viewController: ViewController;
    browseController: BrowseController;

    constructor(model: Model, network: NetworkStateMachine, player: PlayController, cache: CacheHandler) {
        this.cache = cache;
        this.model  = model;
        this.player = player;
        this.network = network;
        this.localStorageProxy = new LocalStorageProxy(model);
        this.viewController = new ViewController(model, this);
        this.browseController = new BrowseController(this, model);
    }

    async getInitialData(views: View[])  {
        this.model.setVolume(await this.network.getProxy().mopidyRepository.fetchVolume());
        await this.setCurrentTrackAndFetchDetails(await this.network.getProxy().mopidyRepository.fetchCurrentTlTrack());
        this.model.setPlayState((await this.network.getProxy().mopidyRepository.fetchPlayState()) as PlayState);
        this.model.setPlaybackMode(await this.network.getProxy().mopidyRepository.getPlaybackFlags());
        this.model.setTrackList(await this.network.getProxy().mopidyRepository.fetchTracklist());
        await this.fetchAllAlbums();
        this.localStorageProxy.loadCurrentBrowseFilter();
        this.localStorageProxy.loadBrowseFiltersBreadCrumbs("browse");
        this.localStorageProxy.loadBrowseFiltersBreadCrumbs("favorites");
        await this.browseController.fetchRefsForCurrentBreadCrumbs("browse");
        await this.browseController.filterBrowseResults();
        await this.cache.getGenreReplacementsCached();
        await this.cache.getRemembersCached();
        await this.cache.getGenreDefs();
        await this.cache.getFavorites();
        await this.updateStreamLines();
    }

    initialize (views: View[]) {
        this.network.getProxy().on('state:online', async () => {
            this.model.setConnectionState(ConnectionState.Online);
            await this.getInitialData(views);
            this.model.setHistory(await this.network.getProxy().webRepository.fetchHistory());
            this.viewController.setInitialView();
        });

        this.network.getProxy().on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.network.getProxy().on('event:optionsChanged', async () =>{
            this.model.setPlaybackMode(await this.network.getProxy().mopidyRepository.getPlaybackFlags());
        });

        this.network.getProxy().on('event:trackPlaybackStarted', async (data: {tl_track: TlTrack}) => { //todo: make data a type
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.network.getProxy().on('event:trackPlaybackEnded', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.network.getProxy().on('event:trackPlaybackResumed', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.network.getProxy().on('event:playlistsLoaded', ()  => {
            // library.getPlaylists();
        });

        this.network.getProxy().on('event:playlistChanged', (data: {playlist: Playlist}) => {
            // delete this.stateplaylists[data.playlist.uri];
            // library.getPlaylists();
        });

        this.network.getProxy().on('event:playlistDeleted', (data: {uir: PlaylistUri}) => {
            // delete this.stateplaylists[data.uri];
            // library.getPlaylists();
        });

        this.network.getProxy().on('event:volumeChanged', (data: {volume: number}) => {
            this.model.setVolume(data.volume);
        });

        this.network.getProxy().on('event:muteChanged', (_data: any) => {
        });

        this.network.getProxy().on('event:playbackStateChanged', async (data: {new_state: PlaybackState}) => {
            await this.onPlaybackStateChanged(data);
        });

        this.network.getProxy().on('event:tracklistChanged', async () => {
            this.model.setTrackList(await this.network.getProxy().mopidyRepository.fetchTracklist());
            await this.setCurrentTrackAndFetchDetails(await this.network.getProxy().mopidyRepository.fetchCurrentTlTrack());
        });

        this.network.getProxy().on('event:seeked', () => {
        });

        //log all events:
        this.network.getProxy().supervise((event: string, data: any) => {
            // console.log(`mopidy event ${event}:`, data);
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
        this.network.getProxy().frontWebSocket.on("event:streamHistoryChanged", (data: {stream_titles: StreamTitles}) => {
            let streamTitles: StreamTitles = data.stream_titles;
            this.model.setActiveStreamLines(streamTitles);
            this.model.setStreamLinesHistory(streamTitles.uri as StreamUri, null);
        });
        this.network.getProxy().frontWebSocket.on("event:programTitleChanged", (data: {program_title: string}) => {
            this.model.setCurrentProgramTitle(data.program_title);
        });
        this.network.getProxy().backWebSocket.supervise((data: any) => {
        });
        this.network.getProxy().backWebSocket.on("event:scanStarted", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
        });
        this.network.getProxy().backWebSocket.on("event:scanStatus", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
        });
        this.network.getProxy().backWebSocket.on("event:scanFinished", (data: any) => {
            this.model.setScanStatus({type: data.type, message: data.message});
            this.model.dispatchEboEvent("scanFinished.eboplayer", {});
        });
        this.network.getProxy().frontWebSocket.on("event:volumeAdjustChanged", async (data: {uri: AllUris, volumeAdjust: number}) => {
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
        let albumRefs = await this.network.getProxy().mopidyRepository.browse(LIBRARY_PROTOCOL+"directory?type=album") as Ref<AlbumUri>[];
        return await this.cache.lookupAlbumsCached(albumRefs.map(ref => ref.uri));
    }

    private async onPlaybackStateChanged(data: { new_state: PlaybackState; }) { //todo: make data a type
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
            let lines = await this.network.getProxy().webRepository.fetchActiveStreamLines(this.model.currentTrack as StreamUri);
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
        let allRefs = await this.network.getProxy().webRepository.fetchAllRefs();

        return createAllRefs(this.cache, allRefs.allRefs, allRefs.tracksNoAlbumRefs);
    }

    async setAllRefsAsCurrent() {
        this.model.setCurrentRefs(await this.cache.getAllRefsCached());
    }

    async addCurrentSearchResultsToPlayer() {
        let results = this.model.getCurrentSearchResults();
        await this.player.add(results.refs.map(r => r.item.uri));
    }

    async createPlaylist(name: string) {
        return this.network.getProxy().webRepository.createPlaylist(name)
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: RefType, sequence: number) {
        return this.network.getProxy().webRepository.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
    }

    async remember(streamUri: StreamUri, lines: string) {
        let _status = await this.network.getProxy().webRepository.remember(lines);
        this.model.setRemembers(null);
        this.model.setStreamLinesHistory(streamUri, null);
    }

    async deleteRemember(id: RememberId) {
        await this.network.getProxy().webRepository.deleteRemember(id);
        this.model.setRemembers(null);
        let streamUri = this.model.getRadioToView();
        if(streamUri)
            this.model.setStreamLinesHistory(streamUri, null);
    }

    async startScan() {
        this.model.clearScanStatus();
        await this.network.getProxy().backWebSocket.send({method: "start_scan"}, "fireAndForget");
    }

    async readMopidyConfig() {
        let config = await this.network.getProxy().webRepository.getMopidyConfigFile();
    }

    async addExclExtToMopidyConfig(ext: string) {
        await this.network.getProxy().webRepository.addExclExtToMopidyConfigFile(ext)
    }

    async setRepeat(repeat: boolean) {
        await this.network.getProxy().mopidyRepository.setRepeat(repeat);
    }

    async setSingle(single: boolean) {
        await this.network.getProxy().mopidyRepository.setSingle(single);
    }

    async saveAlbumGenre(albumUri: AlbumUri, genre: string) {
        await this.network.getProxy().webRepository.setAlbumGenre(albumUri, genre);
    }

    async toggleFavorite(uri: AllUris) {
        await this.network.getProxy().webRepository.toggleFavorite(uri);
        this.model.setFavorites(null);
        await this.cache.getFavorites();
    }

    async setAlbumVolumeDown(uri: AllUris) {
        await this.network.getProxy().webRepository.albumVolumeDown(uri);
    }

    async setAlbumVolumeUp(uri: AllUris) {
        await this.network.getProxy().webRepository.albumVolumeUp(uri);
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

    async setCurrentBreadCrumbStack(stackName: string) {
        this.model.setCurrentBreadCrumbStackName(stackName);
    }

    async fetchPlaylistItems(uri: AllUris) {
        return this.network.getProxy().mopidyRepository.fetchPlaylistItems(uri)
    }

    async browse(uri: AllUris) {
        return this.network.getProxy().mopidyRepository.browse(uri);
    }

    async uploadAlbumData(uri: AlbumUri) {
        return this.network.getProxy().webRepository.uploadAlbumData(uri);
    }

    async uploadAlbumImages(albumUri: AlbumUri, imageUrl: string) {
        return this.network.getProxy().webRepository.uploadAlbumImages(albumUri, imageUrl);
    }

    async sendPlay() {
        return this.network.getProxy().mopidyRepository.sendPlay();
    }

    async sendStop() {
        return this.network.getProxy().mopidyRepository.sendStop();
    }

    async sendPause() {
        return this.network.getProxy().mopidyRepository.sendPause();
    }

    async sendVolume(value: number) {
        return this.network.getProxy().mopidyRepository.sendVolume(value);
    }

    async getGenreDefs() {
        return this.cache.getGenreDefs();
    }

    async getGenreReplacementsCached() {
        return this.cache.getGenreReplacementsCached();
    }
}

export default Controller
