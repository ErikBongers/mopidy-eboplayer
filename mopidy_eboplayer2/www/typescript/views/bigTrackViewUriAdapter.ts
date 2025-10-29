import getState from "../playerState";
import {EboplayerEvents, Model, TrackModel, TrackType} from "../model";
import {EboPlayerDataType} from "./view";
import {BigTrackViewAdapter} from "./bigTrackViewAdapter";

export class BigTrackViewUriAdapter extends BigTrackViewAdapter {
    private streamLines: string;
    private track: TrackModel;
    private uri: string;

    constructor(id: string) {
        super(id);
        this.streamLines = "";
        this.track = Model.NoTrack;
        this.uri = "";
    }

    bind() {
        //todo: streamlines belong to specific stream uris. Make seperate streamline files for per stream (uri).
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
    }

    setUri(uri: string) {
        this.uri = uri;
        getState().getController().getTrackInfo(this.uri)
            .then(track => {
                this.track = track;
                this.setComponentData();
            });
    }

    protected onStreamLinesChanged() {
        this.streamLines = getState().getModel().getActiveStreamLines().join("<br/>");
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    protected setComponentData() {
        if(this.track.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        switch (this.track.type) {
            case TrackType.Stream:
                name = this.track.name;
                position = "100";
                button = "false";
                break;
            case TrackType.File:
                name = this.track.title;
                info = this.track.track.album.name;
                position = "60"; //todo: just a test
                button = "true";
                let artists = this.track.track.artists.map(a => a.name).join(", ");
                let composers = this.track.track.composers.map(c => c.name).join(", ");
                if(artists)
                    info += "<br>" + artists;
                if(composers)
                    info += "<br>" + composers;
                break;
        }
        document.getElementById(this.componentId).setAttribute("name", name);
        document.getElementById(this.componentId).setAttribute("info", info);
        document.getElementById(this.componentId).setAttribute("position", position);
        document.getElementById(this.componentId).setAttribute("button", button);
        this.onStreamLinesChanged();
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines, ...super.getRequiredDataTypes()];
    }

}