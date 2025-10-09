import getState from "../playerState";
import {ConnectionState, EboplayerEvents, MessageType} from "../model";

export abstract class View {
    abstract bind(): void;
}

 export class HeaderView extends View {
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.messageChanged, () => {
            this.onMesssageChangegd();
        });
    }

    private onMesssageChangegd() {
        let msg = getState().getModel().getCurrentMessage();
        let headerSpan = document.getElementById("contentHeadline");
        headerSpan.innerText = msg.message;
        if (msg.type == MessageType.Error) {
            headerSpan.classList.add("warning"); //todo: implement all MessageTypes
        } else {
            headerSpan.classList.remove("warning", "error");
        }
    }sdfsdfsdf
}