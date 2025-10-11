import getState from "../playerState";
import {EboplayerEvents, StreamTrackModel, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {StreamLinesView} from "./streamLinesView";

export class BigTrackView extends View {
    private streamLinesView: StreamLinesView;

    constructor() {
        super();
        this.streamLinesView = new StreamLinesView("currentTrackStreamLines");
        this.addChildren(this.streamLinesView);
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChangegd();
        });
    }

    private onCurrentTrackChangegd() {
        let name = "???";
        let track  = getState().getModel().getActiveTrack();
        switch (track.type) {
            case TrackType.Stream:
                name = track.name;
                break;
            case TrackType.File:
                name = track.title;
                break;
        }
        document.getElementById("currentTrackName").innerText  = name;
    }

    getRequiredData(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
}