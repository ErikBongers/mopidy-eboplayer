import {ReadOnlyModel} from "./model";
import Controller from "./controllers/controller";
import {DeepReadonly} from "./modelTypes";
import {PlayController} from "./controllers/playController";
import {NetworkProxy, NetworkProxyPointer} from "./network";

export class App {
    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;

    private readonly model: ReadOnlyModel;
    private readonly controller: Controller;
    private readonly player: PlayController;
    private readonly networkProxyPointer: NetworkProxyPointer;
    private readonly onlineNetworkProxy: NetworkProxy;

    constructor(model: ReadOnlyModel, controller: Controller, player: PlayController, networkProxy: NetworkProxyPointer, onlineNetworkProxy: NetworkProxy) {
        this.model = model;
        this.controller = controller;
        this.player = player;
        this.networkProxyPointer = networkProxy;
        this.onlineNetworkProxy = onlineNetworkProxy;
    }

    getModel = (): DeepReadonly<ReadOnlyModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;
    getNetwork() { return this.networkProxyPointer.networkProxy; }
    setOnlineNetworkProxy() {
        this.networkProxyPointer.networkProxy = this.onlineNetworkProxy;
    }
    setOfflineNetworkProxy() {
        throw new Error("Offline network proxy not yet implemented");
    }
}
