import {View} from "./view";
import {EboPlayerDataType, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, Views} from "../modelTypes";
import {MainView} from "./mainView";
import {EboPlayerBar} from "../components/eboButtonBarComp";
import {Controller} from "../controllers/controller";
import {State} from "../playerState";

export class PlayerBarView extends View {
    private componentId: string;
    private parent: MainView;

    constructor(state: State, containerId: string, parent: MainView) {
        super(state);
        this.parent = parent;
        this.componentId = containerId;
    }

    bind() {
        this.state.getModel().addEboEventListener("playbackStateChanged.eboplayer", async () => {
            await this.onPlaybackStateChanged();
        });
        this.state.getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
            await this.onCurrentTrackChanged();
        });
        this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        this.state.getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", () => {
            this.onActiveStreamLinesChanged();
        });

        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.addEboEventListener("playPressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendPlay();
        });
        comp.addEboEventListener("stopPressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendStop();
        });
        comp.addEboEventListener("pausePressed.eboplayer", async () => {
            await this.state.getController().mopidyProxy.sendPause();
        });
        comp.addEboEventListener("buttonBarAlbumImgClicked.eboplayer", () => {
            this.onButtonBarImgClicked();
        });
        this.state.getModel().addEboEventListener("volumeChanged.eboplayer", () => {
            this.onVolumeChanged();
        });
        comp.addEboEventListener("changingVolume.eboplayer", async (ev) => {
            let value = ev.detail.volume;
            await this.state.getController().mopidyProxy.sendVolume(value);
        });
        this.state.getModel().addEboEventListener("viewChanged.eboplayer", () => {
            this.showHideInfo();
        });
    }

    private onVolumeChanged() {
        let volume = this.state.getModel().getVolume();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("volume", volume.toString());

    }

    private async onPlaybackStateChanged() {
        let playState = this.state.getModel().getPlayState();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("play_state", playState);
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
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        if (!track) {
            comp.setAttribute("text", "");
            comp.setAttribute("allow_play", "false");
            comp.setAttribute("allow_prev", "false");
            comp.setAttribute("allow_next", "false");
            comp.setAttribute("image_url", "");
            comp.setAttribute("stop_or_pause", "stop");
        } else {
            let trackModel = await this.state.getController().getExpandedTrackModel(track);
            if (isInstanceOfExpandedStreamModel(trackModel)) {
                let active_titles = "";
                let activeStreamLines = this.state.getModel().getActiveStreamLines();
                if (activeStreamLines)
                    active_titles = activeStreamLines.active_titles.join("\n");
                comp.setAttribute("text", active_titles);
                comp.setAttribute("allow_play", "true");
                comp.setAttribute("allow_prev", "false");
                comp.setAttribute("allow_next", "false");
                comp.setAttribute("image_url", trackModel.bigImageUrl);
                comp.setAttribute("stop_or_pause", "stop");
            } else if (isInstanceOfExpandedTrackModel(trackModel)) {
                comp.setAttribute("text", trackModel.track.track.name?? "--no name--");
                comp.setAttribute("allow_play", "true");
                comp.setAttribute("allow_prev", "false");
                comp.setAttribute("allow_next", "false");
                comp.setAttribute("image_url", trackModel.bigImageUrl);
                comp.setAttribute("stop_or_pause", "pause");
            }
        }
        this.showHideInfo();
    }

    private showHideInfo() {
        let currentTrack = this.state.getModel().getCurrentTrack();
        let selectedTrack = this.state.getModel().getSelectedTrack();
        let currentView = this.state.getModel().getView();
        let show_info = false;
        if(selectedTrack && currentTrack != selectedTrack)
            show_info = true;
        if(currentView != Views.NowPlaying)
            show_info = true;
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("show_info", show_info.toString());
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.PlayState, EboPlayerDataType.Volume];
    }

    private onButtonBarImgClicked() {
        this.state.getController().setSelectedTrack(this.state.getModel().getCurrentTrack());
        this.state.getController().setView(Views.NowPlaying);
    }

    private onActiveStreamLinesChanged() {
        let lines = this.state.getModel().getActiveStreamLines();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("text", lines.active_titles.join("\n"));
    }
}
