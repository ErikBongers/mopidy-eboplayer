import getState from "../playerState";
import {EboplayerEvents, Model, TrackModel, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {BigTrackViewAdapter} from "./bigTrackViewAdapter";
import { BigTrackViewUriAdapter } from "./bigTrackViewUriAdapter";

export class BigTrackViewCurrentOrSelectedAdapter extends BigTrackViewUriAdapter {
    constructor(id: string) {
        super(id);
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, async () => {
            this.onCurrentOrSelectedChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, async () => {
            this.onCurrentOrSelectedChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
    }

    private onCurrentOrSelectedChanged() {
        let currentTrackUri = getState().getModel().getCurrentTrack();
        let selectedTrackUri: string = getState().getModel().getSelectedTrack();
        this.setUri(selectedTrackUri ?? currentTrackUri);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList, ...super.getRequiredDataTypes()];
    }

}