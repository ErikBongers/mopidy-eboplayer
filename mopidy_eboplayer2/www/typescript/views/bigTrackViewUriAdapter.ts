import getState from "../playerState";
import {Model} from "../model";
import {EboPlayerDataType} from "./view";
import {ComponentViewAdapter} from "./componentViewAdapter";
import {EboBigTrackComp} from "../components/eboBigTrackComp";
import {AlbumData, AlbumNone, EboplayerEvents, ExpandedFileTrackModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, ItemType, TrackModel} from "../modelTypes";

export class BigTrackViewUriAdapter extends ComponentViewAdapter {
    private streamLines: string;
    private uri: string;

    constructor(id: string) {
        super(id);
        this.streamLines = "";
        this.uri = "";
    }

    bind() {
        super.bind();
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onActiveTrackChanged();
        });
    }

    async setUri(uri: string) {
        this.uri = uri;
        let track = await getState().getController().getExpandedTrackModel(uri);
        this.setComponentData(track);
    }

    protected onStreamLinesChanged() {
        this.streamLines = "";
        let linesObject = getState().getModel().getActiveStreamLines();
        if (linesObject?.uri == this.uri)
            this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    protected onActiveTrackChanged() {
        let streamTitles = getState().getModel().getActiveStreamLines();
        if (streamTitles?.uri == this.uri)
            this.streamLines = streamTitles.active_titles?.join("<br/>") ?? "";
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
        let comp = document.getElementById(this.componentId) as EboBigTrackComp;
        comp.activeTrackUri = getState().getModel().getCurrentTrack();
    }

    protected setComponentData(track: ExpandedStreamModel | ExpandedFileTrackModel) {
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        if(isInstanceOfExpandedStreamModel(track)) {
            name = track.stream.name;
            position = "100";
            button = "false";
        } else {
            name = track.track.title;
            info = track.album.albumInfo.name;
            position = "60"; //todo: just a test
            button = "true";
            let artists = track.track.track.artists.map(a => a.name).join(", ");
            let composers = track.track.track.composers?.map(c => c.name)?.join(", ") ?? "";
            if(artists)
                info += "<br>" + artists;
            if(composers)
                info += "<br>" + composers;
        }
        let comp = document.getElementById(this.componentId) as EboBigTrackComp;
        comp.setAttribute("name", name);
        comp.setAttribute("info", info);
        comp.setAttribute("position", position);
        comp.setAttribute("button", button);
        this.onStreamLinesChanged();
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines, ...super.getRequiredDataTypes()];
    }
}