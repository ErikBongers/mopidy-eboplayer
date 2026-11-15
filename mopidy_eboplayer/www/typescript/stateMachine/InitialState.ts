import {PwaStateClass} from "./PwaStateMachine";
import {App} from "../app";

export class InitialState extends PwaStateClass {
    constructor(app: App) {
        super("NOT_INITIALIZED",app);
    }

    override onAppInitialized() {
        console.log("IntialState: onAppInitialized");
        this.app.getController().initialize();
        return undefined;
    }
}

