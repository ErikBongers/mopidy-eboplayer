import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {console_yellow} from "../gui";

import {EboplayerEvents} from "../modelTypes";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onSearchButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEventListener("browseFilterChanged", (ev) => {
            getState().getController().setSaveAndApplyFilter(browseComp.browseFilter);
        });
        getState().getModel().addEventListener(EboplayerEvents.refsLoaded, () => {
            this.onRefsLoaded();
        });
        getState().getModel().addEventListener(EboplayerEvents.refsFiltered, () => {
            this.onRefsFiltered();
        });
    }

    private onRefsLoaded() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.refsLoaded = true;
    }

    private onRefsFiltered() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.renderResults();
    }

    private onSearchButtonClick() {
        let browseBtn = document.getElementById("headerSearchBtn");
        let layout = document.getElementById("layout");
        if (browseBtn.title == "Search") {
            browseBtn.title = "Now playing";
            layout.classList.add("browse");
            layout.classList.remove("bigTrack");
            let browseComp = document.getElementById("browseView") as EboBrowseComp;
            browseComp.browseFilter = getState().getModel().getBrowseFilter();
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