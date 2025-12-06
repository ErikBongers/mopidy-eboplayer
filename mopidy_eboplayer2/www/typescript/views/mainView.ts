import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import EboBrowseComp from "../components/eboBrowseComp";
import {console_yellow} from "../gui";

import {EboplayerEvents} from "../modelTypes";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEventListener("browseFilterChanged", (ev) => {
            getState().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
        });
        getState().getModel().addEventListener(EboplayerEvents.refsFiltered, () => {
            this.onRefsFiltered();
        });
        getState().getModel().addEventListener(EboplayerEvents.breadCrumbsChanged, () => {
            this.onBreadCrumbsChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.browseFilterChanged, () => {
            this.onBrowseFilterChanged();
        });

    }

    private onRefsFiltered() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.renderResults();
    }

    private onBreadCrumbsChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.renderBreadCrumbs();
    }

    private onBrowseFilterChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter();
    }

    private onBrowseButtonClick() {
        let browseBtn = document.getElementById("headerSearchBtn");
        if(browseBtn.dataset.view == Views.Browse) {
            this.showView(Views.NowPlaying);
        } else {
            this.showView(Views.Browse);
        }
    }

    showView(view: Views) {
        let browseBtn = document.getElementById("headerSearchBtn");
        let layout = document.getElementById("layout");
        switch (view) {
            case Views.Browse:
                browseBtn.dataset.view = Views.Browse;
                browseBtn.title = "Now playing";
                layout.classList.add("browse");
                layout.classList.remove("bigTrack");
                location.hash = Views.Browse;
                let browseComp = document.getElementById("browseView") as EboBrowseComp;
                browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter();
                browseComp.setFocusAndSelect();
                break;
            case Views.NowPlaying:
                browseBtn.dataset.view = Views.NowPlaying;
                browseBtn.title = "Search";
                layout.classList.remove("browse");
                layout.classList.add("bigTrack");
                location.hash = ""; //default = now playing
                break;
        }
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}

export enum Views {
    NowPlaying = "#NowPlaying",
    Browse = "#Browse"
}