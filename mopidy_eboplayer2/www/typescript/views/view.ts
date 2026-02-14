import {EboComponent} from "../components/EboComponent";
import EboEventTarget, {EboEventHandlersEventMap, EboplayerEvent} from "../events";
import { State } from "../playerState";

export interface Parent<Child> {
    addChildren(...children: Child[]): void;

    get children(): Child[];
}

export abstract class View  implements Parent<View> {
    protected state: State;
    private _children: View[] = [];

    constructor(state: State) {
        this.state = state;
    }

    abstract bind(): void;

    addChildren(...children: View[]) {
        this._children.push(...children);
    }

    get children(): View[] {
        return this._children;
    }

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