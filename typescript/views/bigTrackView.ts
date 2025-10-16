import getState from "../playerState";
import {EboplayerEvents, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {StreamLinesView} from "./streamLinesView";
import {EboProgressBar} from "../components/eboProgressBar";
import {console_yellow} from "../gui";

export class BigTrackView extends View {
    private streamLinesView: StreamLinesView;
    private id: string;

    constructor(id: string) {
        super();
        this.id = id;
        this.streamLinesView = new StreamLinesView(`trackInfoBig_streamLines`);
        this.addChildren(this.streamLinesView);
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChangegd();
        });
        getState().getModel().addEventListener(EboplayerEvents.trackListChanged, () => {
            this.onTrackListChangegd();
        });
    }

    private onTrackListChangegd() {
        getState().getController().fetchCurrentTrackAndDetails();
    }

    private onCurrentTrackChangegd() {
        let track  = getState().getModel().getCurrentTrack();
        if(track.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let div = document.getElementById(this.id);
        let name = "no current track";
        let info = "";
        let progressBar = div.querySelector(EboProgressBar.tagName); //todo: assuming there's only one progressBar.
        switch (track.type) {
            case TrackType.Stream:
                name = track.name;
                progressBar.setAttribute("position", "100");
                break;
            case TrackType.File:
                name = track.title;
                info = track.track.album.name;
                let artists = track.track.artists.map(a => a.name).join(", ");
                let composers = track.track.composers.map(c => c.name).join(", ");
                if(artists)
                    info += "<br>" + artists;
                if(composers)
                    info += "<br>" + composers;
                break;
        }
        document.getElementById("trackInfoBig_trackName").innerText  = name;
        document.getElementById("trackInfoBig_extraInfo").innerHTML  = info;
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList];
    }
}