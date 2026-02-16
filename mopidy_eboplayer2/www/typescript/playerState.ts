import {Mopidy} from "../js/mopidy";
import {ReadOnlyModel} from "./model";
import {Controller} from "./controllers/controller";
import {DeepReadonly} from "./modelTypes";
import {PlayController} from "./controllers/playController";
import {CacheHandler} from "./controllers/cacheHandler";

export class State {
    mopidy: Mopidy;

    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;

    // array of cached playlists (not only user-playlists, also search, artist, album-playlists)

    private readonly model: ReadOnlyModel;
    private readonly controller: Controller;
    private readonly player: PlayController;
    private readonly cache: CacheHandler;

    constructor(mopidy: Mopidy, model: ReadOnlyModel, controller: Controller, player: PlayController, cache: CacheHandler) {
        this.mopidy = mopidy;
        this.model = model;
        this.controller = controller;
        this.player = player;
        this.cache = cache;
    }
    getModel = (): DeepReadonly<ReadOnlyModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;
    getCache = () => this.cache;
}
