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
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEventListener("albumClick", async (e) => {
            this.onAlbumClick();
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
        layout.classList.remove("browse", "bigAlbum", "bigTrack");
        switch (view) {
            case Views.Browse:
                browseBtn.dataset.view = Views.Browse;
                layout.classList.add("browse");
                location.hash = Views.Browse;
                browseBtn.title = "Now playing";
                let browseComp = document.getElementById("browseView") as EboBrowseComp;
                browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter(); //todo: already set in controller?
                browseComp.setFocusAndSelect();
                break;
            case Views.NowPlaying:
                browseBtn.dataset.view = Views.NowPlaying;
                layout.classList.add("bigTrack");
                location.hash = ""; //default = now playing
                browseBtn.title = "Search";
                break;
                case Views.Album:
                    browseBtn.dataset.view = Views.Album;
                    layout.classList.add("bigAlbum");
                    location.hash = Views.Album;
                    browseBtn.title = "Search";
        }
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }

    private onAlbumClick() {
        this.showView(Views.Album);
    }
}

export enum Views {
    NowPlaying = "#NowPlaying",
    Browse = "#Browse",
    Album = "#Album"
}