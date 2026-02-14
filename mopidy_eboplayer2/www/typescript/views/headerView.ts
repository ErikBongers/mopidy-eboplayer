import {View} from "./view";
import {EboPlayerDataType, MessageType} from "../modelTypes";

export class HeaderView extends View {
    bind() {
        this.state.getModel().addEboEventListener("messageChanged.eboplayer", () => {
            this.onMessageChanged();
        });
    }

    private onMessageChanged() {
        let msg = this.state.getModel().getCurrentMessage();
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
}