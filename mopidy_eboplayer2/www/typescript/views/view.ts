import {NestedDataRequester} from "./dataRequester";
import {EboComponent} from "../components/EboComponent";
import EboEventTarget, {EboEventHandlersEventMap, EboplayerEvent} from "../events";
import { State } from "../playerState";

export abstract class View extends NestedDataRequester<View> {
    protected state: State;

    constructor(state: State) {
        super();
        this.state = state;
    }

    abstract bind(): void;

    bindRecursive() {
        this.children.forEach(child => child.bindRecursive());
        this.bind();
    }
}

export abstract class ComponentView<T extends EboComponent> extends View {
    protected component: T;

    protected constructor(state: State, component: T) {
        super(state);
        this.component = component;
    }

    protected on<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions
    ): void {
        this.component.addEboEventListener(type, listener, options);
    }
}