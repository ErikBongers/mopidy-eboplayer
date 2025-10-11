import getState from "../playerState";
import {EboplayerEvents} from "../model";
import {EboPlayerDataType, View} from "./view";

export class StreamLinesView extends View {
    private id: string;

    constructor(id: string) {
        super();
        this.id = id;
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChangegd();
        });
    }

    private onStreamLinesChangegd() {
        let lines = getState().getModel().getActiveStreamLines();
        let element = document.getElementById(this.id);
        element.innerHTML = lines.join("<br/>");
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.StreamLines];
    }
}