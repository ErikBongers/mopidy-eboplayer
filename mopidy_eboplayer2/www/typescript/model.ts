import models from "../js/mopidy";
import {AllRefs, EmptySearchResults, ExpandedRef, Refs, SearchResults} from "./refs";
import {AlbumMetaData, AlbumModel, AlbumUri, AllUris, BreadCrumbHome, BrowseFilter, CachedAlbumMetaData, ConnectionState, FileTrackModel, FilterBreadCrumb, FilterBreadCrumbTypeName, GenreDef, HistoryLineDef, Message, MessageType, NoneTrackModel, PlaybackModesState, PlayState, RememberDef, StreamTitles, StreamTrackModel, StreamUri, TrackModel, TrackUri, Views} from "./modelTypes";
import {BreadCrumbStack} from "./breadCrumb";
import {EboEventTargetClass} from "./events";
import TlTrack = models.TlTrack;


export interface ViewModel extends EboEventTargetClass {
    getConnectionState: () => ConnectionState;
    getCurrentTrack: () => TrackUri | StreamUri | null;
    getSelectedTrack: () => TrackUri | StreamUri | null;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => StreamTitles;
    getHistory: () => HistoryLineDef[];
    getCachedInfo(uri: string): (FileTrackModel | StreamTrackModel | AlbumModel | null);
    getCurrentBrowseFilter: () => BrowseFilter;
    getCurrentSearchResults(): SearchResults;
    getTrackList(): TlTrack[];
    getBreadCrumbs(): BrowseFilterBreadCrumbStack;
    getView(): Views;
    getAlbumToView(): AlbumToView | null;
    getGenreDefs(): Map<string, GenreDef> | null;
    getCurrentProgramTitle(): string;
}

export interface AlbumToView {
    albumUri: AlbumUri;
    selectedTrackUri: TrackUri | null;
}

export class BrowseFilterBreadCrumbStack extends BreadCrumbStack<FilterBreadCrumbTypeName, FilterBreadCrumb>{}

// Model contains the data to be viewed and informs the view of changes through events.
// Views should not update the model directly. See ViewModel for that.
export class Model extends EboEventTargetClass implements ViewModel {
    currentTrack: TrackUri | StreamUri | null = null;
    //note that selectedTrack is not part of the mopidy server.
    //don't set selectedTrack to currentTrack unless you want it displayed
    selectedTrack: TrackUri | StreamUri | null = null;
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
    private history: HistoryLineDef[];
    private trackList: TlTrack[] = [];
    private libraryCache: Map<string, (FileTrackModel | StreamTrackModel | AlbumModel)> = new Map();
    private imageCache: Map<string, string> = new Map();
    private metaCache: Map<string, CachedAlbumMetaData> = new Map();
    private currentBrowseFilter= new BrowseFilter();
    // private filterBreadCrumbStack: BreadCrumbStack<number> = new BreadCrumbStack<number>();
    private filterBreadCrumbStack: BrowseFilterBreadCrumbStack = new BrowseFilterBreadCrumbStack();
    private genreDefs: Map<string, GenreDef> = new Map();
    private currentProgramTitle: string = "";

    private allRefs: AllRefs | null = null;
    private currentRefs: Refs | null = null;
    private view: Views = Views.NowPlaying;
    private albumToView: AlbumToView | null = null;
    // private albumCache: Set<LibraryItem> = new Map();
    private remembers: RememberDef[] | null = null;
    private scanStatus: string = "";
    private allRefsMap: Map<AllUris, ExpandedRef> | null = null;

    constructor() {
        super();
        this.initializeBreadcrumbStack();
    }

    getScanStatus = () => this.scanStatus;

    getCurrentProgramTitle(): string {
        return this.currentProgramTitle;
    }

    setCurrentProgramTitle(title: string) {
        this.currentProgramTitle = title;
        this.dispatchEboEvent("programTitleChanged.eboplayer", {});
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

    setAllRefs(refs: AllRefs) {
        this.allRefs = refs;
        this.allRefsMap = new Map<AllUris, ExpandedRef>(
            refs.allRefs
                .map(res => [res.uri as AllUris, res])
        );
    }

    getCurrentSearchResults(): SearchResults {
        return this.currentRefs?.getSearchResults() ?? EmptySearchResults;
    }

    getAllRefs = () => this.allRefs;
    getAllRefsMap = () => this.allRefsMap;

    async filterCurrentRefs(){
        if(!this.currentRefs)
            return;
        this.currentRefs.browseFilter = this.currentBrowseFilter;
        await this.currentRefs.filter();
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

    getCurrentTrack(): TrackUri | StreamUri | null {
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

    setSelectedTrack(uri: TrackUri | StreamUri | null) {
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

    setHistory(history: HistoryLineDef[]) {
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
    addToMetaCache(albumUri: string, item: AlbumMetaData | null) {
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
            if(item.type == "album") {
                if(item.albumInfo)
                    this.updateLibraryCache(item.albumInfo.uri, item);
            }
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

    setAlbumToView(uri: AlbumUri, selectedTrackUri: TrackUri | null) {
        this.albumToView = {albumUri: uri, selectedTrackUri: selectedTrackUri};
        this.dispatchEboEvent("albumToViewChanged.eboplayer", {});
    }
    getAlbumToView = () => this.albumToView;

    setRemembers(remembers: RememberDef[] | null) {
        this.remembers = remembers;
        this.dispatchEboEvent("remembersChanged.eboplayer", {});
    }

    getRemembers = () => this.remembers;

    setScanStatus(status: string) {
        this.scanStatus = status;
        this.dispatchEboEvent("scanStatusChanged.eboplayer", {text: status});
    }
}
