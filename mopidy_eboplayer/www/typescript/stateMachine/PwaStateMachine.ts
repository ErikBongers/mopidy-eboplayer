import {PartialStateEvents, StateClass, StateEvents, StateMachine, StateMap, TransitionHandler} from "./StateMachine";
import {createOnlineNetworkProxy, NetworkProxy, NetworkProxyPointer} from "../network";
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
export type PwaPartialStateEvents = PartialStateEvents<PwaStateId, PwaEventId>;
export type PwaTransitionHandler = TransitionHandler<PwaStateId,PwaEventId>;

export abstract class PwaStateClass extends StateClass<PwaStateId, PwaEventId> implements PwaStateEvents {
    public readonly app: App;

    protected constructor(stateId: PwaStateId, app: App) {
        super(stateId);
        this.app = app;
    }
    // noinspection JSUnusedGlobalSymbols
    onAppInitialized() {
        return undefined;
    };
    onNetworkLost() {
        return undefined;
    };
    // noinspection JSUnusedGlobalSymbols
    onNetworkResponded () {
        return undefined;
    };
    onNetworkRestored() {
        return undefined;
    };
    onServerTimedOut() {
        return undefined;
    };
    onServerResponded() {
        return undefined;
    };
    onPageVisibleOrFocus: PwaTransitionHandler = () => {
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
