import {PwaHandlerResponse, PwaStateClass} from "./PwaStateMachine";
import {App} from "../app";

export class InitialState extends PwaStateClass {
    constructor(app: App) {
        super("NOT_INITIALIZED", app);
    }

    override onAppInitialized(): PwaHandlerResponse {
        console.log("IntialState: onAppInitialized");
        this.app.getNetwork().connectWebsockets(false); //we know network is the real thing and not the offline proxy.
        this.app.getController().initialize();
        return undefined; //state change determined by events.
    }

    override onServerResponded(): PwaHandlerResponse {
        console.log("IntialState: onServerResponded");
        this.app.setOnlineNetworkProxy();
        return "ONLINE";
    }
}

