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
}

export type TrackModel  = NoneTrackModel | FileTrackModel | StreamTrackModel;

export type DeepReadonly<T> = T extends Function ? T :
    T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
        T;

export class Model extends EventTarget{
    static NoTrack: TrackModel = { type: TrackType.None } as NoneTrackModel;
    activeTrack: TrackModel = Model.NoTrack;

    constructor() {
        super();
    }

    getActiveTrack() : DeepReadonly<TrackModel> {
        return this.activeTrack;
    }

    setActiveTrack(track: TrackModel) {
        this.activeTrack = structuredClone(track);
        this.dispatchEvent(new Event(EboplayerEvents.activeTrackChanged));
    }

    clearActiveTrack() {
        this.setActiveTrack(Model.NoTrack);
    }
}
