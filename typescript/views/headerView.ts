import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";

export class HeaderView extends View {
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
            this.onMessageChangegd();
        });
    }

    private onMessageChangegd() {
        let msg = getState().getModel().getCurrentMessage();
        let headerSpan = document.getElementById("contentHeadline");
        headerSpan.innerText = msg.message;
        if (msg.type == MessageType.Error) {
            headerSpan.classList.add("warning"); //todo: implement all MessageTypes
        } else {
            headerSpan.classList.remove("warning", "error");
        }
    }

    getRequiredData(): EboPlayerDataType[] {
        return [];
    }
}