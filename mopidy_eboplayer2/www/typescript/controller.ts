import getState from "./playerState";
import {showLoading} from "./functionsvars";
import {library} from "./library";
import {transformTlTrackDataToModel} from "./process_ws";
import {Model} from "./model";
import {Commands} from "./commands";
import models, {Mopidy} from "../js/mopidy";
import {EboPlayerDataType} from "./views/view";
import {DataRequester} from "./views/dataRequester";
import {MopidyProxy} from "./proxies/mopidyProxy";
import {LocalStorageProxy} from "./proxies/localStorageProxy";
import {numberedDictToArray, transformLibraryItem} from "./global";
import {AllRefs, SomeRefs} from "./refs";
import {AlbumData, AlbumDataLoaded, AlbumDataType, AlbumNone, AlbumStreamLinesLoaded, BreadCrumbBrowseFilter, BreadCrumbRef, BrowseFilter, ConnectionState, PlayState, StreamTitles, TrackModel, TrackType, Views} from "./modelTypes";
import {JsonRpcController} from "./jsonRpcController";
import {WebProxy} from "./proxies/webProxy";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Track = models.Track;

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
export class Controller extends Commands implements DataRequester{
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public webProxy: WebProxy;
    public localStorageProxy: LocalStorageProxy;
    private eboWebSocketCtrl: JsonRpcController;

    constructor(model: Model, mopidy: Mopidy, eboWebSocketCtrl: JsonRpcController) {
        super(mopidy);
        this.model  = model;
        this.mopidyProxy = new MopidyProxy(this, model, new Commands(mopidy));
        this.webProxy = new WebProxy(model);
        this.localStorageProxy = new LocalStorageProxy(model);
        this.eboWebSocketCtrl = eboWebSocketCtrl;
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
            this.setPlayState("playing");
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
        this.eboWebSocketCtrl.on("event:streamHistoryChanged", (data) => {
            let streamTitles: StreamTitles = data.data;
            this.model.setActiveStreamLinesHistory(streamTitles);
        });
    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        this.model.setCurrentTrack(transformTlTrackDataToModel(data));
        await this.webProxy.fetchActiveStreamLines();
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
        if(type == "track"  ||  type  == "radio") {
            this.clearListAndPlay(uri).then(() => {});
            return; //don't dive.
        }

        if(type == "album") {
            this.model.setAlbumToView(uri);
            this.setView(Views.Album);
            return;
        }
        // set 2 new breadCrumbs and a new browseFilter.
        // > setting the browseFilter should only trigger a view update. NOT a re-filter!!!
        let browseFilter = this.model.getCurrentBrowseFilter();
        let breadCrumb1 = new BreadCrumbBrowseFilter(browseFilter.searchText, browseFilter);
        this.model.pushBreadCrumb(breadCrumb1);

        let ref: Ref = {type: type as models.ModelType, name: label, uri};
        let breadCrumb2 = new BreadCrumbRef(label, ref);
        this.model.pushBreadCrumb(breadCrumb2);

        this.localStorageProxy.saveBrowseFilterBreadCrumbs(this.model.getBreadCrumbs());

        let newBrowseFilter = new BrowseFilter();
        //for each type, we dive into the next level of type. E.g. artist -> album -> track.
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

    async clearListAndPlay(uri: string) {
        await this.mopidyProxy.clearTrackList();
        let trackList = await this.addToPlaylist(uri);
        // noinspection ES6MissingAwait
        this.play(trackList[0].tlid);
    }

    async play(tlid: number) {
        // noinspection ES6MissingAwait
        this.mopidyProxy.playTracklistItem(tlid);
    }

    private async addToPlaylist(uri: string) {
        let tracks = await this.mopidyProxy.addTrackToTracklist(uri);
        let trackList = numberedDictToArray(tracks) as models.TlTrack[];
        this.setTracklist(trackList);
        return trackList;
    }

    setSelectedTrack(uri: string) {
        this.model.setSelectedTrack(uri);
    }

    async getCurrertTrackInfoCached() {
        let trackUri = this.model.getCurrentTrack();
        if(!trackUri)
            return undefined;
        return await this.getTrackInfoCached(trackUri);
    }

    async fetchAllRefs() {
        let roots = await this.mopidyProxy.fetchRootDirs();
        let subDir1 = await this.mopidyProxy.browse(roots[1].uri);
        let allTracks = await this.mopidyProxy.browse("local:directory?type=track");
        let allAlbums = await this.mopidyProxy.browse("local:directory?type=album");
        let allArtists = await this.mopidyProxy.browse("local:directory?type=artist");
        let allGenres = await this.mopidyProxy.browse("local:directory?type=genre");
        let playLists = await this.mopidyProxy.fetchPlayLists();
        let radioStreamsPlayList = playLists.find(playlist => playlist.name == "[Radio Streams]");
        let playlists = playLists.filter(playlist => playlist.name != "[Radio Streams]");
        let radioStreams: models.Ref[];
        if(radioStreamsPlayList) {
            radioStreams = await this.mopidyProxy.fetchPlaylistItems(radioStreamsPlayList.uri);
        }

        return new AllRefs(roots, subDir1, allTracks, allAlbums, allArtists, allGenres, radioStreams, playlists);
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
        if(lastCrumb instanceof BreadCrumbRef) {
            if(lastCrumb.data.type == "playlist") {
                let playlistItems = await this.mopidyProxy.fetchPlaylistItems(lastCrumb.data.uri);
                playlistItems.forEach(ref => {
                    //"local:track:Air/Moon%20Safari/01%20La%20Femme%20d%27Argent.wma"
                    ref.name = ref.uri
                        .replace("local:track:", "")
                        .replaceAll("%20", " ");
                    //remove the last part of the uri, which is the file extension.
                    ref.name = ref.name.split(".").slice(0,-1).join(".");
                });
                this.model.setCurrentRefs(new SomeRefs(playlistItems));
                return;
            }
            let refs = await this.mopidyProxy.browse(lastCrumb.data.uri);
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

    playAlbum(albumUri: string) {
        this.clearListAndPlay(albumUri);
    }

    addAlbum(albumUri: string) {
        this.addToPlaylist(albumUri);
    }

    async fetchAlbumDataForTrack(track: TrackModel) {
        if (!track)
            return AlbumNone;
        let albumInfo: AlbumData = AlbumNone;
        switch (track.type) {
            case TrackType.File:
                console.log(track.track.album.uri);
                let album = await this.lookupCached(track.track.album.uri);
                let albumTracks = numberedDictToArray<Track>(album);
                albumInfo = <AlbumDataLoaded>{
                    type: AlbumDataType.Loaded,
                    tracks: albumTracks,
                    albumTrack: track.track
                };
                return albumInfo;
            case TrackType.Stream:
                let stream_lines = await this.webProxy.fetchAllStreamLines(track.track.uri);
                let groupLines = function (grouped: string[][], line: string){
                    if(line == "---") {
                        grouped.push([]);
                        return grouped;
                    }
                    grouped[grouped.length-1].push(line);
                    return grouped;
                }
                let grouped = stream_lines
                    .reduce<string[][]>(groupLines, new Array([]))
                    .filter(lineGroup => lineGroup.length);
                albumInfo = <AlbumStreamLinesLoaded>{
                    type: AlbumDataType.StreamLinesLoaded,
                    lines: grouped,
                    albumTrack: track.track
                };
                return albumInfo;
        }
    }

    setView(view: Views) {
        this.model.setView(view);
    }
}