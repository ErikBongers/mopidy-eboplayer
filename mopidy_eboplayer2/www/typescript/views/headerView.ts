import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";

export class HeaderView extends View {
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
            this.onMessageChanged();
        });
    }

    private onMessageChanged() {
        let msg = getState().getModel().getCurrentMessage();
        let headerSpan = document.getElementById("contentHeadline");
        headerSpan.innerText = msg.message;
        switch (msg.type) {
            case MessageType.Error:
                headerSpan.classList.add("warning");
                break;
            default:
                headerSpan.classList.remove("warning", "error");
                break;
        }
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}