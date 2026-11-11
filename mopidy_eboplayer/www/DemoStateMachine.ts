type PwaState =
    | 'NOT_INITIALIZED'  // app still needs to setupStuff()
    | 'ONLINE' // all normal
    | 'NO_SERVER' // switch to offline repos and keep polling...
    | 'NO_NETWORK'; //switch to offline repos and DON'T poll.

type PwaEvent =
    | { type: 'networkRestored' }
    | { type: 'networkLost' }
    | { type: 'serverResponded' }
    | { type: 'serverTimedOut' }
    | { type: 'appInitialized'; payload: { hasNetwork: boolean; isServerAlive: boolean } };

// 2. Define the strict transition matrix
const stateTransitions: Record<PwaState, Partial<Record<PwaEvent['type'], (event: any) => PwaState>>> = {
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

export class DemoNetworkStateMachine {
    private currentState: PwaState = 'NOT_INITIALIZED';
    private listeners: ((state: PwaState) => void)[] = [];

    constructor() {
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

    public get state(): PwaState {
        return this.currentState;
    }

    public subscribe(listener: (state: PwaState) => void) {
        this.listeners.push(listener);
        listener(this.currentState);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public transition(event: PwaEvent) {
        const transitionsForState = stateTransitions[this.currentState];
        const nextStateResolver = transitionsForState?.[event.type];

        if (nextStateResolver) {
            const nextState = nextStateResolver(event);
            if (nextState !== this.currentState) {
                this.currentState = nextState;
                this.notifyListeners();
            }
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentState));
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
