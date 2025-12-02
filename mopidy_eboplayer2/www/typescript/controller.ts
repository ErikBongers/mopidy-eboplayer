import getState, {setState} from "./playerState";
import {showLoading} from "./functionsvars";
import {library} from "./library";
import {transformTlTrackDataToModel} from "./process_ws";
import {Model} from "./model";
import {Commands} from "./commands";
import models, {Mopidy} from "../js/mopidy";
import {EboPlayerDataType} from "./views/view";
import {DataRequester} from "./views/dataRequester";
import {MopidyProxy} from "./mopidyProxy";
import {LocalStorageProxy} from "./localStorageProxy";
import {numberedDictToArray, transformLibraryItem} from "./global";
import TlTrack = models.TlTrack;
import {console_yellow} from "./gui";
import {AllRefs, Refs, SomeRefs} from "./refs";
import {BreadCrumbBrowseFilter, BreadCrumbUri, BrowseFilter, ConnectionState, PlayState, StreamTitles} from "./modelTypes";

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
export class Controller extends Commands implements DataRequester{
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public localStorageProxy: LocalStorageProxy;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model  = model;
        this.mopidyProxy = new MopidyProxy(this, model, new Commands(mopidy));
        this.localStorageProxy = new LocalStorageProxy(model);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
    getRequiredDataTypesRecursive(): EboPlayerDataType[] {
        return this.getRequiredDataTypes();
    }

    initSocketevents () {
        this.mopidy.on('state:online', async () => {
            this.model.setConnectionState(ConnectionState.Online);
            await getState().getRequiredData();
            await this.mopidyProxy.fetchHistory();
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', this.mopidyProxy.fetchPlaybackOptions);

        this.mopidy.on('event:trackPlaybackStarted', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:playlistsLoaded', ()  => {
            showLoading(true);
            library.getPlaylists();
        });

        this.mopidy.on('event:playlistChanged', (data) => {
            delete getState().playlists[data.playlist.uri];
            library.getPlaylists();
        });

        this.mopidy.on('event:playlistDeleted', (data) => {
            delete getState().playlists[data.uri];
            library.getPlaylists();
        });

        this.mopidy.on('event:volumeChanged', (data) => {
            this.model.setVolume(data.volume);
        });

        this.mopidy.on('event:muteChanged', (_data) => {
        });

        this.mopidy.on('event:playbackStateChanged', (data) => {
            getState().getController().setPlayState(data.new_state);
        });

        this.mopidy.on('event:tracklistChanged', async () => {
            await this.mopidyProxy.fetchTracklistAndDetails();
            await this.mopidyProxy.fetchCurrentTrackAndDetails();
        });

        this.mopidy.on('event:seeked', () => {
            // controls.setPosition(data.time_position);
            if (getState().play) {
                getState().syncedProgressTimer.start();
            }
        });

        this.mopidy.on("event:streamHistoryChanged", (data) => {
            //ignore: old version.
        });

        this.mopidy.on("event:streamHistoryChanged2", (data) => {
            let streamTitles: StreamTitles = data.data;
            this.model.setActiveStreamLinesHistory(streamTitles);
        });

        //log all events:
        this.mopidy.on((data) => {
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

    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        this.model.setCurrentTrack(transformTlTrackDataToModel(data));
        await this.mopidyProxy.fetchActiveStreamLines();
        //todo: do this only when a track is started?s
        // this.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // this.core.playback.getState().then(processPlaystate, console.error)
        // this.core.mixer.getVolume().then(processVolume, console.error)
        // this.core.mixer.getMute().then(processMute, console.error)
    }

    setVolume(volume: number) {
        this.model.setVolume(volume);
    }

    setPlayState(state: string) {
        this.model.setPlayState(state as PlayState);
    }

    setTracklist(trackList: TlTrack[]) {
        this.model.setTrackList(trackList);
    }

    setAndSaveBrowseFilter(filter: BrowseFilter) {
        this.localStorageProxy.saveCurrentBrowseFilter(filter);
        this.model.setCurrentBrowseFilter(filter);
        this.filterBrowseResults();
    }

    diveIntoBrowseResult(label: string, uri: string, type: string) {
        // set 2 new breadCrumbs and a new browseFilter.
        // > setting the browseFilter should only trigger a view update. NOT a re-filter!!!
        let browseFilter = this.model.getCurrentBrowseFilter();
        let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
        this.model.pushBreadCrumb(breadCrumb1);

        let breadCrumb2 = new BreadCrumbUri(label, uri);
        this.model.pushBreadCrumb(breadCrumb2);

        this.localStorageProxy.saveBrowseFilterBreadCrumbs(this.model.getBreadCrumbs());

        let newBrowseFilter = new BrowseFilter();
        //for each type, we dive into the next level of type. E.g. artist -> album -> track.
        switch (type) {
            case "artist": newBrowseFilter.album = true; break;
            case "album": newBrowseFilter.track = true; break;
            case "genre": newBrowseFilter.album = true; break;
            //todo: playlist.
            //todo: case "track": play the darn track!
        }
        this.setAndSaveBrowseFilter(newBrowseFilter);
        this.fetchRefsForCurrentBreadCrumbs().then(() => {
            this.filterBrowseResults();
        });
    }

    resetToBreadCrumb(id: number) {
        let breadCrumb = getState().getModel().getBreadCrumbs().get(id);
        let breadCrumbs = getState().getModel().getBreadCrumbs();

        //if the breadCrumb is a browseFilter, reset to the previous breadCrumb and set the current browseFilter to the one in the breadCrumb.
        if(breadCrumb instanceof BreadCrumbBrowseFilter) {
            this.model.resetBreadCrumbsTo(id);
            let browseFilter = this.model.popBreadCrumb().data as BrowseFilter;
            this.setAndSaveBrowseFilter(browseFilter);
            this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            this.fetchRefsForCurrentBreadCrumbs().then(() => {
                this.filterBrowseResults();
            });
        }
        //todo: if the breadCrumb is a uri, reset to the CURRENT breadCrumb and clear the current browseFilter.
    }

    async getTrackInfoCached(uri: string) {
        let track  = getState().getModel().getTrackInfo(uri);
        if(!track)
            await this.lookupCached(uri);

        return transformLibraryItem(track);
    }

    async lookupCached(uri: string) {
        let tracks = this.model.getTrackFromCache(uri);
        if(tracks)
            return tracks;
        let dict = await this.mopidyProxy.fetchTracks(uri);
        this.model.addDictToLibraryCache(dict);
        return this.model.getTrackFromCache(uri);
    }

    async play(uri: string) {
        await this.mopidyProxy.clearTrackList();
        let tracks = await this.mopidyProxy.addTrackToTracklist(uri);
        let trackList = numberedDictToArray(tracks) as models.TlTrack[];
        this.setTracklist(trackList);
        // noinspection ES6MissingAwait
        this.mopidyProxy.playTracklistItem(trackList, 0);
        await this.setCurrentTrackAndFetchDetails(trackList[0]);
    }

    setSelectedTrack(uri: string) {
        this.model.setSelectedTrack(uri);
    }

    async getCurrertTrackInfoCached() {
        let trackUri = this.model.getCurrentTrack();
        return await this.getTrackInfoCached(trackUri);
    }

    async fetchAllRefs() {
        let roots = await this.mopidyProxy.fetchRootDirs();
        let subDir1 = await this.mopidyProxy.browse(roots[1].uri);
        let allTracks = await this.mopidyProxy.browse("local:directory?type=track");
        let allAlbums = await this.mopidyProxy.browse("local:directory?type=album");
        let allArtists = await this.mopidyProxy.browse("local:directory?type=artist");
        let allGenres = await this.mopidyProxy.browse("local:directory?type=genre");
        //todo: playlists.
        //todo: radios are tracks in playlists, that are not in the file system.

        return new AllRefs(roots, subDir1, allTracks, allAlbums, allArtists, allGenres);
    }

    filterBrowseResults() {
        this.model.filterCurrentRefs();
    }

    async fetchRefsForCurrentBreadCrumbs() {
        let breadCrumbs = this.model.getBreadCrumbs();
        let lastCrumb = breadCrumbs.getLast();
        if(!lastCrumb) {
            await this.setAllRefsAsCurrent();
            return;
        }
        if(lastCrumb instanceof BreadCrumbBrowseFilter) {
            await this.setAllRefsAsCurrent();
            return;
        }
        if(lastCrumb instanceof BreadCrumbUri) {
            let refs = await this.mopidyProxy.browse(lastCrumb.data);
            this.model.setCurrentRefs(new SomeRefs(refs));
            return;
        }
    }

    private async setAllRefsAsCurrent() {
        if (!this.model.getAllRefs()) {
            let allRefs = await this.fetchAllRefs();
            this.model.setAllRefs(allRefs);
        }
        this.model.setCurrentRefs(this.model.getAllRefs());
    }
}