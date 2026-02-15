import {View} from "./view";
import {State} from "../playerState";

export class ComponentViewAdapter extends View {
    protected componentId: string;

    constructor(state: State, id: string) {
        super(state);
        this.componentId = id;
    }

    bind(): void {
    }
}