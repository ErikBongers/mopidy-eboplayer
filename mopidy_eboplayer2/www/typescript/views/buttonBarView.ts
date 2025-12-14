import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {EboplayerEvents, PlayState, Views} from "../modelTypes";
import {MainView} from "./mainView";
import {EboButtonBar} from "../components/eboButtonBarComp";
import {console_yellow} from "../global";

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

        //todo: capture img click in comp.
        // document.getElementById("buttonBarImg").onclick = () => {
        //     this.onButtonBarImgClicked();
        // }

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
        getState().getModel().addEventListener(EboplayerEvents.volumeChanged, () => {
            this.onVolumeChanged();
        });
        comp.addEventListener(EboplayerEvents.changingVolume, async (ev) => {
            console_yellow(`buttonBarrView.event:changingVolume:`);
            console.log(ev);
            let value = parseInt((ev as CustomEvent).detail.volume);
            console_yellow(`value=${value}`);
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

    private onPlaybackStateChangegd() {
        let playState = getState().getModel().getPlayState();
        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.setAttribute("playing", (playState == PlayState.playing).toString());
    }

    private async onCurrentTrackChanged() {
        let currentTrack = await getState().getController().getCurrertTrackInfoCached();
        let comp = document.getElementById(this.componentId) as EboButtonBar;
        comp.track = currentTrack;
        this.showHideInfo();
    }

    private async onSelectedTrackChanged() {
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
        this.parent.showView(Views.NowPlaying); //todo: this call of function in parent is ugly.
    }
}
