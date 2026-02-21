import models from "../js/mopidy";
import {AllRefs, EmptySearchResults, ExpandedRef, Refs, SearchResults} from "./refs";
import {AlbumMetaData, AlbumModel, AlbumUri, AllUris, BreadCrumbHome, BrowseFilter, CachedAlbumMetaData, ConnectionState, ExpandedHistoryLineGroup, FileTrackModel, FilterBreadCrumb, FilterBreadCrumbTypeName, GenreDef, GenreReplacement, HistoryLineDef, Message, MessageType, PlaybackFlags, PlayState, RememberDef, StreamTitles, StreamTrackModel, StreamUri, TrackModel, TrackUri, Views} from "./modelTypes";
import {BreadCrumbStack} from "./breadCrumb";
import {EboEventTargetClass} from "./events";
import TlTrack = models.TlTrack;


export type OnlyGetMethods<T> = {
    [K in keyof T as
        K extends `get${string}`| `addEboEventListener`
            ? T[K] extends (...args: any[]) => any
                ? K
                : never
            : never
    ]: T[K]
};

export type ReadOnlyModel = OnlyGetMethods<Model>;

export interface AlbumToView {
    albumUri: AlbumUri;
    selectedTrackUri: TrackUri | null;
}

export class BrowseFilterBreadCrumbStack extends BreadCrumbStack<FilterBreadCrumbTypeName, FilterBreadCrumb>{}

// Model contains the data to be viewed and informs the view of changes through events.
// Views should not update the model directly. See ViewModel for that.
export class Model extends EboEventTargetClass implements ReadOnlyModel {
    currentTrack: TrackUri | StreamUri | null = null;
    //note that selectedTrack is not part of the mopidy server.
    //don't set selectedTrack to currentTrack unless you want it displayed
    selectedTrack: TrackUri | StreamUri | null = null;
    volume: number;
    connectionState: ConnectionState = ConnectionState.Offline;
    private currentMessage: Message = {
        type: MessageType.None,
        message: ""
    };
    private tempMessage: Message = {
        type: MessageType.None,
        message: ""
    };

    private playbackMode: PlaybackFlags = {
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
    private genreReplacements: Map<string, GenreReplacement> = new Map();
    private genreDefs: GenreDef[] = [];
    private currentProgramTitle: string = "";

    private allRefs: AllRefs | null = null;
    private currentRefs: Refs | null = null;
    private view: Views = Views.NowPlaying;
    private albumToView: AlbumToView | null = null;
    private remembers: RememberDef[] | null = null;
    private scanStatus: string = "";
    private allRefsMap: Map<AllUris, ExpandedRef<AllUris>> | null = null;
    private favorites: Set<AllUris> | null  = null;
    private radioToView: StreamUri | null = null;
    private streamLinesHistory:  Map<StreamUri, ExpandedHistoryLineGroup[] | null> = new Map();

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

    setGenreReplacements(defs: GenreReplacement[]) {
        this.genreReplacements = new Map<string, GenreReplacement>();
        for (let def of defs) {
            this.genreReplacements.set(def.ref.name ?? "???", def);
        }
        this.dispatchEboEvent("genreReplacementsChanged.eboplayer", {});
    }
    getGenreReplacements = () => this.genreReplacements;

    pushBreadCrumb(crumb: FilterBreadCrumb, dispatch: "dispatch" | "noDispatch" = "dispatch") {
        this.filterBreadCrumbStack.push(crumb);
        if(dispatch == "dispatch")
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
        this.allRefsMap = new Map<AllUris, ExpandedRef<AllUris>>(
            refs.allRefs
                .map(res => [res.uri, res])
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

    setTempMessage(message: Message) {
        this.tempMessage = message;
        this.dispatchEboEvent("tempMessageChanged.eboplayer", {});
        window.setTimeout(() => this.clearTempMessage(), 3*1000);
    }
    getTempMessage = () => this.tempMessage;
    clearTempMessage() {
        this.tempMessage = {
            type: MessageType.None,
            message: ""
        };
        this.dispatchEboEvent("tempMessageChanged.eboplayer", {});
    }

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

    setPlaybackMode(state: PlaybackFlags) {
        this.playbackMode = {...state};
        this.dispatchEboEvent("playbackModeChanged.eboplayer", {});
    }
    getPlaybackMode = () => this.playbackMode;

    getVolume = () => this.volume;

    getPlayState(): PlayState {
        return this.playState;
    }

    setPlayState(state: PlayState) {
        this.playState = state;
        this.dispatchEboEvent("playbackStateChanged.eboplayer", {});
    }

    setActiveStreamLinesHistory(streamTitles: StreamTitles) {
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

    getGenreDefs = () => this.genreDefs;
    setGenreDefs(genreDefs: GenreDef[]) {
        this.genreDefs = genreDefs;
        this.dispatchEboEvent("genreDefsChanged.eboplayer", {});
    }

    getFavorites = () => this.favorites;
    setFavorites(favorites: AllUris[] | null){
        if(favorites == null) {
            this.favorites = null;
            return; //no dispatch.
        }
        this.favorites = new Set(favorites);
        this.dispatchEboEvent("favoritesChanged.eboplayer", {})
    }

    getRadioToView = () => this.radioToView;
    setRadioToView(radioUri: StreamUri | null) {
        this.radioToView = radioUri;
        this.dispatchEboEvent("currentRadioChanged.eboplayer", {});
    }

    getStreamLinesHistory(streamUri: StreamUri) {
        return this.streamLinesHistory.get(streamUri) ?? null;
    }

    setStreamLinesHistory(streamUri: StreamUri, history: ExpandedHistoryLineGroup[] | null) {
        this.streamLinesHistory.set(streamUri, history);
        this.dispatchEboEvent("streamLinesHistoryChanged.eboplayer", {"uri": streamUri});
    }
}
