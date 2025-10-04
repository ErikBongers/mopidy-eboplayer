import Mopidy from "mopidy";
import TlTrack = Mopidy.models.TlTrack;
import {SyncedProgressTimer} from "./synced_timer";

let state = {
    mopidy: undefined as Mopidy,
    syncedProgressTimer: undefined as SyncedProgressTimer,

    // values for controls
    play: false,
    random: false,
    repeat: false,
    consume: false,
    single: false,
    mute: false,
    volumeChanging: false,
    volumeSliding: false,

    positionChanging: false,

    initgui: true,
    popupData: {},  // TODO: Refactor into one shared cache,
    songlength: 0,

    artistsHtml: '',
    artistsText: '',
    albumHtml: '',
    albumText: '',
    songname: '',

    streamUris: {}, //TODO: EBO added this to make gui.ts compile.

    songdata: new TlTrack({tlid: - 1, track: undefined}),

    pageScrollPos: {},

    uriSchemes: {},

    // array of cached playlists (not only user-playlists, also search, artist, album-playlists)
    playlists: {},  // TODO: Refactor into one shared cache,
    currentplaylist: undefined,
    customTracklists: [],  // TODO: Refactor into one shared cache,

    browseStack: [],
};

const getState = () => state;

export default getState