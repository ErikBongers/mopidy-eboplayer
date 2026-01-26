import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {ExpandedAlbumModel, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, PlaylistUri, TrackUri, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {console_yellow, unreachable} from "../global";
import {SaveUriArgs} from "../events";
import {EboDialog} from "../components/eboDialog";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import EboBigTrackComp from "../components/eboBigTrackComp";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {BrowseView} from "./browseView";
import {DisplayMode} from "../components/eboListItemComp";

export class MainView extends View {
    private onDialogOkClickedCallback: (dialog: EboDialog) => boolean | Promise<boolean> = () => true;
    private dialog: EboDialog;
    private browseView: BrowseView;

    constructor(dialog: EboDialog, browseView: BrowseView) {
        super();
        this.dialog = dialog;
        this.browseView = browseView;
        this.dialog.addEboEventListener("dialogOkClicked.eboplayer", (ev) => {
            console_yellow("dialogOkClicked.eboplayer");
            let innnerDialog = ev.detail.dialog;
            if(this.onDialogOkClickedCallback(innnerDialog))
                innnerDialog.close();
        });
    }

    bind() {
        this.browseView.bind();
        document.getElementById("headerSearchBtn")?.addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        document.getElementById("settingsBtn")?.addEventListener("click", async () => {
            await this.onSettingsButtonClick();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        getState().getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });
        getState().getModel().addEboEventListener("viewChanged.eboplayer", async () => {
            await this.setCurrentView();
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
        currentTrackBigViewComp.addEboEventListener("rememberStreamLines.eboplayer", async (ev) => {
            await this.rememberStreamLines(ev.detail.lines);
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
        getState().getModel().addEboEventListener("scanStatusChanged.eboplayer", (ev) => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.scanStatus = ev.detail.text;
        });
        getState().getModel().addEboEventListener("scanFinished.eboplayer", () => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.setAttribute("show_whats_new", "");
        });
        let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
        settingsComp.addEboEventListener("whatsNewRequested.eboplayer", () => {
            window.location.hash = "#WhatsNew";
            window.location.reload();
        });
    }

    private getListButtonStates(currentView: Views) {
        let states: ListButtonStates = ListButtonState_AllHidden();
        if(currentView == Views.Album) {
            states = this.showHideTrackAndAlbumButtons(states, "show");
            states.new_playlist = "hide";
            states.line_or_icon = "hide";
            return states;
        }
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

    async setCurrentView() {
        let view = getState().getModel().getView();
        await this.showView(view);
    }

    private async showView(view: Views) {
        let browseBtn = document.getElementById("headerSearchBtn") as HTMLButtonElement;
        let layout = document.getElementById("layout") as HTMLElement;
        let prevViewClass = [...layout.classList].filter(c => ["browse", "bigAlbum", "bigTrack"].includes(c))[0];
        layout.classList.remove("browse", "bigAlbum", "bigTrack", "settings");
        let resultsDisplayMode: DisplayMode = "line"; //todo: get from model.
        switch (view) {
            case Views.WhatsNew:
                await getState().getController().setWhatsNewFilter();
                resultsDisplayMode = "icon";
                //fall through
            case Views.Browse:
                layout.classList.add("browse");
                location.hash = view;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
                this.browseView.updateCompFromState(resultsDisplayMode);
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
                break;
            case Views.Settings:
                layout.classList.add("settings");
                location.hash = Views.Settings;
                browseBtn.dataset.goto = Views.NowPlaying;
                browseBtn.title = "Now playing";
                break;
            default:
                return unreachable(view);
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
            if(expandedTrackInfo.album?.albumInfo)
                getState().getController().showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri as TrackUri); //Shouldn't be a Stream.
            //todo: else?
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
                    if(track.track.album) {
                        let albumModel = await getState().getController().getExpandedAlbumModel(track.track.album.uri);
                        this.setAlbumComponentData(albumModel, track.track.uri as TrackUri); //Shoudln't be a Stream.
                    }
                    //todo: else?
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
        let albumToView = getState().getModel().getAlbumToView();
        if(!albumToView)
            return;
        let albumModel = await getState().getController().getExpandedAlbumModel(albumToView.albumUri);
        this.setAlbumComponentData(albumModel, albumToView.selectedTrackUri);
    }

    private setAlbumComponentData(albumModel: ExpandedAlbumModel, selectedTrackUri: TrackUri | null) {
        let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
        albumComp.albumInfo = albumModel;
        albumComp.setAttribute("selected_track_uri", selectedTrackUri ?? "");
        albumComp.setAttribute("img", albumModel.album.imageUrl);
        if(albumModel.album.albumInfo) {
            albumComp.setAttribute("name", albumModel.meta?.albumTitle ?? albumModel.album.albumInfo.name);
            albumComp.dataset.albumUri = albumModel.album.albumInfo.uri;
        }
    }

    private async onPlayTrackClicked(uri: TrackUri) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private async onAddTrackClicked(uri: TrackUri) {
        let trackModel = await getState().getController().getExpandedTrackModel(uri);
        if(isInstanceOfExpandedTrackModel(trackModel)) {
            if(trackModel.album?.albumInfo) {
                await fetch("http://192.168.1.111:6680/eboback/data/path?uri=" + trackModel.album.albumInfo.uri); //todo: get rid of this?
            }
            //todo: else?
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
        await getState().getController().addRefToPlaylist(playlist.uri as PlaylistUri, detail.uri, "album", -1);
        return true;
    }

    showDialog(contentHtml: string, okButtonText: string, onOkClicked: (dialog: EboDialog) => boolean | Promise<boolean>) {
        this.onDialogOkClickedCallback = onOkClicked;
        this.dialog.innerHTML = contentHtml;
        this.dialog.showModal();
        this.dialog.setAttribute("ok_text", okButtonText);
    }

    private async rememberStreamLines(lines: string[]) {
        await getState().getController().remember(lines.join("\n"));
    }

    private async onSettingsButtonClick() {
        await this.showView(Views.Settings);
    }
}
