import {PwaHandlerResponse, PwaStateClass} from "./PwaStateMachine";
import {App} from "../app";

export class OnlineState extends PwaStateClass {
    constructor(app: App) {
        super("ONLINE", app);
    }

    override onNetworkLost() {
        return undefined; //todo
    }
    override onServerTimedOut(): PwaHandlerResponse {
        return undefined; //todo
    }
}

