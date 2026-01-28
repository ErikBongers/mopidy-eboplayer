import getState from "../playerState";
import {View} from "./view";
import {EboPlayerDataType, MessageType} from "../modelTypes";

export class HeaderView extends View {
    bind() {
        getState().getModel().addEboEventListener("messageChanged.eboplayer", () => {
            this.onMessageChanged();
        });
    }

    private onMessageChanged() {
        let msg = getState().getModel().getCurrentMessage();
        let headerSpan = document.getElementById("contentHeadline") as HTMLSpanElement;
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