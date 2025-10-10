import getState from "../playerState";
import {EboplayerEvents, PlayState, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {setPlayState} from "../controls";
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

        document.getElementById(`${this.containerId}.btnPlay`).onclick = () => {
            this.playOrStopOrPause().then(r => {});
        };
    }

    private onPlaybackStateChangegd() {
        let state = getState().getModel().getPlayState();
        switch (state) {
            case PlayState.paused:
            case PlayState.stopped:
                this.setPlayButton('Play', ['fa-pause', 'fa-stop'], 'fa-play');
                break;
            case PlayState.playing:
                if(getState().getModel().getActiveTrack().type == TrackType.Stream)
                    this.setPlayButton('Pause', ['fa-play'], 'fa-stop');
                else
                    this.setPlayButton('Pause', ['fa-play'], 'fa-pause');
                break;
        }
    }

    private onCurrentTrackChanged() {
        let currentTrack = getState().getModel().getActiveTrack();
        if(currentTrack.type == TrackType.Stream) {
            View.getSubId(this.containerId, "btnNext").style.display = 'none';
            View.getSubId(this.containerId, "btnPrev").style.display = 'none';
        }
    }

    private async playOrStopOrPause() {
        let playState = getState().getModel().getPlayState();
        if (playState == PlayState.playing) {
            if(getState().getModel().getActiveTrack().type == TrackType.Stream)
                return getState().commands.core.playback.stop();
            else
                return getState().commands.core.playback.pause();
        } else {
                return getState().commands.core.playback.play();
            }
        }

    private setPlayButton(title: string, removeClasses: string[], addClass: string) {
        let btnPlayIcon = View.getSubId(this.containerId, 'btnPlay').querySelector('i');
        btnPlayIcon.classList.remove(...removeClasses);
        btnPlayIcon.classList.add(addClass);
        btnPlayIcon.setAttribute('title', title);
    }

    getRequiredData(): EboPlayerDataType[] {
        return [EboPlayerDataType.PlayState];
    }

}