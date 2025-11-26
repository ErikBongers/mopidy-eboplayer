import getState from "../playerState";
import {EboplayerEvents, PlayState, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {VolumeView} from "./volumeView";

export class ButtonBarView extends View {
    private containerId: string;
    private volumeView: VolumeView;

    constructor(containerId: string) {
        super();
        this.containerId = containerId;
        this.volumeView = new VolumeView(`${this.containerId}.volumeslider`);
        this.addChildren(this.volumeView);
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

        document.getElementById(`${this.containerId}.btnPlay`).onclick = () => {
            this.playOrStopOrPause().then(r => {});
        };
    }

    private async onPlaybackStateChangegd() {
        let state = getState().getModel().getPlayState();
        switch (state) {
            case PlayState.paused:
            case PlayState.stopped:
                this.setPlayButton('Play', ['fa-pause', 'fa-stop'], 'fa-play');
                document.getElementById(this.containerId).parentElement.classList.remove("playing");
                break;
            case PlayState.playing:
                let track = await getState().getController().getCurrertTrackInfoCached();
                if(track.type == TrackType.Stream)
                    this.setPlayButton('Pause', ['fa-play'], 'fa-stop');
                else
                    this.setPlayButton('Pause', ['fa-play'], 'fa-pause');
                document.getElementById(this.containerId).parentElement.classList.add("playing");
                break;
        }
    }

    private async onCurrentTrackChanged() {
        let currentTrack = await getState().getController().getCurrertTrackInfoCached();
        if(currentTrack.type == TrackType.Stream) {
            View.getSubId(this.containerId, "btnNext").style.opacity = "0.5";
            View.getSubId(this.containerId, "btnPrev").style.opacity = "0.5";
        }
        this.showHideSelectedImage();
    }

    private async onSelectedTrackChanged() {
        this.showHideSelectedImage();
    }

    private showHideSelectedImage() {
        let currentTrack = getState().getModel().getCurrentTrack();
        let selectedTrack = getState().getModel().getSelectedTrack();
        let img = document.querySelector("#buttonBarWrapper img") as HTMLElement;
        if (currentTrack == selectedTrack || !selectedTrack)
            img.style.visibility = "hidden";
        else
            img.style.visibility = "visible";
    }

    private async playOrStopOrPause() {
        let playState = getState().getModel().getPlayState();
        if (playState == PlayState.playing) {
            let currentTrack = await getState().getController().getCurrertTrackInfoCached();
            if(currentTrack.type == TrackType.Stream)
                return getState().getController().mopidyProxy.sendStop();
            else
                return getState().getController().mopidyProxy.sendPause();
        } else {
                return getState().getController().mopidyProxy.sendPlay();
        }
    }

    private setPlayButton(title: string, removeClasses: string[], addClass: string) {
        let btnPlayIcon = View.getSubId(this.containerId, 'btnPlay').querySelector('i');
        btnPlayIcon.classList.remove(...removeClasses);
        btnPlayIcon.classList.add(addClass);
        btnPlayIcon.setAttribute('title', title);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.PlayState];
    }
}

function toggleButton(enabled: boolean) {
    View.getSubId(this.containerId, "btnPrev").style.opacity =  enabled ? "1" : "0.3";
 }