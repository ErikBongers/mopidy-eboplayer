import models from "../js/mopidy";
import {EmptySearchResults, Refs, SearchResults} from "./refs";
import {AlbumMetaData, AlbumModel, AlbumUri, AllUris, BreadCrumbHome, BrowseFilter, CachedAlbumMetaData, ConnectionState, FileTrackModel, FilterBreadCrumb, FilterBreadCrumbTypeName, GenreDef, HistoryLine, Message, MessageType, NoneTrackModel, PlaybackModesState, PlayState, StreamTitles, StreamTrackModel, TrackModel, TrackUri, Views} from "./modelTypes";
import {BreadCrumbStack} from "./breadCrumb";
import {EboEventTargetClass} from "./events";
import TlTrack = models.TlTrack;


export interface ViewModel extends EboEventTargetClass {
    getConnectionState: () => ConnectionState;
    getCurrentTrack: () => TrackUri | null;
    getSelectedTrack: () => TrackUri | null;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => StreamTitles;
    getHistory: () => HistoryLine[];
    getCachedInfo(uri: string): (FileTrackModel | StreamTrackModel | AlbumModel | null);
    getCurrentBrowseFilter: () => BrowseFilter;
    getCurrentSearchResults(): SearchResults;
    getTrackList(): TlTrack[];
    getBreadCrumbs(): BrowseFilterBreadCrumbStack;
    getView(): Views;
    getAlbumToView(): AlbumUri;
    getGenreDefs(): Map<string, GenreDef> | null;
}

export class BrowseFilterBreadCrumbStack extends BreadCrumbStack<FilterBreadCrumbTypeName, FilterBreadCrumb>{}

// Model contains the data to be viewed and informs the view of changes through events.
// Views should not update the model directly. See ViewModel for that.
export class Model extends EboEventTargetClass implements ViewModel {
    static NoTrack: TrackModel = { type: "none" } as NoneTrackModel;
    currentTrack: TrackUri | null = null;
    //note that selectedTrack is not part of the mopidy server.
    //don't set selectedTrack to currentTrack unless you want it displayed
    selectedTrack: TrackUri | null = null;
    volume: number;
    connectionState: ConnectionState = ConnectionState.Offline;
    currentMessage: Message = {
        type: MessageType.None,
        message: ""
    };

    playbackModesState: PlaybackModesState = {
        repeat: false,
        random: false,
        consume: false,
        single: false
    }
    private playState: PlayState = "unknown";
    private activeStreamLines: StreamTitles;
    private history: HistoryLine[];
    private trackList: TlTrack[] = [];
    private libraryCache: Map<string, (FileTrackModel | StreamTrackModel | AlbumModel)> = new Map();
    private imageCache: Map<string, string> = new Map();
    private metaCache: Map<string, CachedAlbumMetaData> = new Map();
    private currentBrowseFilter= new BrowseFilter();
    // private filterBreadCrumbStack: BreadCrumbStack<number> = new BreadCrumbStack<number>();
    private filterBreadCrumbStack: BrowseFilterBreadCrumbStack = new BrowseFilterBreadCrumbStack();
    private genreDefs: Map<string, GenreDef> | null = null;

    private allRefs: Refs | null = null;
    private currentRefs: Refs | null = null;
    private view: Views = Views.NowPlaying;
    private albumToViewUri: AlbumUri;
    // private albumCache: Set<LibraryItem> = new Map();

    constructor() {
        super();
        this.initializeBreadcrumbStack();
    }

    setGenreDefs(defs: GenreDef[]) {
        this.genreDefs = new Map<string, GenreDef>();
        for (let def of defs) {
            this.genreDefs.set(def.ref.name ?? "???", def);
        }
        this.dispatchEboEvent("genreDefsChanged.eboplayer", {});
    }
    getGenreDefs = () => this.genreDefs;

    pushBreadCrumb(crumb: FilterBreadCrumb) {
        this.filterBreadCrumbStack.push(crumb);
        this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
    }
    popBreadCrumb() {
        let crumb = this.filterBreadCrumbStack.pop();
        this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
        return crumb;
    }

    getBreadCrumbs = () => this.filterBreadCrumbStack;

    resetBreadCrumbsTo(id: number) {
        this.filterBreadCrumbStack.resetTo(id);
        this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
    }

    private initializeBreadcrumbStack() {
        this.filterBreadCrumbStack.length = 0;
        this.filterBreadCrumbStack.push(new BreadCrumbHome());
    }

    clearBreadCrumbs() {
        this.initializeBreadcrumbStack();
        this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
    }

    setAllRefs(refs: Refs) {
        this.allRefs = refs;
    }

    getCurrentSearchResults(): SearchResults {
        return this.currentRefs?.getSearchResults() ?? EmptySearchResults;
    }

    getAllRefs = () => this.allRefs;

    filterCurrentRefs(){
        if(!this.currentRefs)
            return;
        this.currentRefs.browseFilter = this.currentBrowseFilter;
        this.currentRefs.filter();
        this.dispatchEboEvent("refsFiltered.eboplayer", {});
    }

    getImageFromCache(uri: AllUris): string | undefined {
        return this.imageCache.get(uri);
    }

    addImageToCache(uri: AllUris, image: string) {
        this.imageCache.set(uri, image);
    }

    addImagesToCache(map: Map<AllUris, string>) {
        for(let [uri, image] of map) {
            this.addImageToCache(uri, image);
        }
    }

    setConnectionState(state: ConnectionState) {
        this.connectionState  = state;
        if(this.connectionState == ConnectionState.Online)
            this.clearMessage();
        else
            this.setErrorMessage("Offline");
        this.dispatchEboEvent("connectionChanged.eboplayer", {});
    }

    getConnectionState = () => this.connectionState;

    getCachedInfo(uri: string): (FileTrackModel | StreamTrackModel  | AlbumModel | null) {
        return this.libraryCache.get(uri) ?? null;
    }

    getCurrentBrowseFilter = () => this.currentBrowseFilter;
    setCurrentBrowseFilter(browseFilter: BrowseFilter) {
        this.currentBrowseFilter = browseFilter;
        this.dispatchEboEvent("modelBrowseFilterChanged.eboplayer", {});
    }

    setBrowseFilterBreadCrumbs(breadCrumbStack: BrowseFilterBreadCrumbStack) {
        this.filterBreadCrumbStack.length = 0;
        this.filterBreadCrumbStack.push(...breadCrumbStack);
        this.dispatchEboEvent("breadCrumbsChanged.eboplayer", {});
    }

    getCurrentTrack(): TrackUri | null {
        return this.currentTrack;
    }

    setCurrentTrack(track: TrackModel | null) {
        if(track?.type == "none") {
            this.currentTrack = null;
            return;
        }
        this.currentTrack = track?.track?.uri ?? null;
        if(this.currentTrack)
            this.addToLibraryCache(this.currentTrack, track as (FileTrackModel | StreamTrackModel | AlbumModel)); //excluding NoneTrackModel
        this.dispatchEboEvent("currentTrackChanged.eboplayer", {});
    }

    getSelectedTrack = () => this.selectedTrack;

    setSelectedTrack(uri: TrackUri | null) {
        if(uri == "")
            this.selectedTrack = null;
        else
            this.selectedTrack = uri;
        this.dispatchEboEvent("selectedTrackChanged.eboplayer", {});
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.dispatchEboEvent("volumeChanged.eboplayer", {});
    }

    private setMessage(message: Message) {
        this.currentMessage = message;
        this.dispatchEboEvent("messageChanged.eboplayer", {});
    }

    getCurrentMessage = () => this.currentMessage;

    clearMessage() {
        this.setMessage( { type: MessageType.None, message: ""});
    }
    setInfoMessage(message: string) {
        this.setMessage( { type: MessageType.Info, message});
    }
    setWarningMessage(message: string) {
        this.setMessage( { type: MessageType.Warning, message});
    }
    setErrorMessage(message: string) {
        this.setMessage( { type: MessageType.Error, message});
    }

    setPlaybackState(state: PlaybackModesState) {
        this.playbackModesState = {...state};
        this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
    }

    getVolume = () => this.volume;

    getPlayState(): PlayState {
        return this.playState;
    }

    setPlayState(state: PlayState) {
        this.playState = state;
        this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
    }

    setActiveStreamLinesHistory(streamTitles: StreamTitles) {
        if(!streamTitles) //todo: why can this be empty (at PC startup?)
            return;
        this.activeStreamLines = streamTitles;
        this.dispatchEboEvent("activeStreamLinesChanged.eboplayer", {});
    }

    getActiveStreamLines = () => this.activeStreamLines;

    setHistory(history: HistoryLine[]) {
        this.history = history;
        this.dispatchEboEvent("historyChanged.eboplayer", {});
    }

    getHistory = () => this.history;

    setTrackList(trackList: TlTrack[]) {
        this.trackList = trackList;
        this.dispatchEboEvent("trackListChanged.eboplayer", {});
    }
    addToTrackList(trackList: TlTrack[]) {
        this.trackList.push(...trackList);
        this.dispatchEboEvent("trackListChanged.eboplayer", {});
    }
    getTrackList = () => this.trackList;

    //Doesn't overwrite
    addToLibraryCache(uri: string, item: (FileTrackModel | StreamTrackModel | AlbumModel)) {
        if(!this.libraryCache.has(uri))
            this.libraryCache.set(uri, item);
    }

    //Doesn't overwrite
    addToMetaCache(albumUri: string, item: AlbumMetaData) {
        if(!this.metaCache.has(albumUri))
            this.metaCache.set(albumUri, {meta: item});
    }

    getFromMetaCache(albumUri: string): CachedAlbumMetaData | undefined {
        return this.metaCache.get(albumUri);
    }

    updateLibraryCache(uri: string, item: (FileTrackModel | StreamTrackModel | AlbumModel)) {
        this.libraryCache.set(uri, item);
    }

    //Overwrites!
    addItemsToLibraryCache(items: (FileTrackModel | StreamTrackModel | AlbumModel)[]) {
        for(let item of items) {
            if(item.type == "album")
                this.updateLibraryCache(item.albumInfo.uri, item);
            else
                this.updateLibraryCache(item.track.uri, item);
        }
    }

    getFromLibraryCache(uri: string): (FileTrackModel | StreamTrackModel | AlbumModel) | null {
        return this.libraryCache.get(uri) ?? null;
    }

    setCurrentRefs(refs: Refs | null) {
        this.currentRefs = refs;
        this.dispatchEboEvent("currentRefsLoaded.eboplayer", {});
    }

    setView(view: Views) {
        this.view = view;
        this.dispatchEboEvent("viewChanged.eboplayer", {});
    }
    getView = () => this.view;

    setAlbumToView(uri: AlbumUri) {
        this.albumToViewUri = uri;
        this.dispatchEboEvent("albumToViewChanged.eboplayer", {});
    }
    getAlbumToView = () => this.albumToViewUri;

}
