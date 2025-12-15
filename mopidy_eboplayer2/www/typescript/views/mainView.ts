import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import EboBrowseComp from "../components/eboBrowseComp";

import {EboplayerEvents, ItemType, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";

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
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
            this.onSelectedTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.viewChanged, () => {
            this.setCurrentView();
        });
        getState().getModel().addEventListener(EboplayerEvents.albumToViewChanged, () => {
            this.onAlbumToViewChanged();
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
        switch (browseBtn.dataset.goto) {
            case Views.Browse:
                getState().getController().setView(Views.Browse);
                break;
            case Views.NowPlaying:
                getState().getController().setView(Views.NowPlaying);
                break;
            case Views.Album:
                getState().getController().setView(Views.Album);
                break;
        }
    }

    setCurrentView() {
        let view = getState().getModel().getView();
        this.showView(view);
    }

    private showView(view: Views) {
        let browseBtn = document.getElementById("headerSearchBtn");
        let layout = document.getElementById("layout");
        layout.classList.remove("browse", "bigAlbum", "bigTrack");
        switch (view) {
            case Views.Browse:
                layout.classList.add("browse");
                location.hash = Views.Browse;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
                let browseComp = document.getElementById("browseView") as EboBrowseComp;
                browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter(); //todo: already set in controller?
                browseComp.setFocusAndSelect();
                break;
            case Views.NowPlaying:
                layout.classList.add("bigTrack");
                location.hash = ""; //default = now playing
                browseBtn.dataset.goto = Views.Browse;
                browseBtn.title = "Search";
                break;
            case Views.Album:
                layout.classList.add("bigAlbum");
                location.hash = Views.Album;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
        }
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines];
    }

    private onAlbumClick() {
        this.showView(Views.Album);
    }

    private async onSelectedTrackChanged() {
        let uri = getState().getModel().getSelectedTrack();
        getState().getController().lookupTrackCached(uri)
            .then(async track => {
                let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                if(track.type == ItemType.File)
                    albumComp.albumInfo = await getState().getController().getExpandedAlbumModel(track.track.album.uri);
                else
                    albumComp.albumInfo = undefined;
            });
    }

    private async onAlbumToViewChanged() {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.albumInfo = await getState().getController().getExpandedAlbumModel(getState().getModel().getAlbumToView());
    }
}

