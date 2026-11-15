import {PwaStateClass} from "./PwaStateMachine";
import {App} from "../app";

export class NoNetworkState extends PwaStateClass {
    constructor(app: App) {
        super("NO_NETWORK", app);
    }

    override onPageVisibleOrFocus() {
        return undefined; //todo
    }
}

