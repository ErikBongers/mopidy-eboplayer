import getState from "../playerState";
import {EboplayerEvents} from "../model";
import {EboPlayerDataType, View} from "./view";
import {inverseQuadratic100} from "../controller";

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
        let visualVolume = inverseQuadratic100(volume); //todo: hide this in Controller?
        slider.value = Math.floor(visualVolume).toString();
    }

    async sendVolume(value: number) {
        await getState().getController().sendVolume(value);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.Volume];
    }
}
