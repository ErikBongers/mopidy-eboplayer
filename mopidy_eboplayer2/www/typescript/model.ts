import models from "../js/mopidy";
import {Refs, SearchResult} from "./refs";
import {BrowseFilter, ConnectionState, EboplayerEvents, HistoryLine, LibraryDict, LibraryItem, Message, MessageType, NoneTrackModel, PlaybackModesState, PlayState, StreamTitles, TrackModel, TrackType} from "./modelTypes";
import TlTrack = models.TlTrack;
import Ref = models.Ref;

export interface ViewModel extends EventTarget {
    getConnectionState: () => ConnectionState;
    getCurrentTrack: () => string;
    getSelectedTrack: () => string | undefined;
    getCurrentMessage: () => Message;
    getVolume: () => number;
    getPlayState: () => PlayState;
    getActiveStreamLines: () => StreamTitles;
    getHistory: () => HistoryLine[];
    getTrackInfo(uri: string): LibraryItem;
    getBrowseFilter: () => BrowseFilter;
    getSearchResults(): SearchResult[];
    getTrackList(): TlTrack[];
}

export class Model extends EventTarget implements ViewModel {
    static NoTrack: TrackModel = { type: TrackType.None } as NoneTrackModel;
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
    private playState: PlayState;
    private activeStreamLines: StreamTitles;
    private history: HistoryLine[];
    private trackList: TlTrack[] = [];
    private libraryCache: Map<string, LibraryItem> = new Map();
    private browseFilter= new BrowseFilter();

    private refs: Refs;

    constructor() {
        super();
    }

    setRefs(refs: Refs) {
        this.refs = refs;
        this.dispatchEvent(new Event(EboplayerEvents.refsLoaded));
    }

    getSearchResults(): SearchResult[] {
        return this.refs.searchResults;
    }

    isRefsLoaded = () => this.refs != undefined;

    filterRefs(){
        this.refs.filter(this.browseFilter);
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

    getTrackInfo(uri: string): LibraryItem {
        return this.libraryCache.get(uri);
    }

    getBrowseFilter = () => this.browseFilter;
    setBrowseFilter(filter: BrowseFilter) {
        this.browseFilter = filter;
        this.dispatchEvent(new Event(EboplayerEvents.browseFilterChanged));
    }

    getCurrentTrack(): string {
        return this.currentTrack;
    }

    setCurrentTrack(track: TrackModel) {
        if(track.type == TrackType.None) {
            this.currentTrack = undefined;
            return;
        }
        this.currentTrack = track.track.uri;
        this.addToLibraryCache(this.currentTrack, [track.track]);
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
    addToLibraryCache(uri: string, item: LibraryItem) {
        if(!this.libraryCache.has(uri))
        this.libraryCache.set(uri, item);
    }

    updateLibraryCache(uri: string, item: LibraryItem) {
        this.libraryCache.set(uri, item);
    }

    //Overwrites!
    addDictToLibraryCache(dict: LibraryDict) {
        for(let key in dict) {
            this.updateLibraryCache(key, dict[key]);
        }
    }

    getTrackFromCache(uri: string) {
        return this.libraryCache.get(uri);
    }
}
