import {PartialStateEvents, StateClass, StateEvents, StateMachine, TransitionHandler} from "./StateMachine";
import {NetworkProxy} from "../network";

type PwaStateId =
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
    protected constructor(stateId: PwaStateId, events: PartialStateEvents<PwaStateId, PwaEventId>) {
        super(stateId, events);
    }
    // noinspection JSUnusedGlobalSymbols
    onAppInitialized: PwaTransitionHandler = () => {
        return undefined;
    };
    onNetworkLost: PwaTransitionHandler = () => {
        return undefined;
    };
    // noinspection JSUnusedGlobalSymbols
    onNetworkResponded: PwaTransitionHandler = () => {
        return undefined;
    };
    onNetworkRestored: PwaTransitionHandler = () => {
        return undefined;
    };
    onServerTimedOut: PwaTransitionHandler = () => {
        return undefined;
    };
    onServerResponded: PwaTransitionHandler = () => {
        return undefined;
    };
    onPageVisibleOrFocus: PwaTransitionHandler = () => {
        return undefined;
    }
}

export class PwaStateMachine extends StateMachine<PwaStateId, PwaEventId> {
    private readonly networkProxy: NetworkProxy;

    constructor(networkProxy: NetworkProxy) {
        super("NOT_INITIALIZED");
        this.networkProxy = networkProxy;
        window.addEventListener('online', () => this.transition('onNetworkRestored'));
        window.addEventListener('offline', () => this.transition('onNetworkLost'));
        this.networkProxy.onMopidy('state:online', () => this.transition('onServerResponded'));
        this.networkProxy.onMopidy('state:offline', () => this.transition('onServerTimedOut'));
        document.addEventListener("visibilitychange", () => this.transition('onPageVisibleOrFocus'));
        document.addEventListener("focus", () => this.transition('onPageVisibleOrFocus'));
    }

    getNetworkProxy() {
        return this.networkProxy;
    }
}
