import getState from "../playerState";
import {EboplayerEvents, Model, TrackModel, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";

export class BigTrackView extends View {
    private componentId: string;
    private streamLines: string;
    private track: TrackModel;

    constructor(id: string) {
        super();
        this.componentId = id;
        this.streamLines = "";
        this.track = Model.NoTrack;
        // source =
        // currentTrack
        // selectedTrack
        // current or selectedTrack: with prio for selectedTrack
        //anyTrack

    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, async () => {
            let trackUri  = getState().getModel().getCurrentTrack();
            this.track = await getState().getController().getTrackInfo(trackUri);
            await this.setComponentData();
        });
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
    }

    private onStreamLinesChanged() {
        this.streamLines = getState().getModel().getActiveStreamLines().join("<br/>");
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    private async setComponentData() {
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
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines];
    }

}