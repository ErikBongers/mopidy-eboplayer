import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";

import {EboplayerEvents, ExpandedAlbumModel, ExpandedStreamModel, ItemType, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp, EventBreadcrumbArgs, EventBrowseResultArgs, EventUriArgs} from "../components/eboBrowseComp";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEventListener("browseFilterChanged", (ev) => {
            getState().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
        });
        browseComp.addEventListener(EboplayerEvents.breadCrumbClick, (ev: CustomEvent<EventBreadcrumbArgs>) => {
            this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        browseComp.addEventListener(EboplayerEvents.browseResultClick, (ev: CustomEvent<EventBrowseResultArgs>) => {
            this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        browseComp.addEventListener(EboplayerEvents.browseResultDblClick, async (ev: CustomEvent<EventUriArgs>) => {
            await this.onBrowseResultDblClick(ev.detail.uri);
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
        getState().getModel().addEventListener(EboplayerEvents.albumToViewChanged, async () => {
            await this.onAlbumToViewChanged();
        });
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEventListener("albumClick", async (e) => {
            this.onAlbumClick();
        });
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.addEventListener(EboplayerEvents.playAlbumClicked, () => {
            this.onAlbumPlayClick();
        });
        albumComp.addEventListener(EboplayerEvents.addAlbumClicked, () => {
            this.onAlbumAddClick();
        });
    }

    private onRefsFiltered() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? [];
        browseComp.renderResults();
    }

    private onBreadCrumbsChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs()?.list() ?? [];
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
        let prevViewClass = [...layout.classList].filter(c => ["browse", "bigAlbum", "bigTrack"].includes(c))[0];
        layout.classList.remove("browse", "bigAlbum", "bigTrack");
        switch (view) {
            case Views.Browse:
                layout.classList.add("browse");
                location.hash = Views.Browse;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
                let browseComp = document.getElementById("browseView") as EboBrowseComp;
                browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter(); //todo: already set in controller?
                browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? [];
                browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs()?.list() ?? [];
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
                if(prevViewClass == "browse") { //Provide some navigation back.
                    browseBtn.dataset.goto = Views.Browse;
                    browseBtn.title = "Search";
                } else {
                    browseBtn.dataset.goto = Views.NowPlaying;
                    browseBtn.title = "Now playing";
                }
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
                if(track.type == ItemType.File) {
                    let albumModel = await getState().getController().getExpandedAlbumModel(track.track.album.uri);
                    this.setAlbumComponentData(albumModel);
                }
                else {
                    let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                    let streamModel = await getState().getController().getExpandedTrackModel(track.track.uri) as ExpandedStreamModel;
                    albumComp.albumInfo = undefined;
                    albumComp.streamInfo = streamModel;
                    albumComp.setAttribute("img", streamModel.stream.imageUrl);
                    albumComp.setAttribute("name", streamModel.stream.name);
                }
            });
    }

    private async onAlbumToViewChanged() {
        let albumModel = await getState().getController().getExpandedAlbumModel(getState().getModel().getAlbumToView());
        this.setAlbumComponentData(albumModel);
    }

    private setAlbumComponentData(albumModel: ExpandedAlbumModel) {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.albumInfo = albumModel;
        albumComp.streamInfo = undefined;
        albumComp.setAttribute("img", albumModel.album.imageUrl);
        albumComp.setAttribute("name", albumModel.album.albumInfo.name);
        albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
    }

    private onAlbumPlayClick() {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        getState().getController().playAlbum(albumComp.dataset.albumUri);

    }

    private onAlbumAddClick() {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        getState().getController().addAlbum(albumComp.dataset.albumUri);
    }

    private async onBrowseResultDblClick(uri: string) {
        await getState().getController().clearListAndPlay(uri);
    }

    private onBrowseResultClick(label: string, uri: string, type: string) {
        getState().getController().diveIntoBrowseResult(label, uri, type, true);
    }

    private onBreadcrumbClick(breadcrumbId: number) {
        getState().getController().resetToBreadCrumb(breadcrumbId);
    }
}

