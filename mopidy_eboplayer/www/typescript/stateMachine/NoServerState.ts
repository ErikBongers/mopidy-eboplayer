import {PwaStateClass} from "./PwaStateMachine";
import {App} from "../app";

export class NoServerState extends PwaStateClass {
    constructor(app: App) {
        super("NO_SERVER", app);
    }

    override onPageVisibleOrFocus() {
        return undefined; //todo
    }
}

