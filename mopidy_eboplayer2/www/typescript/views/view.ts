import {NestedDataRequester} from "./dataRequester";
import {EboComponent} from "../components/EboComponent";
import EboEventTarget, {EboEventHandlersEventMap, EboplayerEvent} from "../events";

export enum EboPlayerDataType {//todo: move to types.
    Volume,
    CurrentTrack,
    PlayState,
    TrackList,
}

export abstract class View extends NestedDataRequester<View> {
    abstract bind(): void;

    bindRecursive() {
        this.children.forEach(child => child.bindRecursive());
        this.bind();
    }
}

export abstract class ComponentView<T extends EboComponent> extends View {
    protected component: T;

    protected constructor(component: T) {
        super();
        this.component = component;
    }

    protected on<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions
    ): void {
        this.component.addEboEventListener(type, listener, options);
    }
}