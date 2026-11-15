import {ReadOnlyModel} from "./model";
import Controller from "./controllers/controller";
import {DeepReadonly} from "./modelTypes";
import {PlayController} from "./controllers/playController";
import {NetworkProxyPointer} from "./network";

export class App {
    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;

    private readonly model: ReadOnlyModel;
    private readonly controller: Controller;
    private readonly player: PlayController;
    private readonly networkProxy: NetworkProxyPointer;

    constructor(model: ReadOnlyModel, controller: Controller, player: PlayController, networkProxy: NetworkProxyPointer) {
        this.model = model;
        this.controller = controller;
        this.player = player;
        this.networkProxy = networkProxy;
    }

    getModel = (): DeepReadonly<ReadOnlyModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;
    getNetwork() { return this.networkProxy.networkProxy; }
}
