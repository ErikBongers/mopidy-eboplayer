import {EboPlayerDataType, View} from "./view";

export class BigTrackViewAdapter extends View {
    protected componentId: string;

    constructor(id: string) {
        super();
        this.componentId = id;
    }

    bind(): void {
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}