import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {AlbumUri, AllUris, ExpandedAlbumModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, TrackUri, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {console_yellow} from "../global";
import {addEboEventListener, GuiSourceArgs} from "../events";

export class MainView extends View {
    bind() {
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEboEventListener("browseFilterChanged [eboplayer]", () => {
            getState().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
        });
        browseComp.addEboEventListener("breadCrumbClick [eboplayer]", (ev) => {
            this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        browseComp.addEboEventListener("browseResultClick [eboplayer]", (ev) => {
            this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        browseComp.addEboEventListener("browseResultDblClick [eboplayer]", async (ev) => {
            await this.onBrowseResultDblClick(ev.detail.uri as AllUris);
        });
        getState().getModel().addEboEventListener("refsFiltered [eboplayer]", () => {
            this.onRefsFiltered();
        });
        getState().getModel().addEboEventListener("breadCrumbsChanged [eboplayer]", () => {
            this.onBreadCrumbsChanged();
        });
        getState().getModel().addEboEventListener("browseFilterChanged [eboplayer]", () => {
            this.onBrowseFilterChanged();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged [eboplayer]", async () => {
            await this.onSelectedTrackChanged();
        });
        getState().getModel().addEboEventListener("trackListChanged [eboplayer]", async () => {
            await this.onTrackListChanged();
        });
        getState().getModel().addEboEventListener("viewChanged [eboplayer]", () => {
            this.setCurrentView();
        });
        getState().getModel().addEboEventListener("albumToViewChanged [eboplayer]", async () => {
            await this.onAlbumToViewChanged();
        });
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEventListener("albumClick", async () => {
            this.onAlbumClick();
        });
        addEboEventListener(document.body, "playItemListClicked [eboplayer]", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        addEboEventListener(document.body, "addItemListClicked [eboplayer]", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        addEboEventListener(document.body, "replaceItemListClicked [eboplayer]", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.addEboEventListener("playTrackClicked [eboplayer]", async (ev) => {
            await this.onPlayTrackClicked(ev.detail.uri);
        });
        albumComp.addEboEventListener("addTrackClicked [eboplayer]", async (ev) => {
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
        return [EboPlayerDataType.TrackList];
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
                if(track.type == "file") {
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

    private async onPlayItemListClick(detail: GuiSourceArgs) {
        if(detail.source == "albumView") {
            let model = getState().getModel();
            let albumUri = model.getAlbumToView();
            let album = (await getState().getController().lookupAlbumsCached([albumUri]))[0];
            await getState().getPlayer().clearAndPlay([album.albumInfo.uri]);
            return;
        }
        if(detail.source == "browseView") {
            await getState().getPlayer().clear();
            await getState().getController().addCurrentSearchResultsToPlayer();
            await getState().getPlayer().play();
        }
    }

    private async onAddItemListClick(detail: GuiSourceArgs) {
        if(detail.source == "albumView") {
            let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
            await getState().getPlayer().add([albumComp.dataset.albumUri as AlbumUri]);
        }
        if(detail.source == "browseView") {
            await getState().getController().addCurrentSearchResultsToPlayer();
        }
    }

    private async onReplaceItemListClick(detail: GuiSourceArgs) {
        await getState().getPlayer().clear();
        await this.onAddItemListClick(detail);
    }

    private async onBrowseResultDblClick(uri: AllUris) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private onBrowseResultClick(label: string, uri: AllUris, type: string) {
        getState().getController().diveIntoBrowseResult(label, uri, type, true);
    }

    private onBreadcrumbClick(breadcrumbId: number) {
        getState().getController().resetToBreadCrumb(breadcrumbId);
    }

    private async onPlayTrackClicked(uri: TrackUri) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private async onAddTrackClicked(uri: TrackUri) {
        let trackModel = await getState().getController().getExpandedTrackModel(uri);
        if(!isInstanceOfExpandedStreamModel(trackModel)) {
            let res = await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri);
            let text = await res.text();
            console_yellow(text);
        }
    }
}

