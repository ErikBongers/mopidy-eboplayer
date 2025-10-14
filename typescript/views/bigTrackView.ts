import getState from "../playerState";
import {EboplayerEvents, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {StreamLinesView} from "./streamLinesView";
import {EboProgressBar} from "../components/eboProgressBar";

export class BigTrackView extends View {
    private streamLinesView: StreamLinesView;
    private id: string;

    constructor(id: string) {
        super();
        this.id = id;
        this.streamLinesView = new StreamLinesView("currentTrackStreamLines");
        this.addChildren(this.streamLinesView);
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChangegd();
        });
    }

    private onCurrentTrackChangegd() {
        let div = document.getElementById(this.id);
        let name = "no current track";
        let track  = getState().getModel().getCurrentTrack();
        let progressBar = div.querySelector(EboProgressBar.tagName); //todo: assuming there's only one progressBar.
        switch (track.type) {
            case TrackType.Stream:
                name = track.name;
                progressBar.setAttribute("position", "100");
                break;
            case TrackType.File:
                name = track.title;
                break;
        }
        document.getElementById("currentTrackName").innerText  = name;
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
}