import {View} from "./view";
import {EboPlayerDataType, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, TrackUri, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {unreachable} from "../global";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import EboBigTrackComp from "../components/eboBigTrackComp";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {BrowseView} from "./browseView";
import {DisplayMode} from "../components/eboListItemComp";
import {AlbumView} from "./albumView";
import { State } from "../playerState";

export class MainView extends View {
    private browseView: BrowseView;
    private albumView: AlbumView;

    constructor(state: State, browseView: BrowseView, albumView: AlbumView) {
        super(state);
        this.browseView = browseView;
        this.albumView = albumView;
    }

    bind() {
        this.browseView.bind();
        document.getElementById("headerSearchBtn")?.addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        document.getElementById("settingsBtn")?.addEventListener("click", async () => {
            await this.onSettingsButtonClick();
        });
        this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        this.state.getModel().addEboEventListener("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });
        this.state.getModel().addEboEventListener("viewChanged.eboplayer", async () => {
            await this.setCurrentView();
        });
        this.state.getModel().addEboEventListener("albumToViewChanged.eboplayer", async () => {
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

        this.state.getModel().addEboEventListener("scanStatusChanged.eboplayer", (ev) => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.scanStatus = ev.detail.text;
        });
        this.state.getModel().addEboEventListener("scanFinished.eboplayer", () => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.setAttribute("show_whats_new", "");
        });
        let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
        settingsComp.addEboEventListener("scanRequested.eboplayer", async () => {
            await this.state.getController().startScan();
        });
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
            states.edit = "hide";
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
                this.state.getController().setView(Views.Browse);
                break;
            case Views.NowPlaying:
                this.state.getController().setView(Views.NowPlaying);
                break;
            case Views.Album:
                this.state.getController().setView(Views.Album);
                break;
        }
    }

    async setCurrentView() {
        let view = this.state.getModel().getView();
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
                await this.state.getController().setWhatsNewFilter();
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
        let selectedTrack = this.state.getModel().getSelectedTrack();
        if (!selectedTrack) return;
        let expandedTrackInfo = await this.state.getController().getExpandedTrackModel(selectedTrack);
        if (!expandedTrackInfo) return;
        if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
            if(expandedTrackInfo.album?.albumInfo)
                this.state.getController().showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri as TrackUri); //Shouldn't be a Stream.
            //todo: else?
            return;
        }
        if(isInstanceOfExpandedStreamModel(expandedTrackInfo)) {
            let bigTrackView = document.getElementById("currentTrackBigView") as EboBigTrackComp;
            bigTrackView.setAttribute("show_back", "true");
        }
    }

    private async onTrackListChanged() {
        if(!this.state.getModel().getCurrentTrack()) {
            let trackList = this.state.getModel().getTrackList();
            if(trackList.length > 0)
                await this.state.getController().setCurrentTrackAndFetchDetails(trackList[0]);
        }
    }

    private async onSelectedTrackChanged() {
        let uri = this.state.getModel().getSelectedTrack();
        this.state.getController().lookupTrackCached(uri)
            .then(async track => {
                if(track?.type == "file") {
                    if(track.track.album) {
                        let albumModel = await this.state.getController().getExpandedAlbumModel(track.track.album.uri);
                        this.albumView.setAlbumComponentData(albumModel, track.track.uri as TrackUri); //Shoudln't be a Stream.
                    }
                    //todo: else?
                }
                else if(track?.type == "stream") {
                    let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                    let streamModel = await this.state.getController().getExpandedTrackModel(track.track.uri) as ExpandedStreamModel;
                    albumComp.albumInfo = null;
                    albumComp.setAttribute("img", streamModel.stream.imageUrl);
                    albumComp.setAttribute("name", streamModel.stream.name);
                    let bigTrackComp = document.getElementById("currentTrackBigView") as EboBigTrackComp;
                    bigTrackComp.streamInfo = streamModel;
                }
            });
    }

    private async onAlbumToViewChanged() {
        let albumToView = this.state.getModel().getAlbumToView();
        if(!albumToView)
            return;
        let albumModel = await this.state.getController().getExpandedAlbumModel(albumToView.albumUri);
        this.albumView.setAlbumComponentData(albumModel, albumToView.selectedTrackUri);
    }

    private async rememberStreamLines(lines: string[]) {
        await this.state.getController().remember(lines.join("\n"));
    }

    private async onSettingsButtonClick() {
        await this.showView(Views.Settings);
    }
}
