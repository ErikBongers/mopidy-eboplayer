import {ComponentView} from "./view";
import {isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, PlaybackUserOptions, Pages} from "../modelTypes";
import {EboPlayerBar} from "../components/eboPlayerBar";
import {State} from "../playerState";
import {unreachable} from "../global";

export class PlayerBarView extends ComponentView<EboPlayerBar> {

    constructor(state: State, component: EboPlayerBar) {
        super(state, component);
    }

    bind() {
        this.state.getModel().on("playbackStateChanged.eboplayer", async () => {
            await this.onPlaybackStateChanged();
        });
        this.state.getModel().on("currentTrackChanged.eboplayer", async () => {
            await this.onCurrentTrackChanged();
        });
        this.state.getModel().on("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        this.state.getModel().on("activeStreamLinesChanged.eboplayer", () => {
            this.onActiveStreamLinesChanged();
        });
        this.state.getModel().on("playbackModeChanged.eboplayer", () => {
            this.onPlaybackModeChanged();
        });

        this.component.on("playPressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendPlay();
        });
        this.component.on("stopPressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendStop();
        });
        this.component.on("pausePressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendPause();
        });
        this.component.on("buttonBarAlbumImgClicked.eboplayer", () => {
            this.onButtonBarImgClicked();
        });
        this.state.getModel().on("volumeChanged.eboplayer", () => {
            this.onVolumeChanged();
        });
        this.component.on("changingVolume.eboplayer", async (ev) => {
            let value = ev.detail.volume;
            await this.state.getController().mopidyProxy.sendVolume(value);
        });
        this.component.on("optionSelected.eboplayer", async (ev) => {
            await this.changeRepeat(ev.detail.selected);
        });

        this.state.getModel().on("viewChanged.eboplayer", () => {
            this.showHideInfo();
        });
    }

    private onVolumeChanged() {
        let volume = this.state.getModel().getVolume();
        this.component.setAttribute("volume", volume.toString());

    }

    private async onPlaybackStateChanged() {
        let playState = this.state.getModel().getPlayState();
        this.component.setAttribute("play_state", playState??"stopped");
        await this.updateComponent();
    }

    private async onCurrentTrackChanged() {
        await this.updateComponent();
    }

    private async onSelectedTrackChanged() {
        await this.updateComponent();
    }

    private async updateComponent() {
        let track = this.state.getModel().getCurrentTrack();
        if (!track) {
            this.component.setAttribute("text", "");
            this.component.setAttribute("allow_play", "false");
            this.component.setAttribute("allow_prev", "false");
            this.component.setAttribute("allow_next", "false");
            this.component.setAttribute("image_url", "");
            this.component.setAttribute("stop_or_pause", "stop");
        } else {
            let trackModel = await this.state.getController().getExpandedTrackModel(track);
            if (isInstanceOfExpandedStreamModel(trackModel)) {
                let active_titles = "";
                let activeStreamLines = this.state.getModel().getActiveStreamLines();
                if (activeStreamLines)
                    active_titles = activeStreamLines.active_titles.join("\n");
                this.component.setAttribute("text", active_titles);
                this.component.setAttribute("allow_play", "true");
                this.component.setAttribute("allow_prev", "false");
                this.component.setAttribute("allow_next", "false");
                this.component.setAttribute("image_url", trackModel.bigImageUrl);
                this.component.setAttribute("stop_or_pause", "stop");
            } else if (isInstanceOfExpandedTrackModel(trackModel)) {
                this.component.setAttribute("text", trackModel.track.track.name?? "--no name--");
                this.component.setAttribute("allow_play", "true");
                this.component.setAttribute("allow_prev", "false");
                this.component.setAttribute("allow_next", "false");
                this.component.setAttribute("image_url", trackModel.bigImageUrl);
                this.component.setAttribute("stop_or_pause", "pause");
            }
        }
        this.showHideInfo();
    }

    private showHideInfo() {
        let currentTrack = this.state.getModel().getCurrentTrack();
        let selectedTrack = this.state.getModel().getSelectedTrack();
        let currentView = this.state.getModel().getPage();
        let show_info = false;
        if(selectedTrack && currentTrack != selectedTrack)
            show_info = true;
        if(currentView != "#NowPlaying")
            show_info = true;
        this.component.setAttribute("show_info", show_info.toString());
    }

    private onButtonBarImgClicked() {
        this.state.getController().setSelectedTrack(this.state.getModel().getCurrentTrack());
        this.state.getController().viewController.setView("#NowPlaying");
    }

    private onActiveStreamLinesChanged() {
        let lines = this.state.getModel().getActiveStreamLines();
        this.component.setAttribute("text", lines?.active_titles.join("\n")??"");
    }

    private async changeRepeat(selected: PlaybackUserOptions | null) {
        switch(selected) {
            case "repeat":
                await this.state.getController().setRepeat(true);
                await this.state.getController().setSingle(false);
                break;
            case "single":
                await this.state.getController().setRepeat(false);
                await this.state.getController().setSingle(true);
                break;
            case "repeatSingle":
                await this.state.getController().setRepeat(true);
                await this.state.getController().setSingle(true);
                break;
            case null:
            case "justPlay":
                await this.state.getController().setRepeat(false);
                await this.state.getController().setSingle(false);
                break;
            default:
                unreachable(selected);
        }
    }

    private onPlaybackModeChanged() {
        let modes = this.state.getModel().getPlaybackMode();
        let option: PlaybackUserOptions = "justPlay";
        if(modes.repeat) {
            if(modes.single)
                option = "repeatSingle";
            else
                option = "repeat";
        }
        this.component.playMode = option;
    }
}
