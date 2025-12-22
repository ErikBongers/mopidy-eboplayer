import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {MessageType} from "../modelTypes";
import {EboplayerEvents} from "../events";

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