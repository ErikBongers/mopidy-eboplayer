import getState from "../playerState";
import {EboplayerEvents, StreamTrackModel, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";

export class BigTrackView extends View {
    //todo: add constructor with id.
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChangegd();
        });
    }

    private onCurrentTrackChangegd() {
        console.log("VIEW: CURRENT TRACK CHANGGED");
        let name = "???";
        let track  = getState().getModel().getActiveTrack();
        if(track.type == TrackType.Stream) {
            name = track.name;
        }
        document.getElementById("currentTrackName").innerText  = name;
    }

    getRequiredData(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
}