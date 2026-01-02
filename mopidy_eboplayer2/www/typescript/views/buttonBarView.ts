import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {isInstanceOfExpandedStreamModel, Views} from "../modelTypes";
import {MainView} from "./mainView";
import {EboButtonBar} from "../components/eboButtonBarComp";
import {console_yellow} from "../global";
import {EboplayerEvents} from "../events";

export class ButtonBarView extends View {
    private componentId: string;
    private parent: MainView;

    constructor(containerId: string, parent: MainView) {
        super();
        this.parent = parent;
        this.componentId = containerId;
    }

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.playStateChanged, () => {
            this.onPlaybackStateChangegd();
        });
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
            this.onSelectedTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onActiveStreamLinesChanged();
        });

        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.addEventListener(EboplayerEvents.playPressed, () => {
            this.playOrStopOrPause(EboplayerEvents.playPressed).then(r => {});
        });
        comp.addEventListener(EboplayerEvents.stopPressed, () => {
            this.playOrStopOrPause(EboplayerEvents.stopPressed).then(r => {});
        });
        comp.addEventListener(EboplayerEvents.pausePressed, () => {
            this.playOrStopOrPause(EboplayerEvents.pausePressed).then(r => {});
        });
        comp.addEventListener(EboplayerEvents.buttonBarAlbumImgClicked, () => {
            this.onButtonBarImgClicked();
        });
        getState().getModel().addEventListener(EboplayerEvents.volumeChanged, () => {
            this.onVolumeChanged();
        });
        comp.addEventListener(EboplayerEvents.changingVolume, async (ev) => {
            let value = parseInt((ev as CustomEvent).detail.volume);
            await getState().getController().mopidyProxy.sendVolume(value);

        });
        getState().getModel().addEventListener(EboplayerEvents.viewChanged, () => {
            this.showHideInfo();
        });
    }

    private onVolumeChanged() {
        let volume = getState().getModel().getVolume();
        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.setAttribute("volume", volume.toString());

    }

    private async onPlaybackStateChangegd() {
        let playState = getState().getModel().getPlayState();
        let comp = document.getElementById(this.componentId) as EboButtonBar;
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
        let comp = document.getElementById(this.componentId) as EboButtonBar;
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
            } else {
                comp.setAttribute("text", trackModel.track.track.name);
                comp.setAttribute("allow_play", "true");
                comp.setAttribute("allow_prev", "false");
                comp.setAttribute("allow_next", "false");
                comp.setAttribute("image_url", trackModel.album.imageUrl);
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
        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.setAttribute("show_info", show_info.toString());
    }

    private async playOrStopOrPause(event: EboplayerEvents) {
        switch(event) {
            case EboplayerEvents.playPressed:
                await getState().getController().mopidyProxy.sendPlay();
                break;
            case EboplayerEvents.stopPressed:
                await getState().getController().mopidyProxy.sendStop();
                break;
            case EboplayerEvents.pausePressed:
                await getState().getController().mopidyProxy.sendPause();
                break;
        }
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
        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.setAttribute("text", lines.active_titles.join("\n"));
    }
}
