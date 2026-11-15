export type HandlerResponse<STATE_ID> = STATE_ID | undefined;

export type TransitionHandler<STATE_ID, EVENT_ID> = (event: EVENT_ID) => (HandlerResponse<STATE_ID> | undefined);

export type StateEvents<STATE_ID extends string, EVENT_ID extends string> = {
[K in EVENT_ID]: TransitionHandler<STATE_ID, EVENT_ID>;
};

export type StateMap<STATE_ID extends string, EVENT_ID extends string> = {
[K in STATE_ID]: StateClass<STATE_ID, EVENT_ID>;
};

export type PartialStateEvents<STATE_ID extends string, EVENT_ID extends string> = Partial<StateEvents<STATE_ID, EVENT_ID>>;

export abstract class StateClass<STATE_ID extends string, EVENT_ID extends string> {
    stateId: STATE_ID;

    protected constructor(stateId: STATE_ID) {
        this.stateId = stateId;
    }
}

export class StateMachine<STATE_ID extends string, EVENT_ID extends string> {
    private currentStateId: STATE_ID;
    private listeners: ((state: STATE_ID) => void)[] = [];
    private states: StateMap<STATE_ID, EVENT_ID>;

    constructor(initialStateId: STATE_ID, states: StateMap<STATE_ID, EVENT_ID>) {
        this.currentStateId = initialStateId;
        this.states = states;
    }

    public on(event: EVENT_ID) {
        let currentState = this.states[this.currentStateId];
        if (!currentState)
            throw new Error(`State ${this.currentStateId} not found.`);

        // @ts-ignore
        const nextState = currentState[event]() as HandlerResponse<STATE_ID>;
        if (nextState && nextState !== this.currentStateId) {
            this.currentStateId = nextState;
            this.notifyListeners();
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentStateId));
    }
}
