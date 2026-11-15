export type HandlerResponse<STATE_ID> = STATE_ID | undefined;

export type TransitionHandler<STATE_ID, EVENT_ID> = (event: EVENT_ID) => (HandlerResponse<STATE_ID> | undefined);

export type StateEvents<STATE_ID extends string, EVENT_ID extends string> = {
[K in EVENT_ID]: TransitionHandler<STATE_ID, EVENT_ID>;
};

export type PartialStateEvents<STATE_ID extends string, EVENT_ID extends string> = Partial<StateEvents<STATE_ID, EVENT_ID>>;

export abstract class StateClass<STATE_ID extends string, EVENT_ID extends string> {
    stateId: STATE_ID;
    stateEvents: PartialStateEvents<STATE_ID, EVENT_ID>;

    protected constructor(stateId: STATE_ID, stateEvents: PartialStateEvents<STATE_ID, EVENT_ID>) {
        this.stateId = stateId;
        this.stateEvents = stateEvents;
    }

    getHandler(event: EVENT_ID) {
        return this.stateEvents[event];
    }
}

export class StateMachine<STATE_ID extends string, EVENT_ID extends string> {
    private currentStateId: STATE_ID;
    private listeners: ((state: STATE_ID) => void)[] = [];
    private states: Map<STATE_ID, StateClass<STATE_ID, EVENT_ID>> = new Map();

    constructor(initialStateId: STATE_ID) {
        this.currentStateId = initialStateId;
    }

    public transition(event: EVENT_ID) {
        let currentState = this.states.get(this.currentStateId);
        if (!currentState)
            throw new Error(`State ${this.currentStateId} not found.`);

        const transitionHandler = currentState.getHandler(event);
        if(!transitionHandler)
            return;

        const nextState = transitionHandler(event);
        if (nextState && nextState !== this.currentStateId) {
            this.currentStateId = nextState;
            this.notifyListeners();
        }
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentStateId));
    }
}
