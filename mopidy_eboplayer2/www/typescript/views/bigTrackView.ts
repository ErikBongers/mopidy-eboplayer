import getState from "../playerState";
import {EboplayerEvents, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";

export class BigTrackView extends View {
    private id: string;
    private streamLines: string;

    constructor(id: string) {
        super();
        this.id = id;
        this.streamLines = "";
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChangegd();
        });
        getState().getModel().addEventListener(EboplayerEvents.trackListChanged, () => {
            this.onTrackListChangegd();
        });
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChangegd();
        });
    }

    private onStreamLinesChangegd() {
        this.streamLines = getState().getModel().getActiveStreamLines().join("<br/>");
        document.getElementById(this.id).setAttribute("stream_lines", this.streamLines);
    }

    private onTrackListChangegd() {
        getState().getController().fetchCurrentTrackAndDetails();
    }

    private async onCurrentTrackChangegd() {
        let trackUri  = getState().getModel().getCurrentTrack();
        let track = await getState().getController().getTrackInfo(trackUri);
        if(track.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let div = document.getElementById(this.id);
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        switch (track.type) {
            case TrackType.Stream:
                name = track.name;
                position = "100";
                button = "false";
                break;
            case TrackType.File:
                name = track.title;
                info = track.track.album.name;
                position = "60"; //todo: just a test
                button = "true";
                let artists = track.track.artists.map(a => a.name).join(", ");
                let composers = track.track.composers.map(c => c.name).join(", ");
                if(artists)
                    info += "<br>" + artists;
                if(composers)
                    info += "<br>" + composers;
                break;
        }
        document.getElementById(this.id).setAttribute("name", name);
        document.getElementById(this.id).setAttribute("info", info);
        document.getElementById(this.id).setAttribute("position", position);
        document.getElementById(this.id).setAttribute("button", button);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines];
    }

}