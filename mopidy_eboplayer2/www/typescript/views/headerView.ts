import {View} from "./view";
import {MessageType} from "../modelTypes";

export class HeaderView extends View {
    bind() {
        this.state.getModel().addEboEventListener("messageChanged.eboplayer", () => {
            this.onMessageChanged();
        });
        this.state.getModel().addEboEventListener("tempMessageChanged.eboplayer", () => {
            this.onMessageChanged();
        });
    }

    private onMessageChanged() {
        let msg = this.state.getModel().getCurrentMessage();
        let tempMsg = this.state.getModel().getTempMessage();
        if(tempMsg.type != MessageType.None)
            msg = tempMsg;
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