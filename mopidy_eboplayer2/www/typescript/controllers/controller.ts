import {Model} from "../model";
import {Commands} from "../commands";
import models, {core, Mopidy} from "../../js/mopidy";
import {DataRequester} from "../views/dataRequester";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort, getHostAndPortDefs, isStream} from "../global";
import {createAllRefs, ExpandedRef, SomeRefs} from "../refs";
import {AlbumModel, AlbumUri, AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, ConnectionState, EboPlayerDataType, ExpandedAlbumModel, ExpandedFileTrackModel, ExpandedHistoryLineGroup, ExpandedStreamModel, FileTrackModel, GenreDef, isBreadCrumbForAlbum, NoStreamTitles, PlaylistUri, PlayState, RememberDef, RememberId, StreamTitles, StreamTrackModel, StreamUri, TrackNone, TrackUri, Views} from "../modelTypes";
import {JsonRpcController} from "../jsonRpcController";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import {View} from "../views/view";
import {RefArgs} from "../events";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Playlist = models.Playlist;
import PlaybackState = core.PlaybackState;
import {CacheHandler} from "./cacheHandler";

export const LIBRARY_PROTOCOL = "eboback:";

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
export class Controller extends Commands implements DataRequester{
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public webProxy: WebProxy;
    public localStorageProxy: LocalStorageProxy;
    private eboWsFrontCtrl: JsonRpcController;
    private eboWsBackCtrl: JsonRpcController;
    protected player: PlayController;
    cache: CacheHandler;

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
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
    getRequiredDataTypesRecursive(): EboPlayerDataType[] {
        return this.getRequiredDataTypes();
    }

    async getRequiredData(views: View[])  {
        let requiredData = new Set<EboPlayerDataType>();
        views.forEach(v => {
            v.getRequiredDataTypesRecursive().forEach((dataType: EboPlayerDataType) => requiredData.add(dataType));
        });
        this.getRequiredDataTypesRecursive().forEach((dataType => requiredData.add(dataType)));

        for (const dataType of requiredData) {
            await this.fetchRequiredData(dataType);
        }

        await this.cache.fetchAllAlbums();
        this.localStorageProxy.loadCurrentBrowseFilter();
        this.localStorageProxy.loadBrowseFiltersBreadCrumbs();
        await this.fetchRefsForCurrentBreadCrumbs();
        await this.filterBrowseResults();
        await this.cache.getGenreDefsCached();
        await this.cache.getRemembersCached();
    }

    initialize (views: View[]) {
        this.mopidy.on('state:online', async () => {
            this.model.setConnectionState(ConnectionState.Online);
            await this.getRequiredData(views);
            this.model.setHistory(await this.webProxy.fetchHistory());
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', async () =>{
            this.model.setPlaybackState(await this.mopidyProxy.fetchPlaybackOptions());
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
        });
        this.eboWsFrontCtrl.on("event:programTitleChanged", (data: {program_title: string}) => {
            this.model.setCurrentProgramTitle(data.program_title);
        });
        this.model.addEboEventListener("playbackStateChanged.eboplayer", async () => {
            await this.updateStreamLines();
        });
        this.eboWsBackCtrl.on((data: any) => {
            console.log(data);
        });
        this.eboWsBackCtrl.on("event:scanStarted", (data: any) => {
            this.model.setScanStatus("Scan started...\n");
        });
        this.eboWsBackCtrl.on("event:scanStatus", (data: any) => {
            this.model.setScanStatus(this.model.getScanStatus() + (data.message as string) + "\n");
        });
        this.eboWsBackCtrl.on("event:scanFinished", (data: any) => {
            this.model.setScanStatus(this.model.getScanStatus() + "Scan completed.");
            this.model.dispatchEboEvent("scanFinished.eboplayer", {});
        });
    }

    async fetchRequiredData(dataType: EboPlayerDataType) {
        switch (dataType) {
            case EboPlayerDataType.Volume:
                let volume = await this.mopidyProxy.fetchVolume();
                this.model.setVolume(volume);
                break;
            case  EboPlayerDataType.CurrentTrack:
                let track = await this.mopidyProxy.fetchCurrentTlTrack();
                await this.setCurrentTrackAndFetchDetails(track);
                break;
            case  EboPlayerDataType.PlayState:
                let state = await this.mopidyProxy.fetchPlayState();
                this.model.setPlayState(state as PlayState);
                break;
            case  EboPlayerDataType.TrackList:
                this.model.setTrackList(await this.mopidyProxy.fetchTracklist());
                break;
        }
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

    async setAndSaveBrowseFilter(filter: BrowseFilter) {
        this.localStorageProxy.saveCurrentBrowseFilter(filter);
        this.model.setCurrentBrowseFilter(filter);
        await this.filterBrowseResults();
    }

    async diveIntoBrowseResult(label: string, uri: AllUris, type: string, addTextFilterBreadcrumb: boolean) {
        if(type  == "radio") { //todo
            return; //don't dive.
        }
        if(type == "track") {
            let track = await this.getExpandedTrackModel(uri as TrackUri) as ExpandedFileTrackModel;
            if(track.album?.albumInfo?.uri)
                this.showAlbum(track.album?.albumInfo?.uri, uri as TrackUri);
            //else: don't dive
            return; //don't change the breadcrumb and filter.
        }

        if(type == "album") {
            this.getExpandedAlbumModel(uri as AlbumUri).then(() => { //fetch before changing view, to avoid flicker.
                this.showAlbum(uri as AlbumUri, null);
            });
        }

        // set 2 new breadCrumbs and a new browseFilter.
        // > setting the browseFilter should only trigger a view update. NOT a re-filter!!!
        if(addTextFilterBreadcrumb) {
            let browseFilter = this.model.getCurrentBrowseFilter();
            if(! browseFilter.isEmpty()) {
                let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
                this.model.pushBreadCrumb(breadCrumb1);
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
                break;
        }
        await this.setAndSaveBrowseFilter(newBrowseFilter);

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
                this.showAlbum(breadCrumb.data.uri, null);
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
            let streamLines = await this.fetchStreamLines(trackUri);
            let remembers = await this.cache.lookupRemembersCached(); //todo: put this in a pre-fetch
            let rememberStrings = remembers.map(r => r.text);
            let expandedStreamLines = streamLines.map(lines => {
                let lineStr = lines.join("\n");
                let expandedLineGroup: ExpandedHistoryLineGroup = {
                    lines,
                    remembered: rememberStrings.includes(lineStr)
                };
                return expandedLineGroup;
            });
            // noinspection UnnecessaryLocalVariableJS
            return new ExpandedStreamModel(track, expandedStreamLines);
        }
        if(track) {
            let uri = track?.track?.album?.uri;
            let album: AlbumModel | null = null;
            if(uri) {
                let albums = await this.cache.lookupAlbumsCached([uri]);
                album = albums[0];
            }
            return new ExpandedFileTrackModel(track, album);
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
                this.model.setCurrentRefs(new SomeRefs(this.cache, playlistItems));
                return;
            }

            let refs = await this.mopidyProxy.browse(lastCrumb.data.uri);
            this.model.setCurrentRefs(new SomeRefs(this.cache, refs));
            return;
        }
    }

    private async setAllRefsAsCurrent() {
        this.model.setCurrentRefs(await this.cache.getAllRefsCached());
    }

    async fetchStreamLines(streamUri: string) {
        let stream_lines = await this.webProxy.fetchAllStreamLines(streamUri);
        function groupLines (grouped: string[][], line: string) {
            if(line == "---") {
                grouped.push([]);
                return grouped;
            }
            grouped[grouped.length-1].push(line);
            return grouped;
        }
        return stream_lines
            .reduce<string[][]>(groupLines, new Array([]))
            .filter(lineGroup => lineGroup.length); // remove empty groups.
    }

    setView(view: Views) {
        this.model.setView(view);
    }

    async addCurrentSearchResultsToPlayer() {
        let results = this.model.getCurrentSearchResults();
        await this.player.add(results.refs.map(r => r.item.uri as AllUris));
    }

    async createPlaylist(name: string) {
        return this.mopidyProxy.createPlaylist(name)
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: string, sequence: number) {
        return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
    }

    showAlbum(albumUri: AlbumUri, selectedTrackUri: TrackUri | null) {
        this.model.setAlbumToView(albumUri, selectedTrackUri);
        this.model.setView(Views.Album);
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

    async browseToArtist(args: RefArgs) {
        await this.clearBreadCrumbs();
        await this.diveIntoBrowseResult(args.name, args.uri, args.type, false);
        this.setView(Views.Browse);
    }
}
