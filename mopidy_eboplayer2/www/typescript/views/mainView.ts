import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";

import {AllUris, ExpandedAlbumModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, ItemType, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {console_yellow} from "../global";
import {EboplayerEvents, BreadcrumbArgs, BrowseResultArgs, UriArgs, EboplayerEvent, GuiSourceArgs} from "../events";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEventListener("browseFilterChanged", () => {
            getState().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
        });
        browseComp.addEventListener(EboplayerEvents.breadCrumbClick, (ev: CustomEvent<BreadcrumbArgs>) => {
            this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        browseComp.addEventListener(EboplayerEvents.browseResultClick, (ev: CustomEvent<BrowseResultArgs>) => {
            this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        browseComp.addEventListener(EboplayerEvents.browseResultDblClick, async (ev: CustomEvent<UriArgs>) => {
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
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, async () => {
            await this.onSelectedTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.trackListChanged, async () => {
            await this.onTrackListChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.viewChanged, () => {
            this.setCurrentView();
        });
        getState().getModel().addEventListener(EboplayerEvents.albumToViewChanged, async () => {
            await this.onAlbumToViewChanged();
        });
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEventListener("albumClick", async () => {
            this.onAlbumClick();
        });
        document.body.addEventListener(EboplayerEvents.playItemListClicked, async (ev: EboplayerEvent<GuiSourceArgs>) => {
            await this.onPlayItemListClick(ev);
        });
        document.body.addEventListener(EboplayerEvents.addItemListClicked, async (ev: EboplayerEvent<GuiSourceArgs>) => {
            await this.onAddItemListClick(ev);
        });
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.addEventListener(EboplayerEvents.playTrackClicked, async (ev: CustomEvent<UriArgs>) => {
            await this.onPlayTrackClicked(ev.detail.uri);
        });
        albumComp.addEventListener(EboplayerEvents.addTrackClicked, async (ev: CustomEvent<UriArgs>) => {
            await this.onAddTrackClicked(ev.detail.uri);
        });
    }

    private onRefsFiltered() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? { refs: [], availableRefTypes: new Set()};
        browseComp.renderResults();
    }

    private onBreadCrumbsChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
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
                browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? {refs: [], availableRefTypes: new Set()};
                browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
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

    private async onTrackListChanged() {
        if(!getState().getModel().getCurrentTrack()) {
            let trackList = getState().getModel().getTrackList();
            if(trackList.length > 0)
                await getState().getController().setCurrentTrackAndFetchDetails(trackList[0]);
        }
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
        albumComp.setAttribute("name", albumModel.meta?.albumTitle?? albumModel.album.albumInfo.name);
        albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
    }

    private async onPlayItemListClick(ev: EboplayerEvent<GuiSourceArgs>) {
        if(ev.detail.source == "albumView") {
            let model = getState().getModel();
            let albumUri = model.getAlbumToView();
            let album = await getState().getController().lookupAlbumCached(albumUri);
            await getState().getPlayer().clearAndPlay([album.albumInfo.uri]);
            return;
        }
        if(ev.detail.source == "browseView") {
            await getState().getPlayer().clear();
            await getState().getController().addCurrentSearchResultsToPlayer();
            await getState().getPlayer().play();
        }
    }

    private async onAddItemListClick(ev: EboplayerEvent<GuiSourceArgs>) {
        if(ev.detail.source == "albumView") {
            let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
            await getState().getPlayer().add([albumComp.dataset.albumUri]);
        }
        if(ev.detail.source == "browseView") {
            await getState().getController().addCurrentSearchResultsToPlayer();
        }
    }

    private async onBrowseResultDblClick(uri: string) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private onBrowseResultClick(label: string, uri: AllUris, type: string) {
        getState().getController().diveIntoBrowseResult(label, uri, type, true);
    }

    private onBreadcrumbClick(breadcrumbId: number) {
        getState().getController().resetToBreadCrumb(breadcrumbId);
    }

    private async onPlayTrackClicked(uri: string) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private async onAddTrackClicked(uri: string) {
        let trackModel = await getState().getController().getExpandedTrackModel(uri);
        if(!isInstanceOfExpandedStreamModel(trackModel)) {
            let res = await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri);
            let text = await res.text();
            console_yellow(text);
        }
    }
}

