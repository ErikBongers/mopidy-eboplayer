import {View} from "./view";
import {AlbumUri, AllUris, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, MessageType, StreamUri, TrackUri, Pages, Goto} from "../modelTypes";
import {EboBigAlbumComp} from "../components/album/eboBigAlbumComp";
import {EboBrowseComp} from "../components/browse/eboBrowseComp";
import {unreachable} from "../global";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {BrowseView} from "./browseView";
import {DisplayMode} from "../components/eboListItemComp";
import {AlbumView} from "./albumView";
import {State} from "../playerState";
import {addEboEventListener} from "../events";
import {EboBigRadioComp} from "../components/radio/eboBigRadioComp";
import {RadioView} from "./radioView";
import {EboTimeLineDetailsComp} from "../components/eboTimeLineDetailsComp";
import {TopBarView} from "./topBarView"

export class MainView extends View {
    private browseView: BrowseView;
    private albumView: AlbumView;
    private radioView: RadioView;
    private topBarView: TopBarView;

    constructor(state: State, browseView: BrowseView, albumView: AlbumView, radioView: RadioView, topBarView: TopBarView) {
        super(state);
        this.browseView = browseView;
        this.albumView = albumView;
        this.radioView = radioView;
        this.topBarView = topBarView;
    }

    bind() {
        this.browseView.bind();
        this.albumView.bind();
        this.radioView.bind();
        this.topBarView.bind();
        this.state.getModel().on("selectedTrackChanged.eboplayer", async () => {
            await this.onSelectedTrackChanged();
        });
        this.state.getModel().on("trackListChanged.eboplayer", async () => {
            await this.onTrackListChanged();
        });
        this.state.getModel().on("viewChanged.eboplayer", async () => {
            await this.setCurrentPage();
        });
        this.state.getModel().on("albumToViewChanged.eboplayer", async () => {
            await this.onAlbumToViewChanged();
        });
        this.state.getModel().on("currentRadioChanged.eboplayer", async () => {
            await this.onRadioToViewChanged();
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

    private getListButtonStates(currentView: Pages) {
        let states: ListButtonStates = ListButtonState_AllHidden();
        switch (currentView) {
            case "#Album":
                states = this.showHideTrackAndAlbumButtons(states, "show");
                states.new_playlist = "hide";
                states.edit = "hide";
                states.line_or_icon = "hide";
                return states;
            case "#Radio":
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
        let prevViewClass = [...layout.classList].filter(c => ["browse", "bigAlbum", "bigTrack"].includes(c))[0];
        let resultsDisplayMode: DisplayMode = this.state.getController().localStorageProxy.getLineOrIconPreference();
        layout.classList.remove("showFullPage");
        switch (gotoPage) {
            case "#WhatsNew":
                await this.state.getController().setWhatsNewFilter();
                resultsDisplayMode = "icon";
                layout.classList.add("showFullPage");
                //fall through
            case "#Browse":
            case "#Browse.Favorites":
                location.hash = gotoPage.replace(".Favorites", "");
                this.browseView.updateCompFromState(resultsDisplayMode);
                layout.classList.add("showFullPage");
                break;
            case "#NowPlaying":
                location.hash = ""; //default = now playing
                break;
            case "#Album":
                location.hash = "#Album";
                let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                albumComp.btn_states = this.getListButtonStates(gotoPage);
                layout.classList.add("showFullPage");
                break;
            case "#Radio":
                location.hash = "#Radio";
                let radioComp = document.getElementById("bigRadioView") as EboBigRadioComp;
                radioComp.btn_states = this.getListButtonStates(gotoPage);
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

    private async onSelectedTrackChanged() {
        let uri = this.state.getModel().getSelectedTrack();
        this.state.getController().cache.lookupTrackCached(uri)
            .then(async track => {
                if(track?.type == "file") {
                    if(track.track.album) {
                        let albumModel = await this.state.getController().getExpandedAlbumModel(track.track.album.uri);
                        this.albumView.setAlbumComponentData(albumModel, track.track.uri as TrackUri); //Shoudln't be a Stream.
                    }
                    //else: album view will not be shown when track has no album...but are we sure?
                }
                else if(track?.type == "stream") {
                    let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                    let streamModel = await this.state.getController().getExpandedTrackModel(track.track.uri) as ExpandedStreamModel;
                    albumComp.albumInfo = null;
                    albumComp.setAttribute("img", streamModel.bigImageUrl);
                    albumComp.setAttribute("name", streamModel.stream.name);
                    let timelineDetails = document.getElementById("timelineDetails") as EboTimeLineDetailsComp;
                    timelineDetails.streamInfo = streamModel;
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

    private async onRadioToViewChanged() {
        let radioToView = this.state.getModel().getRadioToView();
        if(!radioToView)
            return;
        let radioModel = await this.state.getController().getExpandedTrackModel(radioToView) as ExpandedStreamModel;
        this.radioView.setStreamComponentData(radioModel);
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
