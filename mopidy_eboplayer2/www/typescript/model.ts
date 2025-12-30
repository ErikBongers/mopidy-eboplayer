import models from "../js/mopidy";
import {Refs, SearchResult} from "./refs";
import {AlbumMetaData, AlbumModel, AlbumUri, BreadCrumbHome, BrowseFilter, CachedAlbumMetaData, ConnectionState, FileTrackModel, FilterBreadCrumb, FilterBreadCrumbTypeName, HistoryLine, ItemType, Message, MessageType, NoneTrackModel, PlaybackModesState, PlayState, StreamTitles, StreamTrackModel, TrackModel, Views} from "./modelTypes";
import {BreadCrumb, BreadCrumbStack} from "./breadCrumb";
import TlTrack = models.TlTrack;
import {EboplayerEvents} from "./events";
import {WithId} from "./util/idStack";



export interface ViewModel extends EventTarget {
    getConnectionState: () => ConnectionState;
    getCurrentTrack: () => string;
    getSelectedTrack: () => string | undefined;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => StreamTitles;
    getHistory: () => HistoryLine[];
    getCachedInfo(uri: string): (FileTrackModel | StreamTrackModel | AlbumModel);
    getCurrentBrowseFilter: () => BrowseFilter;
    getCurrentSearchResults(): SearchResult[];
    getTrackList(): TlTrack[];
    getBreadCrumbs(): BrowseFilterBreadCrumbStack;
    getView(): Views;
    getAlbumToView(): AlbumUri;
}

export class BrowseFilterBreadCrumbStack extends BreadCrumbStack<FilterBreadCrumbTypeName, FilterBreadCrumb>{}

// Model contains the data to be viewed and informs the view of changes through events.
// Views should not update the model directly. See ViewModel for that.
export class Model extends EventTarget implements ViewModel {
    static NoTrack: TrackModel = { type: ItemType.None } as NoneTrackModel;
    currentTrack: string;
    //note that selectedTrack is not part of the mopidy server.
    //don't set selectedTrack to currentTrack unless you want it displayed
    selectedTrack?: string;
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
    private playState: PlayState = PlayState.unknown;
    private activeStreamLines: StreamTitles;
    private history: HistoryLine[];
    private trackList: TlTrack[] = [];
    private libraryCache: Map<string, (FileTrackModel | StreamTrackModel | AlbumModel)> = new Map();
    private metaCache: Map<string, CachedAlbumMetaData> = new Map();
    private currentBrowseFilter= new BrowseFilter();
    // private filterBreadCrumbStack: BreadCrumbStack<number> = new BreadCrumbStack<number>();
    private filterBreadCrumbStack: BrowseFilterBreadCrumbStack = new BrowseFilterBreadCrumbStack();

    private allRefs?: Refs;
    private currentRefs?: Refs;
    private view: Views = Views.NowPlaying;
    private albumToViewUri: AlbumUri;
    // private albumCache: Set<LibraryItem> = new Map();
    private currentImage: string;

    constructor() {
        super();
        this.initializeBreadcrumbStack();
    }

    pushBreadCrumb(crumb: FilterBreadCrumb) {
        this.filterBreadCrumbStack.push(crumb);
        this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
    }
    popBreadCrumb() {
        let crumb = this.filterBreadCrumbStack.pop();
        this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
        return crumb;
    }

    getBreadCrumbs = () => this.filterBreadCrumbStack;

    resetBreadCrumbsTo(id: number) {
        this.filterBreadCrumbStack.resetTo(id);
        this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
    }

    private initializeBreadcrumbStack() {
        this.filterBreadCrumbStack.length = 0;
        this.filterBreadCrumbStack.push(new BreadCrumbHome());
    }

    clearBreadCrumbs() {
        this.initializeBreadcrumbStack();
        this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
    }

    setAllRefs(refs: Refs) {
        this.allRefs = refs;
    }

    getCurrentSearchResults(): SearchResult[] {
        return this.currentRefs?.getSearchResults() ?? [] as SearchResult[];
    }

    getAllRefs = () => this.allRefs;

    filterCurrentRefs(){
        if(!this.currentRefs)
            return;
        this.currentRefs.browseFilter = this.currentBrowseFilter;
        this.currentRefs.filter();
        this.dispatchEvent(new Event(EboplayerEvents.refsFiltered));
    }
    setConnectionState(state: ConnectionState) {
        this.connectionState  = state;
        if(this.connectionState == ConnectionState.Online)
            this.clearMessage();
        else
            this.setErrorMessage("Offline");
        this.dispatchEvent(new Event(EboplayerEvents.connectionChanged));
    }

    getConnectionState = () => this.connectionState;

    getCachedInfo(uri: string): (FileTrackModel | StreamTrackModel  | AlbumModel) {
        return this.libraryCache.get(uri);
    }

    getCurrentBrowseFilter = () => this.currentBrowseFilter;
    setCurrentBrowseFilter(browseFilter: BrowseFilter) {
        this.currentBrowseFilter = browseFilter;
        this.dispatchEvent(new Event(EboplayerEvents.browseFilterChanged));
    }

    setBrowseFilterBreadCrumbs(breadCrumbStack: BrowseFilterBreadCrumbStack) {
        this.initializeBreadcrumbStack();
        this.filterBreadCrumbStack.push(...breadCrumbStack);
        this.dispatchEvent(new Event(EboplayerEvents.breadCrumbsChanged));
    }

    getCurrentTrack(): string {
        return this.currentTrack;
    }

    setCurrentTrack(track: TrackModel) {
        if(track.type == ItemType.None) {
            this.currentTrack = undefined;
            return;
        }
        this.currentTrack = track.track.uri;
        this.addToLibraryCache(this.currentTrack, track);
        this.dispatchEvent(new Event(EboplayerEvents.currentTrackChanged));
    }

    getSelectedTrack = () => this.selectedTrack;

    setSelectedTrack(uri?: string) {
        if(uri == "")
            this.selectedTrack = undefined;
        else
            this.selectedTrack = uri;
        this.dispatchEvent(new Event(EboplayerEvents.selectedTrackChanged));
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.dispatchEvent(new Event(EboplayerEvents.volumeChanged));
    }

    private setMessage(message: Message) {
        this.currentMessage = message;
        this.dispatchEvent(new Event(EboplayerEvents.messageChanged));
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
        this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
    }

    getVolume = () => this.volume;

    getPlayState(): PlayState {
        return this.playState;
    }

    setPlayState(state: PlayState) {
        this.playState = state;
        this.dispatchEvent(new Event(EboplayerEvents.playStateChanged));
    }

    setActiveStreamLinesHistory(streamTitles: StreamTitles) {
        if(!streamTitles) //todo: why can this be empty (at PC startup?)
            return;
        streamTitles.active_titles = Object.values<string>(streamTitles.active_titles); //todo: this really is a hack. Can't python return an array, like normal people?
        this.activeStreamLines = streamTitles;
        this.dispatchEvent(new Event(EboplayerEvents.activeStreamLinesChanged));
    }

    getActiveStreamLines = () => this.activeStreamLines;

    setHistory(history: HistoryLine[]) {
        this.history = history;
        this.dispatchEvent(new Event(EboplayerEvents.historyChanged));
    }

    getHistory = () => this.history;

    setTrackList(trackList: TlTrack[]) {
        this.trackList = trackList;
        this.dispatchEvent(new Event(EboplayerEvents.trackListChanged));
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
            if(item.type == ItemType.Album)
                this.updateLibraryCache(item.albumInfo.uri, item);
            else
                this.updateLibraryCache(item.track.uri, item);
        }
    }

    getFromLibraryCache(uri: string): (FileTrackModel | StreamTrackModel | AlbumModel) | undefined {
        return this.libraryCache.get(uri);
    }

    setCurrentRefs(refs: Refs) {
        this.currentRefs = refs;
        this.dispatchEvent(new Event(EboplayerEvents.currentRefsLoaded));
    }

    setView(view: Views) {
        this.view = view;
        this.dispatchEvent(new Event(EboplayerEvents.viewChanged));
    }
    getView = () => this.view;

    setAlbumToView(uri: AlbumUri) {
        this.albumToViewUri = uri;
        this.dispatchEvent(new Event(EboplayerEvents.albumToViewChanged));
    }
    getAlbumToView = () => this.albumToViewUri;

    setCurrentImage(uri: string) {
        this.currentImage = uri;
        this.dispatchEvent(new Event(EboplayerEvents.currentImageSet));
    }

    getCurrentImage = () => this.currentImage;

}
