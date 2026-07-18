import {View} from "./view";
import {AlbumUri, AllUris, Goto, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, MessageType, Pages, StreamUri, TrackUri} from "../modelTypes";
import {EboBigAlbumComp} from "../components/album/eboBigAlbumComp";
import {EboBrowseComp} from "../components/browse/eboBrowseComp";
import {unreachable} from "../global";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {State} from "../playerState";
import {addEboEventListener} from "../events";
import {EboBigRadioComp} from "../components/radio/eboBigRadioComp";

export class MainView extends View {

    constructor(state: State) {
        super(state);
    }

    bind() {
        this.state.getModel().on("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });
        this.state.getModel().on("viewChanged.eboplayer", async () => {
            await this.setCurrentPage();
        });
        let timelineDetailsView = document.getElementById("timelineDetails") as EboBrowseComp;
        timelineDetailsView.on("bigTimelineImageClicked.eboplayer", async () => {
            await this.onTimelineBigImgClick();
        });
        timelineDetailsView.on("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
            timelineDetailsView.setAttribute("show_back", "false");
        });
        this.state.getModel().on("scanStatusChanged.eboplayer", (ev) => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.scanStatus = ev.detail.status;
        });
        this.state.getModel().on("scanFinished.eboplayer", () => {
            let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
            settingsComp.setAttribute("show_whats_new", "");
        });
        let settingsComp = document.getElementById("settingsView") as EboSettingsComp;
        settingsComp.on("scanRequested.eboplayer", async () => {
            await this.state.getController().startScan();
        });
        settingsComp.on("whatsNewRequested.eboplayer", () => {
            window.location.hash = "#WhatsNew";
            window.location.reload();
        });
        settingsComp.on("mopidyConfigRequested.eboplayer", async () => {
            await this.state.getController().readMopidyConfig();
        });
        settingsComp.on("mopidyConfigAddExclExt.eboplayer", async (ev) => {
            await this.state.getController().addExclExtToMopidyConfig(ev.detail.extension);
        });

        let layout = document.getElementById("layout") as HTMLElement;
        addEboEventListener(layout, "rememberedRequested.eboplayer", () => {
            this.state.getController().viewController.setView("#Remembered");
        });

        addEboEventListener(layout, "genreSelected.eboplayer", ev => {
            this.onGenreSelected(ev.detail.text);
        });
        addEboEventListener(layout, "favoriteToggle.eboplayer", async (ev) => {
            await this.onToggleFavorite(ev.detail.uri);
        });
        addEboEventListener(layout, "albumVolumeAdjustDown.eboplayer", async (ev) => {
            await this.onAlbumVolumeDown(ev.detail.uri as AlbumUri);
        });
        addEboEventListener(layout, "albumVolumeAdjustUp.eboplayer", async (ev) => {
            await this.onAlbumVolumeUp(ev.detail.uri as AlbumUri);
        });
        addEboEventListener(layout, "rememberStreamLines.eboplayer", async (ev) => {
            await this.rememberStreamLines(ev.detail.lines);
        });

    }

    static getListButtonStates(page: Goto) {
        let states: ListButtonStates = ListButtonState_AllHidden();
        switch (page) {
            case "#Album":
                states = MainView.showHideTrackAndAlbumButtons(states, "show");
                states.new_playlist = "hide";
                states.edit = "hide";
                states.line_or_icon = "hide";
                return states;
            case "#Radio":
                states = MainView.showHideTrackAndAlbumButtons(states, "show");
                states.new_playlist = "hide";
                states.edit = "hide";
                states.line_or_icon = "hide";
                return states;

        }
        return states;
    }

    static showHideTrackAndAlbumButtons(states: ListButtonStates, state: ListButtonState): ListButtonStates {
        states.add = state;
        states.replace = state;
        states.play = state;
        states.save = state;
        states.edit = state;
        return states;
    }

    async setCurrentPage() {
        let page = this.state.getModel().getPage();
        await this.showPage(page);
    }

    private hashToViewId(hash: Goto): string {
        switch (hash) {
            case "#NowPlaying":
                return "timelineDetails";
            case "#Browse":
            case "#Browse.Favorites":
                return "browseView";
            case "#WhatsNew":
                return "browseView"; //note this one!
            case "#Remembered":
                return "rememberedView";
            case "#Album":
                return "bigAlbumView";
            case "#Settings":
                return "settingsView";
            case "#Genres":
                return "genresView"
            case "#Radio":
                return "bigRadioView";
            default:
                return unreachable(hash);
        }
    }

    private async showPage(gotoPage: Goto) {
        let fullViews = document.querySelectorAll(".page");
        fullViews.forEach(v => v.classList.remove("shownPage"));
        let currentView = document.getElementById(this.hashToViewId(gotoPage)) as HTMLElement;
        currentView.classList.add("shownPage");
        let layout = document.getElementById("layout") as HTMLElement;
        layout.classList.remove("showFullPage");
        switch (gotoPage) {
            case "#WhatsNew":
            case "#Browse":
            case "#Browse.Favorites":
                location.hash = gotoPage.replace(".Favorites", "");
                layout.classList.add("showFullPage");
                break;
            case "#NowPlaying":
                location.hash = ""; //default = now playing
                break;
            case "#Album":
                location.hash = "#Album";
                layout.classList.add("showFullPage");
                break;
            case "#Radio":
                location.hash = "#Radio";
                layout.classList.add("showFullPage");
                break;
            case "#Settings":
                location.hash = "#Settings";
                layout.classList.add("showFullPage");
                break;
            case "#Remembered":
                location.hash = "#Remembered";
                layout.classList.add("showFullPage");
                break;
            case "#Genres":
                location.hash = "#Genres";
                layout.classList.add("showFullPage");
                break;
            default:
                return unreachable(gotoPage);
        }
    }

    private async onTimelineBigImgClick() {
        let selectedTrack = this.state.getModel().getSelectedTrack();
        if (!selectedTrack) return;
        let expandedTrackInfo = await this.state.getController().getExpandedTrackModel(selectedTrack);
        if (!expandedTrackInfo) return;
        if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
            if(expandedTrackInfo.album?.albumInfo)
                this.state.getController().viewController.showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri as TrackUri); //Shouldn't be a Stream.
            else { //orphaned track (no album)
                this.state.getController().showTempMessage("This track has no album.", MessageType.Error);
            }
            return;
        }
        if(isInstanceOfExpandedStreamModel(expandedTrackInfo)) {
            this.state.getController().viewController.showRadio(expandedTrackInfo.stream.ref.uri as StreamUri);
        }
    }

    private async onTrackListChanged() {
        if(!this.state.getModel().getCurrentTrack()) {
            let trackList = this.state.getModel().getTrackList();
            if(trackList.length > 0)
                await this.state.getController().setCurrentTrackAndFetchDetails(trackList[0]);
        }
    }

    private async rememberStreamLines(lines: string[]) {
        await this.state.getController().remember(lines.join("\n"));
    }

    private onGenreSelected(genre: string) {
        let albumBeingEdited = this.state.getController().localStorageProxy.getAlbumBeingEdited();
        if(!albumBeingEdited)
            return;
        this.state.getController().saveAlbumGenre(albumBeingEdited, genre);
    }

    private async onToggleFavorite(uri: AllUris) {
        await this.state.getController().toggleFavorite(uri);
    }

    private async onAlbumVolumeDown(uri: AlbumUri) {
        await this.state.getController().setAlbumVolumeDown(uri);
    }

    private async onAlbumVolumeUp(uri: AlbumUri) {
        await this.state.getController().setAlbumVolumeUp(uri);
    }
}
