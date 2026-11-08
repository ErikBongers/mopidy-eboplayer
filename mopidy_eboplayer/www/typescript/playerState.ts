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

    constructor(model: ReadOnlyModel, controller: Controller, player: PlayController) {
        this.model = model;
        this.controller = controller;
        this.player = player;
    }
    getModel = (): DeepReadonly<ReadOnlyModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;
}
