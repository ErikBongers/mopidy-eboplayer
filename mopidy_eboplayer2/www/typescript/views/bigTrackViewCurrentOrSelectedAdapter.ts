import getState from "../playerState";
import {EboPlayerDataType} from "./view";
import {ComponentViewAdapter} from "./componentViewAdapter";
import {ExpandedFileTrackModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, StreamUri, TrackUri} from "../modelTypes";
import EboBigTrackComp from "../components/eboBigTrackComp";

export class BigTrackViewCurrentOrSelectedAdapter extends ComponentViewAdapter {
    private streamLines: string;
    private programTitle: string = "";
    private uri: string | null = null;
    private track: ExpandedStreamModel | ExpandedFileTrackModel | null;

    constructor(id: string) {
        super(id);
    }

    override bind() {
        super.bind();
        getState().getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
            await this.onCurrentOrSelectedChanged();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onCurrentOrSelectedChanged();
        });
        getState().getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", (ev) => {
            this.onStreamLinesChanged();
        });
        getState().getModel().addEboEventListener("programTitleChanged.eboplayer", (ev) => {
            this.onProgramTitleChanged();
        });
    }

    private async onCurrentOrSelectedChanged() {
        let currentTrackUri = getState().getModel().getCurrentTrack();
        let selectedTrackUri = getState().getModel().getSelectedTrack();
        await this.setUri(selectedTrackUri ?? currentTrackUri);
    }

    override getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack, EboPlayerDataType.TrackList, ...super.getRequiredDataTypes()];
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
        // @ts-ignore
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    async setUri(uri: TrackUri | StreamUri | null) {
        this.uri = uri;
        this.track = await getState().getController().getExpandedTrackModel(uri);
        this.setComponentData();
    }

    protected setComponentData() {
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        let imageUrl: string;
        if(!this.track) {
            name = "no current track";
            info = "";
            position = "0";
            button = "false";
            imageUrl = "";
        } else {
            if (isInstanceOfExpandedStreamModel(this.track)) {
                name = this.track.stream.name;
                position = "100";
                button = "false";
                imageUrl = this.track.stream.imageUrl;
            } else {
                name = this.track.track.title;
                info = this.track.album.albumInfo?.name?? "--no name--";
                position = "60"; //todo: just a test
                button = "true";
                imageUrl = this.track.album.imageUrl;
                let artists = this.track.track.track.artists.map(a => a.name).join(", ");
                let composers = this.track.track.track.composers?.map(c => c.name)?.join(", ") ?? "";
                if (artists)
                    info += "<br>" + artists;
                if (composers)
                    info += "<br>" + composers;
            }
        }
        let comp = document.getElementById(this.componentId) as EboBigTrackComp;
        comp.setAttribute("name", name);
        comp.setAttribute("info", info);
        comp.setAttribute("position", position);
        comp.setAttribute("button", button);
        comp.setAttribute("img", imageUrl);
        comp.setAttribute("program_title", this.programTitle);
        this.onStreamLinesChanged();
    }

    private onProgramTitleChanged() {
        this.programTitle = getState().getModel().getCurrentProgramTitle();
        this.setComponentData();
    }
}