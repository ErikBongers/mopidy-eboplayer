import getState from "../playerState";
import {Model} from "../model";
import {Commands} from "../commands";
import models, {core, Mopidy} from "../../js/mopidy";
import {EboPlayerDataType} from "../views/view";
import {DataRequester} from "../views/dataRequester";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort, getHostAndPortDefs, transformTrackDataToModel} from "../global";
import {AllRefs, SomeRefs} from "../refs";
import {AlbumModel, AlbumUri, AllUris, ArtistUri, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, ConnectionState, ExpandedAlbumModel, ExpandedFileTrackModel, ExpandedStreamModel, FileTrackModel, GenreUri, ImageUri, isBreadCrumbForAlbum, isBreadCrumbForArtist, NoStreamTitles, PartialAlbumModel, PlaylistUri, PlayState, RadioUri, StreamTitles, StreamTrackModel, TrackModel, TrackNone, TrackUri, Views} from "../modelTypes";
import {JsonRpcController} from "../jsonRpcController";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Playlist = models.Playlist;
import PlaybackState = core.PlaybackState;

export const LIBRARY_PROTOCOL = "eboback:";

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
export class Controller extends Commands implements DataRequester{
    protected model: Model;
    public mopidyProxy: MopidyProxy;
    public webProxy: WebProxy;
    public localStorageProxy: LocalStorageProxy;
    private eboWebSocketCtrl: JsonRpcController;
    readonly baseUrl: string;
    public static readonly DEFAULT_IMG_URL = "images/default_cover.png";
    protected player: PlayController;

    constructor(model: Model, mopidy: Mopidy, eboWebSocketCtrl: JsonRpcController, mopdyProxy: MopidyProxy, player: PlayController) {
        super(mopidy);
        this.model  = model;
        this.player = player;
        this.mopidyProxy = mopdyProxy;
        this.webProxy = new WebProxy(getHostAndPort());
        this.localStorageProxy = new LocalStorageProxy(model);
        this.eboWebSocketCtrl = eboWebSocketCtrl;
        let portDefs = getHostAndPortDefs();
        this.baseUrl = "";
        if(portDefs.altHost && portDefs.altHost != portDefs.host)
            this.baseUrl = "http://"+portDefs.altHost;
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
            this.model.setHistory(await this.mopidyProxy.fetchHistory());
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
            this.model.setPlayState("stopped"); //don't rely solely on the state changes!
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data: {tl_track: TlTrack}) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
        });

        this.mopidy.on('event:playlistsLoaded', ()  => {
            // library.getPlaylists();
        });

        this.mopidy.on('event:playlistChanged', (data: {playlist: Playlist}) => {
            // delete getState().playlists[data.playlist.uri];
            // library.getPlaylists();
        });

        this.mopidy.on('event:playlistDeleted', (data: {uir: PlaylistUri}) => {
            // delete getState().playlists[data.uri];
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
        this.eboWebSocketCtrl.on("event:streamHistoryChanged", (data: {stream_titles: StreamTitles}) => {
            let streamTitles: StreamTitles = data.stream_titles;
            this.model.setActiveStreamLinesHistory(streamTitles);
        });
        this.model.addEboEventListener("playbackStateChanged.eboplayer", async () => {
            await this.updateStreamLines();
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
        let trackModel = await this.lookupTrackCached(data.track.uri);
        this.model.setCurrentTrack(trackModel);
        if(!this.model.selectedTrack)
            this.model.setSelectedTrack(trackModel?.track?.uri ?? null);
        await this.updateStreamLines();

        //todo: do this only when a track is started?s
        // this.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // this.core.mixer.getMute().then(processMute, console.error)
    }

    private async updateStreamLines() {
        if (this.model.getPlayState() == "playing") {
            if (!this.model.currentTrack) {
                this.model.setActiveStreamLinesHistory(NoStreamTitles);
                return;
            }
            let lines = await this.webProxy.fetchActiveStreamLines(this.model.currentTrack);
            this.model.setActiveStreamLinesHistory(lines);
        } else
            this.model.setActiveStreamLinesHistory(NoStreamTitles);
    }

    private async fetchLargestImagesOrDefault(uris: AllUris[]) {
        function getImageUrl(uri: AllUris, baseUrl: string) {
            let arr = images[uri];
            arr.sort((imgA, imgB) => (imgA.width * imgA.height) - (imgB.width * imgB.height));
            if (arr.length == 0)
                return Controller.DEFAULT_IMG_URL;
            let imageUrl = arr.pop()?.uri;
            if ((imageUrl?? "") == "")
                imageUrl = Controller.DEFAULT_IMG_URL;
            return baseUrl + imageUrl as ImageUri;
        }
        let images = await this.mopidyProxy.fetchImages(uris);
        let mappedImage: [ImageUri, string][] = uris.map(uri => {
            let imageUrl = getImageUrl(uri, this.baseUrl);
            return [uri as ImageUri, imageUrl];
        });
        return new Map(mappedImage);
    }

    setAndSaveBrowseFilter(filter: BrowseFilter) {
        this.localStorageProxy.saveCurrentBrowseFilter(filter);
        this.model.setCurrentBrowseFilter(filter);
        this.filterBrowseResults();
    }

    diveIntoBrowseResult(label: string, uri: AllUris, type: string, addTextFilterBreadcrumb: boolean) {
        if(type == "track"  ||  type  == "radio") {
            return; //don't dive.
        }

        if(type == "album") {
            getState().getController().getExpandedAlbumModel(uri as AlbumUri).then(() => { //fetch before changing view, to avoid flicker.
                this.model.setAlbumToView(uri as AlbumUri);
                this.setView(Views.Album);
            })
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
            let browseFilter = this.model.popBreadCrumb()?.data as BrowseFilter;
            this.setAndSaveBrowseFilter(browseFilter);
            this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            this.fetchRefsForCurrentBreadCrumbs().then(() => {
                this.filterBrowseResults();
            });
        } else if(breadCrumb instanceof BreadCrumbRef) {
            if(isBreadCrumbForAlbum(breadCrumb)) {
                this.model.setAlbumToView(breadCrumb.data.uri);
                this.setView(Views.Album);
                return;
            }
            this.model.resetBreadCrumbsTo(id);
            this.model.popBreadCrumb(); // remove the current breadCrumb as it will be added again below.
            this.diveIntoBrowseResult(breadCrumb.label, breadCrumb.data.uri, breadCrumb.data.type, false);
        } else if (breadCrumb instanceof BreadCrumbHome) {
            this.model.resetBreadCrumbsTo(id);
            this.setAndSaveBrowseFilter(new BrowseFilter());
            this.localStorageProxy.saveBrowseFilterBreadCrumbs(breadCrumbs);
            this.fetchRefsForCurrentBreadCrumbs().then(() => {
                this.filterBrowseResults();
            });
        }
    }

    async lookupTrackCached(trackUri: TrackUri | null) {
        if(!trackUri)
            return null;
        let item = this.model.getFromLibraryCache(trackUri);
        if(item)
            return item as FileTrackModel | StreamTrackModel;

        let libraryList = await this.fetchAndConvertTracks(trackUri);
        this.model.addItemsToLibraryCache(libraryList);
        return this.model.getFromLibraryCache(trackUri) as FileTrackModel | StreamTrackModel | null; //assuming the trackUri points to a file or a stream.
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
        let fetchedAlbums = await this.fetchAlbums(albumUrisToFetch);
        this.model.addItemsToLibraryCache(fetchedAlbums);
        albums = albums.concat(fetchedAlbums);
        return albums;
    }

    private async fetchAlbums(albumUris: AlbumUri[]): Promise<AlbumModel[]> {
        let dict = await this.mopidyProxy.lookup(albumUris);
        let albumModelsPending = Object.keys(dict).map(async albumUri => {
            let trackList = dict[albumUri] as models.Track[];
            let albumModel: PartialAlbumModel = {
                type: "album",
                albumInfo: trackList[0].album,
                tracks: trackList.map(track => track.uri),
            }
            return albumModel;
        });
        let partialAlbumModels = await Promise.all(albumModelsPending);

        let images = await this.fetchLargestImagesOrDefault(partialAlbumModels.map(album => album.albumInfo.uri));
        this.model.addImagesToCache(images);
        let albumModels = partialAlbumModels.map(m => {
            return {...m, imageUrl:this.model.getImageFromCache(m.albumInfo.uri)} as AlbumModel;
        });
        this.model.addItemsToLibraryCache(albumModels);
        return albumModels;
    }

    async lookupAllTracks(uris: AllUris[]) {
        let results = await this.mopidyProxy.lookup(uris);
        let partialModels = Object.keys(results).map(trackUri => {
            let track = results[trackUri][0];
            return transformTrackDataToModel(track)
        });
        let fileModels = partialModels.filter(m => m.type == "file");
        let partialStreamModels = partialModels.filter(m => m.type == "stream");
        let streamUris = partialStreamModels.map(stream => stream.track.uri) as TrackUri[];
        let images = await this.fetchLargestImagesOrDefault(streamUris);
        this.model.addImagesToCache(images);
        let streamModels = partialStreamModels
            .map(m => {
                return {...m, imageUrl:this.model.getImageFromCache(m.track.uri as TrackUri)} as StreamTrackModel;
            });
        this.model.addItemsToLibraryCache(fileModels);
        this.model.addItemsToLibraryCache(streamModels);
    }

    async lookupImageCached(uri: AllUris) {
        let imgUrl = this.model.getImageFromCache(uri);
        if(imgUrl)
            return imgUrl;
        let images = await this.mopidyProxy.fetchImages([uri]);
        if(images[uri].length == 0) {
            this.model.addImageToCache(uri, Controller.DEFAULT_IMG_URL);
            return Controller.DEFAULT_IMG_URL;
        }
        let img = images[uri][0];
        this.model.addImageToCache(uri, img.uri);
        return img.uri;
    }

    private async fetchAndConvertTracks(uri: TrackUri) {
        let dict = await this.mopidyProxy.lookup(uri);
        let trackList = dict[uri] as models.Track[];
        let newListPromises = trackList.map(async track => {
            let model = transformTrackDataToModel(track);
            if(model.type == "stream") {
                let images = await this.mopidyProxy.fetchImages([track.uri]);
                let imageUrl = "";
                if(images[track.uri].length > 0)
                    imageUrl = this.baseUrl + images[track.uri][0].uri;
                else
                    imageUrl = Controller.DEFAULT_IMG_URL;
                return {...model, imageUrl} as StreamTrackModel;
            }
            return model;
        });
        return await Promise.all(newListPromises);
    }

    async getExpandedTrackModel(trackUri: TrackUri | null): Promise<ExpandedStreamModel | ExpandedFileTrackModel | null>{
        if(!trackUri)
            return null;
        let track = await this.lookupTrackCached(trackUri);
        if(track?.type == "stream") {
            let streamLines = await this.fetchStreamLines(trackUri);
            // noinspection UnnecessaryLocalVariableJS
            let streamModel: ExpandedStreamModel = {
                stream: track,
                historyLines: streamLines,
            };
            return streamModel;
        }
        if(track) {
            let uri = track?.track?.album?.uri;
            if(!uri)
                throw new Error("trackUri is null");
            let album = await this.lookupAlbumsCached([uri]);
            return {track, album: album[0]};
        }
        throw new Error("trackUri not found in library");
    }

    async getExpandedAlbumModel(albumUri: AlbumUri): Promise<ExpandedAlbumModel> {
        let album =  (await this.lookupAlbumsCached([albumUri]))[0];
        let meta = await this.getMetaDataCached(albumUri) ?? null;
        let tracks = await Promise.all(album.tracks.map(trackUri => this.lookupTrackCached(trackUri) as Promise<FileTrackModel>));
        return {album, tracks, meta};
    }

    async getMetaDataCached(albumUri: string) {
        let cachedMeta = this.model.getFromMetaCache(albumUri);
        if(cachedMeta)
            return cachedMeta.meta;
        let meta = await this.webProxy.fetchMetaData(albumUri);
        if(meta)
            this.model.addToMetaCache(albumUri, meta);
        return meta;
    }

    setSelectedTrack(uri: TrackUri | null) {
        this.model.setSelectedTrack(uri);
    }

    async getCurrertTrackInfoCached() {
        let trackUri = this.model.getCurrentTrack();
        if(!trackUri)
            return TrackNone;
        return await this.lookupTrackCached(trackUri) as TrackModel;
    }


    async fetchAllRefs() {
        let roots = await this.mopidyProxy.fetchRootDirs();
        let subDir1 = await this.mopidyProxy.browse<AllUris>(roots[1].uri);
        let allTracks = await this.mopidyProxy.browse<TrackUri>(LIBRARY_PROTOCOL+"directory?type=track");
        let allAlbums = await this.mopidyProxy.browse<AlbumUri>(LIBRARY_PROTOCOL+"directory?type=album");
        let allArtists = await this.mopidyProxy.browse<ArtistUri>(LIBRARY_PROTOCOL+"directory?type=artist");
        let allGenres = await this.mopidyProxy.browse<GenreUri>(LIBRARY_PROTOCOL+"directory?type=genre");
        let playLists = await this.mopidyProxy.fetchPlayLists();
        let radioStreamsPlayList = playLists.find(playlist => playlist.name == "[Radio Streams]");
        let playlists = playLists.filter(playlist => playlist.name != "[Radio Streams]");
        let radioStreams: models.Ref<RadioUri>[] = [];
        if(radioStreamsPlayList) {
            radioStreams = await this.mopidyProxy.fetchPlaylistItems(radioStreamsPlayList.uri) as models.Ref<RadioUri>[];
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
        this.model.setCurrentRefs(this.model.getAllRefs()?? null);
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

    async fetchAllAlbums() {
        let albumRefs = await this.mopidyProxy.browse(LIBRARY_PROTOCOL+"directory?type=album") as Ref<AlbumUri>[];
        return await this.lookupAlbumsCached(albumRefs.map(ref => ref.uri));
    }

    async addCurrentSearchResultsToPlayer() {
        let results = getState()?.getModel()?.getCurrentSearchResults();
        let trackList = await this.player.add(results.refs.map(r => r.ref.ref.uri));
    }

    async createPlaylist(name: string) {
        return this.mopidyProxy.createPlaylist(name)
    }

    async addRefToPlaylist(playlistUri: AllUris, itemUri: AllUris, refType: string, sequence: number) {
        return this.webProxy.addRefToPlaylist(playlistUri, itemUri, refType, sequence);
    }
}

