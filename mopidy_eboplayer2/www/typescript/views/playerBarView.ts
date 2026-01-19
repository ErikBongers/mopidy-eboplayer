import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, Views} from "../modelTypes";
import {MainView} from "./mainView";
import {EboPlayerBar} from "../components/eboButtonBarComp";
import {Controller} from "../controllers/controller";

export class PlayerBarView extends View {
    private componentId: string;
    private parent: MainView;

    constructor(containerId: string, parent: MainView) {
        super();
        this.parent = parent;
        this.componentId = containerId;
    }

    bind() {
        getState().getModel().addEboEventListener("playbackStateChanged.eboplayer", async () => {
            await this.onPlaybackStateChanged();
        });
        getState().getModel().addEboEventListener("currentTrackChanged.eboplayer", async () => {
            await this.onCurrentTrackChanged();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        getState().getModel().addEboEventListener("activeStreamLinesChanged.eboplayer", () => {
            this.onActiveStreamLinesChanged();
        });

        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.addEboEventListener("playPressed.eboplayer", async () => {
            await getState().getController().mopidyProxy.sendPlay();
        });
        comp.addEboEventListener("stopPressed.eboplayer", async () => {
            await getState().getController().mopidyProxy.sendStop();
        });
        comp.addEboEventListener("pausePressed.eboplayer", async () => {
            await getState().getController().mopidyProxy.sendPause();
        });
        comp.addEboEventListener("buttonBarAlbumImgClicked.eboplayer", () => {
            this.onButtonBarImgClicked();
        });
        getState().getModel().addEboEventListener("volumeChanged.eboplayer", () => {
            this.onVolumeChanged();
        });
        comp.addEboEventListener("changingVolume.eboplayer", async (ev) => {
            let value = ev.detail.volume;
            await getState().getController().mopidyProxy.sendVolume(value);
        });
        getState().getModel().addEboEventListener("viewChanged.eboplayer", () => {
            this.showHideInfo();
        });
    }

    private onVolumeChanged() {
        let volume = getState().getModel().getVolume();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("volume", volume.toString());

    }

    private async onPlaybackStateChanged() {
        let playState = getState().getModel().getPlayState();
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
        let track = getState().getModel().getCurrentTrack();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        if (!track) {
            comp.setAttribute("text", "");
            comp.setAttribute("allow_play", "false");
            comp.setAttribute("allow_prev", "false");
            comp.setAttribute("allow_next", "false");
            comp.setAttribute("image_url", "");
            comp.setAttribute("stop_or_pause", "stop");
        } else {
            let trackModel = await getState().getController().getExpandedTrackModel(track);
            if (isInstanceOfExpandedStreamModel(trackModel)) {
                let active_titles = "";
                let activeStreamLines = getState().getModel().getActiveStreamLines();
                if (activeStreamLines)
                    active_titles = activeStreamLines.active_titles.join("\n");
                comp.setAttribute("text", active_titles);
                comp.setAttribute("allow_play", "true");
                comp.setAttribute("allow_prev", "false");
                comp.setAttribute("allow_next", "false");
                comp.setAttribute("image_url", trackModel.stream.imageUrl);
                comp.setAttribute("stop_or_pause", "stop");
            } else if (isInstanceOfExpandedTrackModel(trackModel)) {
                comp.setAttribute("text", trackModel.track.track.name?? "--no name--");
                comp.setAttribute("allow_play", "true");
                comp.setAttribute("allow_prev", "false");
                comp.setAttribute("allow_next", "false");
                comp.setAttribute("image_url", trackModel.album?.imageUrl?? Controller.DEFAULT_IMG_URL);
                comp.setAttribute("stop_or_pause", "pause");
            }
        }
        this.showHideInfo();
    }

    private showHideInfo() {
        let currentTrack = getState().getModel().getCurrentTrack();
        let selectedTrack = getState().getModel().getSelectedTrack();
        let currentView = getState().getModel().getView();
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
        getState().getController().setSelectedTrack(getState().getModel().getCurrentTrack());
        getState().getController().setView(Views.NowPlaying);
    }

    private onActiveStreamLinesChanged() {
        let lines = getState().getModel().getActiveStreamLines();
        let comp = document.getElementById(this.componentId) as EboPlayerBar;
        comp.setAttribute("text", lines.active_titles.join("\n"));
    }
}
