import getState from "../playerState";
import {EboPlayerDataType} from "./view";
import {ComponentViewAdapter} from "./componentViewAdapter";
import {ExpandedFileTrackModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel} from "../modelTypes";
import {EboBigTrackComp} from "../components/eboBigTrackComp";
import {EboplayerEvents} from "../events";

export class BigTrackViewCurrentOrSelectedAdapter extends ComponentViewAdapter {
    private streamLines: string;
    private uri: string;

    constructor(id: string) {
        super(id);
    }

    override bind() {
        super.bind();
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
        let selectedTrackUri = getState().getModel().getSelectedTrack();
        this.setUri(selectedTrackUri ?? currentTrackUri);
    }

    override getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines, ...super.getRequiredDataTypes()];
    }

    protected onStreamLinesChanged() {
        let selectedTrackUri = getState().getModel().getSelectedTrack();
        let currentTrackUri = getState().getModel().getCurrentTrack();
        this.streamLines = "";
        if(selectedTrackUri == currentTrackUri) {
            let linesObject = getState().getModel().getActiveStreamLines();
            if (this.uri && linesObject?.uri == this.uri)
                this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        }
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    async setUri(uri: string) {
        this.uri = uri;
        let track = await getState().getController().getExpandedTrackModel(uri);
        this.setComponentData(track);
    }

    protected setComponentData(track: ExpandedStreamModel | ExpandedFileTrackModel) {
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        let imageUrl: string;
        if(isInstanceOfExpandedStreamModel(track)) {
            name = track.stream.name;
            position = "100";
            button = "false";
            imageUrl = track.stream.imageUrl;
        } else {
            name = track.track.title;
            info = track.album.albumInfo.name;
            position = "60"; //todo: just a test
            button = "true";
            imageUrl = track.album.imageUrl;
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
        comp.setAttribute("img", imageUrl);
        this.onStreamLinesChanged();
    }
}