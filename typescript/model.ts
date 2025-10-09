import {models} from "../mopidy_eboplayer2/static/js/mopidy";
import TlTrack = models.TlTrack;

export enum TrackType { None, File, Stream}

export interface FileTrackModel {
    type: TrackType.File;
    tlTrack: TlTrack;
    title: string,
    composer?: string,
    performer: string,
    songlenght: number,
    //...more properties?
}

export interface StreamTrackModel {
    type: TrackType.Stream;
    tlTrack: TlTrack;
    name: string,
    infoLines: string[]
}

export interface NoneTrackModel {
    type: TrackType.None;
}

export enum EboplayerEvents {
    activeTrackChanged = "eboplayer.activeTrackChanged",
    volumeChanged = "eboplayer.volumeChanged",
    connectionChanged = "eboplayer.connectionChanged",
    playbackStateChanged = "eboplayer.playbackStateChanged",
    messageChanged = "eboplayer.messageChanged",
}

export type TrackModel  = NoneTrackModel | FileTrackModel | StreamTrackModel;

export type DeepReadonly<T> = T extends Function ? T :
    T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
        T;

export enum ConnectionState {Offline, Online}

export enum MessageType { None, Info, Warning, Error}

interface Message {
    type: MessageType,
    message: string
}

interface PlaybackState {
    repeat:  boolean,
    random: boolean,
    consume: boolean,
    single: boolean
}

export class Model extends EventTarget {
    static NoTrack: TrackModel = { type: TrackType.None } as NoneTrackModel;
    activeTrack: TrackModel = Model.NoTrack;
    volume: number;
    connectionState: ConnectionState = ConnectionState.Offline;
    currentMessage: Message = {
        type: MessageType.None,
        message: ""
    };

    playbackState: PlaybackState = {
        repeat: false,
        random: false,
        consume: false,
        single: false
    }

    constructor() {
        super();
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

    getActiveTrack = (): DeepReadonly<TrackModel> => this.activeTrack;

    setActiveTrack(track: TrackModel) {
        this.activeTrack = structuredClone(track);
        this.dispatchEvent(new Event(EboplayerEvents.activeTrackChanged));
    }

    clearActiveTrack() {
        this.setActiveTrack(Model.NoTrack);
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.dispatchEvent(new Event(EboplayerEvents.volumeChanged));
    }

    private setMessage(message: Message) {
        this.currentMessage = message;
        this.dispatchEvent(new Event(EboplayerEvents.messageChanged));
    }

    getCurrentMessage =  () => this.currentMessage;

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

    setPlaybackState(state: PlaybackState) {
        this.playbackState = {...state};
        this.dispatchEvent(new Event(EboplayerEvents.playbackStateChanged));
    }

    getVolume = () => this.volume;
}
