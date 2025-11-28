import getState from "./playerState";
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
import {Refs} from "./refs";
import {BrowseFilter, ConnectionState, PlayState, StreamTitles} from "./modelTypes";

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

    setSaveAndApplyFilter(filter: BrowseFilter) {
        this.localStorageProxy.saveBrowseFilters(filter);
        this.model.setBrowseFilter(filter);
        this.model.filterRefs();
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

    async playTrack(uri: string) {
        await this.mopidyProxy.clearTrackList();
        let tracks = await this.mopidyProxy.addTrackToTracklist(uri);
        let trackList = numberedDictToArray(tracks) as models.TlTrack[];
        this.setTracklist(trackList);
        // noinspection ES6MissingAwait
        this.mopidyProxy.playTracklistItem(trackList);
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
        let artists = await this.mopidyProxy.fetchTracksforArtist();

        let refs = new Refs(roots, subDir1, allTracks, allAlbums, artists);
        this.model.setRefs(refs);
    }
}