import {ReadOnlyModel} from "./model";
import Controller from "./controllers/controller";
import {DeepReadonly} from "./modelTypes";
import {PlayController} from "./controllers/playController";
import {CacheHandler} from "./controllers/cacheHandler";

export class State {
    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;

    private readonly model: ReadOnlyModel;
    private readonly controller: Controller;
    private readonly player: PlayController;
    private readonly cache: CacheHandler;

    constructor(model: ReadOnlyModel, controller: Controller, player: PlayController, cache: CacheHandler) {
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
