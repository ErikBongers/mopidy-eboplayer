import {Model} from "../model";
import {Commands} from "../commands";
import models, {core, Mopidy} from "../../js/mopidy";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort} from "../global";
import {createAllRefs, Refs, RefType, SomeRefs} from "../refs";
import {AlbumModel, AlbumUri, AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, ConnectionState, ExpandedAlbumModel, ExpandedFileTrackModel, ExpandedStreamModel, isBreadCrumbForAlbum, LastViewed, MessageType, NoStreamTitles, PlaylistUri, PlayState, RememberId, StreamTitles, StreamUri, TrackNone, TrackUri, Views} from "../modelTypes";
import {JsonRpcController} from "../jsonRpcController";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import {View} from "../views/view";
import {CacheHandler} from "./cacheHandler";
import {ViewController} from "./viewController";
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
        await this.fetchRefsForCurrentBreadCrumbs();
        await this.filterBrowseResults();
        await this.cache.getGenreReplacementsCached();
        await this.cache.getRemembersCached();
        await this.cache.getGenreDefs();
        await this.cache.getFavorites();
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

        this.mopidy.on('event:trackPlaybackStarted', async (data: {tl_track: TlTrack}) => { //todo: try to link `name` argument to `data` type automatically.
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
            console.log(data);
        });
        this.eboWsFrontCtrl.on("event:streamHistoryChanged", (data: {stream_titles: StreamTitles}) => {
            let streamTitles: StreamTitles = data.stream_titles;
            this.model.setActiveStreamLinesHistory(streamTitles);
            this.model.setStreamLinesHistory(streamTitles.uri as StreamUri, null);
        });
        this.eboWsFrontCtrl.on("event:programTitleChanged", (data: {program_title: string}) => {
            this.model.setCurrentProgramTitle(data.program_title);
        });
        this.eboWsBackCtrl.on((data: any) => {
            console.log(data);
        });
        this.eboWsBackCtrl.on("event:scanStarted", (data: any) => {
            this.model.setScanStatus(`${data.message}\n`);
        });
        this.eboWsBackCtrl.on("event:scanStatus", (data: any) => {
            this.model.setScanStatus(this.model.getScanStatus() + (data.message as string) + "\n");
        });
        this.eboWsBackCtrl.on("event:scanFinished", (data: any) => {
            this.model.setScanStatus(this.model.getScanStatus() + "Scan completed.");
            this.model.dispatchEboEvent("scanFinished.eboplayer", {});
        });
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
            this.model.setActiveStreamLinesHistory(NoStreamTitles);
            return;
        }
        if (this.model.currentTrack == null) {
            this.model.setActiveStreamLinesHistory(NoStreamTitles);
            return;
        }

        let trackModel = await this.cache.lookupTrackCached(this.model.currentTrack);
        if (trackModel?.type == "stream") {
            let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack as StreamUri);
            this.model.setActiveStreamLinesHistory(lines);
        } else {
            this.model.setActiveStreamLinesHistory(NoStreamTitles);
        }
    }

    async setAndSaveBrowseFilter(filter: BrowseFilter, applyFilter: "apply" | "dontApply" = "apply") {
        this.localStorageProxy.saveCurrentBrowseFilter(filter);
        this.model.setCurrentBrowseFilter(filter);
        if(applyFilter == "apply")
            await this.filterBrowseResults();
    }

    async diveIntoBrowseResult(label: string, uri: AllUris, type: string, addTextFilterBreadcrumb: boolean) {
        if(type == "track") {
            let track = await this.getExpandedTrackModel(uri as TrackUri) as ExpandedFileTrackModel;
            if(track.album?.albumInfo?.uri)
                this.viewController.showAlbum(track.album?.albumInfo?.uri, uri as TrackUri);
            //else: don't dive
            return; //don't change the breadcrumb and filter.
        }

        if(type == "album") {
            this.viewController.gotoAlbum(uri as AlbumUri);
        }

        if(type  == "radio") {
            this.getExpandedTrackModel(uri as StreamUri).then(() => { //fetch before changing view, to avoid flicker.
                this.viewController.showRadio(uri as StreamUri);
            });
        }

        // set 2 new breadCrumbs and a new browseFilter.
        // > setting the browseFilter should only trigger a view update. NOT a re-filter!!!
        if(addTextFilterBreadcrumb) {
            let browseFilter = this.model.getCurrentBrowseFilter();
            if(! browseFilter.isEmpty()) {
                let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
                this.model.pushBreadCrumb(breadCrumb1, "noDispatch");
            }
        }
        let ref: Ref<AllUris> = {type: type as models.ModelType, name: label, uri};
        let breadCrumb2 = new BreadCrumbRef(label, ref);
        this.model.pushBreadCrumb(breadCrumb2);

        this.localStorageProxy.saveBrowseFilterBreadCrumbs(this.model.getBreadCrumbs());

        let newBrowseFilter = new BrowseFilter();
        //for each type, we dive into the next level of type. E.g., artist -> album -> track.
        switch (type) {
            case "artist": newBrowseFilter.album = true; break;
            case "genre":
                newBrowseFilter.radio = true;
                newBrowseFilter.playlist = true;
                newBrowseFilter.artist = true;
                newBrowseFilter.album = true;
                newBrowseFilter.track = true;
                newBrowseFilter.genre = true;
                break;
            case "playlist":
                newBrowseFilter.playlist = true;
                newBrowseFilter.artist = true;
                newBrowseFilter.album = true;
                newBrowseFilter.track = true;
                newBrowseFilter.radio = true;
                break;
        }
        await this.setAndSaveBrowseFilter(newBrowseFilter, "dontApply");

        await this.fetchRefsForCurrentBreadCrumbs()
        await this.filterBrowseResults();
    }

    async setWhatsNewFilter() {
        await this.clearBreadCrumbs();
        let browseFilter = new BrowseFilter();
        browseFilter.addedSince = 1;
        this.localStorageProxy.saveCurrentBrowseFilter(browseFilter);
        this.model.setCurrentBrowseFilter(browseFilter);
    }

    async clearBreadCrumbs() {
        this.model.resetBreadCrumbsTo(this.model.getBreadCrumbs()[0].id);
    }

    async resetToBreadCrumb(id: number) {
        let breadCrumb = this.model.getBreadCrumbs().get(id);
        let breadCrumbs = this.model.getBreadCrumbs();

        //if the breadCrumb is a browseFilter, reset to the previous breadCrumb and set the current browseFilter to the one in the breadCrumb.
        if(breadCrumb instanceof BreadCrumbBrowseFilter) {
            this.model.resetBreadCrumbsTo(id);
            let browseFilter = this.model.popBreadCrumb()?.data as BrowseFilter;
            await this.setAndSaveBrowseFilter(browseFilter);
            this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            await this.fetchRefsForCurrentBreadCrumbs()
            await this.filterBrowseResults();
        } else if(breadCrumb instanceof BreadCrumbRef) {
            if(isBreadCrumbForAlbum(breadCrumb)) {
                this.viewController.showAlbum(breadCrumb.data.uri, null);
                return;
            }
            this.model.resetBreadCrumbsTo(id);
            this.model.popBreadCrumb(); // remove the current breadCrumb as it will be added again below.
            await this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
        } else if (breadCrumb instanceof BreadCrumbHome) {
            this.model.resetBreadCrumbsTo(id);
            await this.setAndSaveBrowseFilter(new BrowseFilter());
            this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            await this.fetchRefsForCurrentBreadCrumbs()
            await this.filterBrowseResults();
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

    async filterBrowseResults() {
        await this.model.filterCurrentRefs();
    }

    async fetchRefsForCurrentBreadCrumbs() {
        let breadCrumbs = this.model.getBreadCrumbs();
        let lastCrumb = breadCrumbs.getLast();
        if(!lastCrumb) {
            await this.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbHome) {
            await this.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbBrowseFilter) {
            await this.setAllRefsAsCurrent();
            return;
        }

        if(lastCrumb instanceof BreadCrumbRef) {
            if(lastCrumb.data.type == "playlist") {
                let playlistItems = await this.mopidyProxy.fetchPlaylistItems(lastCrumb.data.uri);
                playlistItems.forEach(ref => {
                    //"local:track:Air/Moon%20Safari/01%20La%20Femme%20d%27Argent.wma"

                    if(!ref.name || ref.name == "") {
                        ref.name = ref.uri
                            .replace(LIBRARY_PROTOCOL + "track:", "")
                            .replaceAll("%20", " ");
                        //remove the last part of the uri, which is the file extension.
                        ref.name = ref.name.split(".").slice(0, -1).join(".");
                    }
                });
                let results = await Refs.transformRefsToSearchResults(this.cache, playlistItems);
                this.model.setCurrentRefs(new SomeRefs(results));
                return;
            }

            let refs = await this.mopidyProxy.browse(lastCrumb.data.uri);
            let results = await Refs.transformRefsToSearchResults(this.cache, refs);
            this.model.setCurrentRefs(new SomeRefs(results));
            return;
        }
    }

    private async setAllRefsAsCurrent() {
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

    async remember(s: string) {
        let _status = await this.webProxy.remember(s);
        this.model.setRemembers(null);
    }

    async startScan() {
        await this.eboWsBackCtrl.send({method: "start_scan"}, "fireAndForget");
    }

    async deleteRemember(id: RememberId) {
        await this.webProxy.deleteRemember(id);
        this.model.setRemembers(null);
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

    async isFavorite(uri: AllUris | undefined | null) {
        if(!uri)
            return false;
        let favorites = await this.cache.getFavorites();
        return favorites.has(uri);
    }

    async gotoFavorites() {
        let favoritesName = "Favorites"; //todo: get from settings.
        let allRefs = await this.cache.getAllRefsCached();
        console.log(allRefs);
        let favoritesRef = allRefs.playlists.find(res => res.item.name == favoritesName);
        console.log(favoritesRef);
        if(!favoritesRef)
            return;
        await this.clearBreadCrumbs();
        await this.diveIntoBrowseResult(favoritesName, favoritesRef.item.uri, "playlist", false);
        this.viewController.setView(Views.Browse);
    }

    showTempMessage(message: string, type: MessageType) {
        this.model.setTempMessage({message, type});
    }
}

export default Controller
