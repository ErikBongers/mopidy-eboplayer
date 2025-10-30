import {EboPlayerDataType, View} from "./view";
import {console_yellow} from "../gui";

export class BigTrackViewAdapter extends View {
    protected componentId: string;

    constructor(id: string) {
        super();
        this.componentId = id;
    }

    bind(): void {
        console_yellow("BINDING comp");
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }

}