import Mopidy from "mopidy";
import {SyncedProgressTimer} from "./synced_timer";
import TlTrack = Mopidy.models.TlTrack;
import {DeepReadonly, Model} from "./model";

export class State {
    mopidy: Mopidy;
    syncedProgressTimer: SyncedProgressTimer;

    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;
    consume: boolean = false;
    single: boolean = false;
    mute: boolean = false;
    volumeChanging: boolean = false;
    volumeSliding: boolean = false;

    positionChanging: boolean = false;

    initgui: boolean = true;
    popupData = {};  // TODO: Refactor into one shared cache,
    songlength: number = 0;

    artistsHtml: string = '';
    artistsText: string = '';
    albumHtml: string = '';
    albumText: string = '';
    songname: string = '';

    streamUris = {}; //TODO: EBO added this to make gui.ts compile.

    songdata: (TlTrack | undefined) = undefined;

    pageScrollPos = {};

    uriSchemes = {};

    // array of cached playlists (not only user-playlists, also search, artist, album-playlists)
    playlists = {};  // TODO: Refactor into one shared cache,
    currentplaylist: undefined;
    customTracklists =  [];  // TODO: Refactor into one shared cache,

    browseStack =  [];
    private readonly model: Model;

    constructor(mopidy: Mopidy, syncedProgressTimer: SyncedProgressTimer) {
        this.mopidy = mopidy;
        this.syncedProgressTimer = syncedProgressTimer;
        this.model = new Model();
    }

    getModel(): DeepReadonly<Model> { return this.model; }
}

let state: State = undefined; //todo: assuming here that all calls to getState() will receive a valid state object.

export function setState(newState: State) { state = newState; }
const getState = () => state;

export default getState;