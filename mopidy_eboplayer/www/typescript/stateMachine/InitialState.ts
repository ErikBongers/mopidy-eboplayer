import {PwaEventId, PwaPartialStateEvents, PwaStateClass} from "./PwaStateMachine";

export class InitialState extends PwaStateClass {
    constructor() {
        super(
            "NOT_INITIALIZED",
            {
                onAppInitialized,
            }
        );
    }
}

function onAppInitialized (event: PwaEventId){
    return undefined;
}
