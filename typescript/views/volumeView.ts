import getState from "../playerState";
import {EboplayerEvents} from "../model";
import {EboPlayerDataType, View} from "./view";

export class VolumeView extends View {
    private readonly sliderId: string;
    private isSourceOfChange: boolean = false;

    constructor(sliderId: string) {
        super();
        this.sliderId = sliderId;
    }

    getSlider = () => (document.getElementById(this.sliderId) as HTMLInputElement);

    bind() {
        getState().getModel().addEventListener(EboplayerEvents.volumeChanged, () => {
            this.onVolumeChanged();
        });

        let slider = this.getSlider();
        slider.oninput = (ev) => {
            this.sendVolume(parseInt((ev.target as HTMLInputElement).value)).then();
        };
        slider.onmousedown = slider.ontouchstart = () => { this.isSourceOfChange = true;};
        slider.onmouseup = slider.ontouchend = () => { this.isSourceOfChange = false;};
    }

    private onVolumeChanged() {
        if(this.isSourceOfChange) {
            return;
        }
        let volume = getState().getModel().getVolume();
        let slider = document.getElementById(this.sliderId) as HTMLInputElement;
        let visualVolume = inverseQuadratic100(volume);
        slider.value = Math.floor(visualVolume).toString();
    }

    async sendVolume(value: number) {
        await getState().commands.core.mixer.setVolume(Math.floor(quadratic100(value)));
    }

    onOnline(): void {
        getState().commands.core.mixer.getVolume().then((data) => {
            console.log("volume data: ");
            console.log(data);
        });

    }

    getRequiredData(): EboPlayerDataType[] {
        return [EboPlayerDataType.Volume];
    }
}

function quadratic100(x:number) { return (x*x)/100;}
function inverseQuadratic100(y:number) { return Math.floor(Math.sqrt(y*100));}
// noinspection JSUnusedLocalSymbols
function cubic100(x:number) { return (x*x*x)/10000;}
