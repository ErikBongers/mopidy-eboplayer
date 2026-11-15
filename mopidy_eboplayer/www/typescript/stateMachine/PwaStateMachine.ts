import {HandlerResponse, StateClass, StateEvents, StateMachine, StateMap, TransitionHandler} from "./StateMachine";
import {App} from "../app";

export type PwaStateId =
    | 'NOT_INITIALIZED'  // app still needs to setupStuff()
    | 'ONLINE' // all normal
    | 'NO_SERVER' // switch to offline repos and keep polling...
    | 'NO_NETWORK'; //switch to offline repos and DON'T poll.

export type PwaEventId =
    | "onAppInitialized"
    | "onPageVisibleOrFocus"
    | "onNetworkLost"
    | "onNetworkResponded"
    | "onNetworkRestored"
    | "onServerTimedOut"
    | "onServerResponded"
    ;

export type PwaStateEvents = StateEvents<PwaStateId, PwaEventId>;
export type PwaHandlerResponse = HandlerResponse<PwaStateId>;

export abstract class PwaStateClass extends StateClass<PwaStateId, PwaEventId> implements PwaStateEvents {
    public readonly app: App;

    protected constructor(stateId: PwaStateId, app: App) {
        super(stateId);
        this.app = app;
    }
    // noinspection JSUnusedGlobalSymbols
    onAppInitialized(): PwaHandlerResponse {
        return undefined;
    };
    onNetworkLost(): PwaHandlerResponse {
        return undefined;
    };
    // noinspection JSUnusedGlobalSymbols
    onNetworkResponded (): PwaHandlerResponse {
        return undefined;
    };
    onNetworkRestored(): PwaHandlerResponse {
        return undefined;
    };
    onServerTimedOut(): PwaHandlerResponse {
        return undefined;
    };
    onServerResponded(): PwaHandlerResponse {
        return undefined;
    };
    onPageVisibleOrFocus(): PwaHandlerResponse {
        return undefined;
    }
}

export class PwaStateMachine extends StateMachine<PwaStateId, PwaEventId> {

    constructor(app: App, states: StateMap<PwaStateId, PwaEventId>) {
        super("NOT_INITIALIZED", states);
        window.addEventListener('online', () => this.on('onNetworkRestored'));
        window.addEventListener('offline', () => this.on('onNetworkLost'));
        app.getNetwork().onMopidy('state:online', () => this.on('onServerResponded'));
        app.getNetwork().onMopidy('state:offline', () => this.on('onServerTimedOut'));
        document.addEventListener("visibilitychange", () => this.on('onPageVisibleOrFocus'));
        document.addEventListener("focus", () => this.on('onPageVisibleOrFocus'));
    }
}
