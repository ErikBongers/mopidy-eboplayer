import {StateEvents, StateMachine, TransitionHandler} from "./StateMachine";
import {NetworkProxy} from "../network";

/*const stateTransitions: Record<PwaStateId, Partial<Record<PwaEvent['type'], TransitionHandler>>> = {
    NOT_INITIALIZED: {
        appInitialized: (e: Extract<PwaEvent, { type: 'appInitialized' }>) => {
            if (!e.payload.hasNetwork) return 'NO_NETWORK';
            return e.payload.isServerAlive ? 'ONLINE' : 'NO_SERVER';
        }
    },
    ONLINE: {
        networkLost: () => 'NO_NETWORK',
        serverTimedOut: () => 'NO_SERVER'
    },
    NO_SERVER: {
        networkLost: () => 'NO_NETWORK',
        serverResponded: () => 'ONLINE'
    },
    NO_NETWORK: {
        networkRestored: () => 'NO_SERVER'
    }
};
*/

type PwaStateId =
    | 'NOT_INITIALIZED'  // app still needs to setupStuff()
    | 'ONLINE' // all normal
    | 'NO_SERVER' // switch to offline repos and keep polling...
    | 'NO_NETWORK'; //switch to offline repos and DON'T poll.

export type PwaEventId =
    | "onAppInitialized"
    | "onNetworkLost"
    | "onNetworkResponded"
    | "onNetworkRestored"
    | "onServerTimedOut"
    | "onServerResponded"
    ;

export type PwaStateEvents = StateEvents<PwaStateId, PwaEventId>;
export type PwaTransitionHandler = TransitionHandler<PwaStateId,PwaEventId>;

export abstract class PwaStateClass implements PwaStateEvents {
    onAppInitialized: PwaTransitionHandler = () => {
        return undefined;
    };
    onNetworkLost: PwaTransitionHandler = () => {
        return undefined;
    };
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
}

export class DemoNetworkStateMachine extends StateMachine<PwaStateId, PwaEventId> {
    private readonly networkProxy: NetworkProxy;

    constructor(networkProxy: NetworkProxy) {
        super("NOT_INITIALIZED");
        window.addEventListener('online', () => this.transition('onNetworkRestored'));
        window.addEventListener('offline', () => this.transition('onNetworkLost'));
        this.networkProxy = networkProxy;
        this.networkProxy.onMopidy('state:online', () => this.transition('onServerResponded'));
        this.networkProxy.onMopidy('state:offline', () => this.transition('onServerTimedOut'));

        document.addEventListener("visibilitychange", () => {
            console.log(`page: ${document.visibilityState.toUpperCase()} -> check connections`);
            if (document.visibilityState === "visible") {
                this.networkProxy.connectWebsockets(true);
            }
        });
        document.addEventListener("focus", () => {
            console.log("page event: -> check connections");
            this.networkProxy.connectWebsockets(true);
        });
    }

    public async checkState() {
        if (navigator.onLine) {
            this.transition("onNetworkResponded");
            this.networkProxy.connectWebsockets(true);
        } else {
            this.transition("onNetworkLost");
            return;
        }
    }
}
