import {ExpandedFileTrackModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, MessageType, StreamUri, TrackUri} from "../modelTypes";
import {State} from "../playerState";
import {ComponentView} from "./view";
import {EboNowPlayingComp} from "../components/eboNowPlayingComp";

export class NowPlayingView extends ComponentView<EboNowPlayingComp> {
    private streamLines: string = "";
    private programTitle: string = "";
    private uri: string | null = null;
    private track: ExpandedStreamModel | ExpandedFileTrackModel | null = null;

    constructor(state: State, component: EboNowPlayingComp) {
        super(state, component);
    }

    bind() {
        this.state.getModel().on("currentTrackChanged.eboplayer", async () => {
            await this.onCurrentOrSelectedChanged();
        });
        this.state.getModel().on("selectedTrackChanged.eboplayer", async () => {
            await this.onCurrentOrSelectedChanged();
        });
        this.state.getModel().on("activeStreamLinesChanged.eboplayer", (ev) => {
            this.onStreamLinesChanged();
        });
        this.state.getModel().on("programTitleChanged.eboplayer", (ev) => {
            this.onProgramTitleChanged();
        });
        this.state.getModel().on("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });

        this.component.on("bigTimelineImageClicked.eboplayer", async () => {
            await this.onTimelineBigImgClick();
        });
        this.component.on("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
            this.component.setAttribute("show_back", "false");
        });

    }

    private async onCurrentOrSelectedChanged() {
        let currentTrackUri = this.state.getModel().getCurrentTrack();
        let selectedTrackUri = this.state.getModel().getSelectedTrack();
        await this.setUri(selectedTrackUri ?? currentTrackUri);
    }

    protected onStreamLinesChanged() {
        let selectedTrackUri = this.state.getModel().getSelectedTrack();
        let currentTrackUri = this.state.getModel().getCurrentTrack();
        this.streamLines = "";
        if (selectedTrackUri == currentTrackUri) {
            let linesObject = this.state.getModel().getActiveStreamLines();
            if (this.uri && linesObject?.uri == this.uri)
                this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        }
        this.component.setAttribute("stream_lines", this.streamLines);
    }

    async setUri(uri: TrackUri | StreamUri | null) {
        this.uri = uri;
        this.track = await this.state.getController().getExpandedTrackModel(uri);
        this.setComponentData();
    }

    protected setComponentData() {
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        let imageUrl: string;
        if (!this.track) {
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
                imageUrl = this.track.bigImageUrl;
            } else {
                name = this.track.track.title;
                if (this.programTitle)
                    name = this.programTitle + " -  " + name;
                info = this.track.album?.albumInfo?.name ?? "--no name--";
                position = "60"; //todo: just a test
                button = "true";
                imageUrl = this.track.bigImageUrl;
                let artists = this.track.track.track.artists?.map(a => a.name).join(", ") ?? "";
                let composers = this.track.track.track.composers?.map(c => c.name)?.join(", ") ?? "";
                if (artists)
                    info += "<br>" + artists;
                if (composers)
                    info += "<br>" + composers;
            }
        }
        this.component.setAttribute("name", name);
        this.component.setAttribute("info", info);
        this.component.setAttribute("position", position);
        this.component.setAttribute("button", button);
        this.component.setAttribute("img", imageUrl);
        this.onStreamLinesChanged();
    }

    private onProgramTitleChanged() {
        this.programTitle = this.state.getModel().getCurrentProgramTitle();
        this.setComponentData();
    }

    private async onTrackListChanged() {
        if (!this.state.getModel().getCurrentTrack()) {
            let trackList = this.state.getModel().getTrackList();
            if (trackList.length > 0)
                await this.state.getController().setCurrentTrackAndFetchDetails(trackList[0]);
        }
    }

    private async onTimelineBigImgClick() {
        let selectedTrack = this.state.getModel().getSelectedTrack();
        if (!selectedTrack) return;
        let expandedTrackInfo = await this.state.getController().getExpandedTrackModel(selectedTrack);
        if (!expandedTrackInfo) return;
        if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
            if (expandedTrackInfo.album?.albumInfo)
                this.state.getController().viewController.showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri as TrackUri); //Shouldn't be a Stream.
            else { //orphaned track (no album)
                this.state.getController().showTempMessage("This track has no album.", MessageType.Error);
            }
            return;
        }
        if (isInstanceOfExpandedStreamModel(expandedTrackInfo)) {
            this.state.getController().viewController.showRadio(expandedTrackInfo.stream.ref.uri as StreamUri);
        }
    }
}
