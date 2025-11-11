import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {console_yellow} from "../gui";
import {EboBrowseView} from "../components/eboBrowseView";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onSearchButtonClick();
        });
    }

    private onSearchButtonClick() {
        let browseBtn = document.getElementById("headerSearchBtn");
        let layout = document.getElementById("layout");
        if (browseBtn.title == "Search") {
            browseBtn.title = "Now playing";
            layout.classList.add("browse");
            layout.classList.remove("bigTrack");
            (document.getElementById("browseView") as EboBrowseView).setFocusAndSelect();
        } else {
            browseBtn.title = "Search";
            layout.classList.remove("browse");
            layout.classList.add("bigTrack");
        }
        // > move other views in here.
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}