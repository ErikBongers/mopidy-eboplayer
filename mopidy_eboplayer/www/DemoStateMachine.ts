import {StateEvents, StateMachine, TransitionHandler} from "./GenericStateMachine";

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

}

export class DemoNetworkStateMachine extends StateMachine<PwaStateId, PwaEventId> {
    private currentState: PwaStateId = 'NOT_INITIALIZED';
    private listeners: ((state: PwaStateId) => void)[] = [];

    constructor() {
        super("NOT_INITIALIZED");
        window.addEventListener('online', () => this.transition({ type: 'networkRestored' }));
        window.addEventListener('offline', () => this.transition({ type: 'networkLost' }));

        // Initial check
        const hasNetwork = navigator.onLine;
        this.checkServerHealth().then(isServerAlive => {
            this.transition({
                type: 'appInitialized',
                payload: { hasNetwork, isServerAlive }
            });
        });
    }

    public get state(): PwaStateId {
        return this.currentState;
    }

    public async checkServerHealth(): Promise<boolean> {
        if (!navigator.onLine) return false;
        try {
            const response = await fetch('/eboplayer/ping', { method: 'HEAD', cache: 'no-store' });
            const isAlive = response.ok;

            if (isAlive) {
                this.transition({ type: 'serverResponded' });
            } else {
                this.transition({ type: 'serverTimedOut' });
            }
            return isAlive;
        } catch {
            this.transition({ type: 'serverTimedOut' });
            return false;
        }
    }
}
