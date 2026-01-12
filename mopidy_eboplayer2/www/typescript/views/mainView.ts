import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {AlbumUri, AllUris, ExpandedAlbumModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, PlaylistUri, TrackUri, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {console_yellow} from "../global";
import {addEboEventListener, GuiSourceArgs, SaveUriArgs} from "../events";
import {EboDialog} from "../components/eboDialog";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {RefType} from "../refs";
import {EboBigTrackComp} from "../components/eboBigTrackComp";

export class MainView extends View {
    private onDialogOkClickedCallback: (dialog: EboDialog) => boolean | Promise<boolean> = () => true;
    private dialog: EboDialog;

    constructor(dialog: EboDialog) {
        super();
        this.dialog = dialog;
        this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
            console_yellow("dialogOkClicked.eboplayer");
            let innnerDialog = ev.detail.dialog;
            if(this.onDialogOkClickedCallback(innnerDialog))
                innnerDialog.close();
        });
    }

    bind() {
        // @ts-ignore
        document.getElementById("headerSearchBtn").addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.addEboEventListener("guiBrowseFilterChanged.eboplayer", () => {
            this.onGuiBrowseFilterChanged(browseComp);
        });
        browseComp.addEboEventListener("breadCrumbClick.eboplayer", (ev) => {
            this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        browseComp.addEboEventListener("browseResultClick.eboplayer", (ev) => {
            this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        browseComp.addEboEventListener("browseResultDblClick.eboplayer", async (ev) => {
            await this.onBrowseResultDblClick(ev.detail.uri as AllUris);
        });
        getState().getModel().addEboEventListener("genreDefsChanged.eboplayer", () => {
            this.onGenreDefsChanged();
        });
        getState().getModel().addEboEventListener("refsFiltered.eboplayer", () => {
            this.onRefsFiltered();
        });
        getState().getModel().addEboEventListener("breadCrumbsChanged.eboplayer", () => {
            this.onBreadCrumbsChanged();
        });
        getState().getModel().addEboEventListener("modelBrowseFilterChanged.eboplayer", () => {
            this.onModelBrowseFilterChanged();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        getState().getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });
        getState().getModel().addEboEventListener("viewChanged.eboplayer", () => {
            this.setCurrentView();
        });
        getState().getModel().addEboEventListener("albumToViewChanged.eboplayer", async () => {
            await this.onAlbumToViewChanged();
        });
        let currentTrackBigViewComp = document.getElementById("currentTrackBigView") as EboBrowseComp;
        currentTrackBigViewComp.addEboEventListener("bigTrackAlbumImgClicked.eboplayer", async () => {
            await this.onBigTrackAlbumImgClick();
        });
        currentTrackBigViewComp.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
            currentTrackBigViewComp.setAttribute("show_back", "false");
        });
        addEboEventListener(document.body, "playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        addEboEventListener(document.body, "addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        addEboEventListener(document.body, "replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.addEboEventListener("playTrackClicked.eboplayer", async (ev) => {
            await this.onPlayTrackClicked(ev.detail.uri);
        });
        albumComp.addEboEventListener("addTrackClicked.eboplayer", async (ev) => {
            await this.onAddTrackClicked(ev.detail.uri);
        });
        albumComp.addEboEventListener("saveClicked.eboplayer", async (ev) => {
            await this.onSaveClicked(ev.detail);
        });
    }

    private onGuiBrowseFilterChanged(browseComp: EboBrowseComp) {
        getState().getController().setAndSaveBrowseFilter(browseComp.browseFilter);
    }

    private onRefsFiltered() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? { refs: [], availableRefTypes: new Set()};
        browseComp.renderResults();
        browseComp.btn_states = this.getListButtonStates(getState().getModel().getView());
    }

    private getListButtonStates(currentView: Views) {
        let states: ListButtonStates = ListButtonState_AllHidden();
        if(currentView == Views.Browse) {
            return this.setBrowseViewListButtonStates(states);
        }
        if(currentView == Views.Album) {
            states = this.showHideTrackAndAlbumButtons(states, "show");
            states.new_playlist = "hide";
            return states;
        }
        return states;
    }

    private setBrowseViewListButtonStates(states: ListButtonStates): ListButtonStates {
        let searchResults = getState().getModel().getCurrentSearchResults();
        let browseFilter = getState().getModel().getCurrentBrowseFilter();

        //list ref types state 1
        if (searchResults.refs.length == 0) {
            this.showHideTrackAndAlbumButtons(states, "hide");
            states.new_playlist = "hide";
            return states;
        }

        //list ref types state 2
        if(browseFilter.searchText == "") {
            this.showHideTrackAndAlbumButtons(states, "show");
            states.new_playlist = "hide";
            return states;
        }

        //list ref types state 3
        let onlyTracksAndAlbums = [...searchResults.availableRefTypes].filter(t => t == "track" || t == "album").length == searchResults.availableRefTypes.size;
        if (onlyTracksAndAlbums) {
            this.showHideTrackAndAlbumButtons(states, "show");
            states.new_playlist = "show";
            return states;
        }

        //list ref types state 4
        let onlyPlaylists = [...searchResults.availableRefTypes].filter(t => t == "playlist").length == searchResults.availableRefTypes.size;
        if (onlyPlaylists) {
            states.new_playlist = "show";
            this.showHideTrackAndAlbumButtons(states, "hide");
            return states;
        }

        //list ref types state 5
        this.showHideTrackAndAlbumButtons(states, "hide");
        states.new_playlist = "show";
        return states;
    }

    private showHideTrackAndAlbumButtons(states: ListButtonStates, state: ListButtonState): ListButtonStates {
        states.add = state;
        states.replace = state;
        states.play = state;
        states.save = state;
        states.edit = state;
        return states;
    }

    private onBreadCrumbsChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
    }

    private onModelBrowseFilterChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter();
    }

    private onBrowseButtonClick() {
        let browseBtn = document.getElementById("headerSearchBtn") as HTMLButtonElement;
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
        let browseBtn = document.getElementById("headerSearchBtn") as HTMLButtonElement;
        let layout = document.getElementById("layout") as HTMLElement;
        let prevViewClass = [...layout.classList].filter(c => ["browse", "bigAlbum", "bigTrack"].includes(c))[0];
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        layout.classList.remove("browse", "bigAlbum", "bigTrack");
        switch (view) {
            case Views.Browse:
                layout.classList.add("browse");
                location.hash = Views.Browse;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
                browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter(); //todo: already set in controller?
                browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? {refs: [], availableRefTypes: new Set()};
                browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
                browseComp.setFocusAndSelect();
                browseComp.btn_states = this.getListButtonStates(view);
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
                let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                albumComp.btn_states = this.getListButtonStates(view);
        }
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList];
    }

    private async onBigTrackAlbumImgClick() {
        let selectedTrack = getState().getModel().getSelectedTrack();
        if (!selectedTrack) return;
        let expandedTrackInfo = await getState().getController().getExpandedTrackModel(selectedTrack);
        if (!expandedTrackInfo) return;
        if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
            getState().getController().showAlbum(expandedTrackInfo.album.albumInfo.uri);
            return;
        }
        if(isInstanceOfExpandedStreamModel(expandedTrackInfo)) {
            let bigTrackView = document.getElementById("currentTrackBigView") as EboBigTrackComp;
            bigTrackView.setAttribute("show_back", "true");
        }
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
                if(track?.type == "file") {
                    let albumModel = await getState().getController().getExpandedAlbumModel(track.track.album.uri);
                    this.setAlbumComponentData(albumModel);
                }
                else if(track?.type == "stream") {
                    let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                    let streamModel = await getState().getController().getExpandedTrackModel(track.track.uri) as ExpandedStreamModel;
                    albumComp.albumInfo = null;
                    albumComp.setAttribute("img", streamModel.stream.imageUrl);
                    albumComp.setAttribute("name", streamModel.stream.name);
                    let bigTrackComp = document.getElementById("currentTrackBigView") as EboBigTrackComp;
                    bigTrackComp.streamInfo = streamModel;
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
        if(isInstanceOfExpandedTrackModel(trackModel)) {
            let res = await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri);
            let text = await res.text();
            console_yellow(text);
        }
    }

    private async onSaveClicked(detail: SaveUriArgs) {
        if (detail.source == "albumView") {
            let dialogContent = `
                <label for="playListName">Name</label>
                <input type="text" id="playListName">
            `;
            this.showDialog(dialogContent, "Save", (dialog) => {
                let playlistName = dialog.querySelector("#playListName") as HTMLInputElement;
                let name = playlistName.value;
                return this.saveAlbumAsPlaylist(name, detail);
            });
        }
    }

    async saveAlbumAsPlaylist(name: string, detail: SaveUriArgs) {
        console_yellow(`Saving album to playlist ${name} as ${detail.uri}`);
        let playlist = await getState().getController().createPlaylist(name);
        let res = await getState().getController().addRefToPlaylist(playlist.uri as PlaylistUri, detail.uri, "album", -1);
        return true;
    }

    showDialog(contentHtml: string, okButtonText: string, onOkClicked: (dialog: EboDialog) => boolean | Promise<boolean>) {
        this.onDialogOkClickedCallback = onOkClicked;
        this.dialog.innerHTML = contentHtml;
        this.dialog.showModal();
        this.dialog.setAttribute("ok_text", okButtonText);
    }

    private async onGenreDefsChanged() {
        let browseComp = document.getElementById("browseView") as EboBrowseComp;
        browseComp.genreDefs = await getState().getController().getGenreDefsCached();
    }
}
