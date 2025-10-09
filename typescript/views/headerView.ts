import getState from "../playerState";
import {ConnectionState, EboplayerEvents, MessageType} from "../model";

export function bindView() {
    getState().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
        let msg = getState().getModel().getCurrentMessage();
        let headerSpan = document.getElementById("contentHeadline");
        headerSpan.innerText = msg.message;
        if (msg.type == MessageType.Error) {
            headerSpan.classList.add("warning"); //todo: implement all MessageTypes
        } else  {
            headerSpan.classList.remove("warning", "error");
        }
    });
}