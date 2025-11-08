import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {console_yellow} from "../gui";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            console_yellow("SEARRC");
            let browseBtn = document.getElementById("headerSearchBtn");
            let layout = document.getElementById("layout");
            if(browseBtn.title == "Search") {
                browseBtn.title = "Now playing";
                layout.classList.add("browse");
            } else {
                browseBtn.title = "Search";
                layout.classList.remove("browse");
            }
            // > move other views in here.
        });
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}