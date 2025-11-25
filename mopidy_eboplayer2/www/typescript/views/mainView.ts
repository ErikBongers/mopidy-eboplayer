import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {console_yellow} from "../gui";
import {EboBrowseComp} from "../components/eboBrowseComp";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onSearchButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEventListener("browseFilterChanged", (ev) => {
            getState().getController().saveBrowseFilters(browseComp.browseFilter);
        });
    }

    private onSearchButtonClick() {
        let browseBtn = document.getElementById("headerSearchBtn");
        let layout = document.getElementById("layout");
        if (browseBtn.title == "Search") {
            browseBtn.title = "Now playing";
            layout.classList.add("browse");
            layout.classList.remove("bigTrack");
            let browseComp = document.getElementById("browseView") as EboBrowseComp;
            browseComp.browseFilter = getState().getController().getBrowseFilters();
            browseComp.setFocusAndSelect();
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