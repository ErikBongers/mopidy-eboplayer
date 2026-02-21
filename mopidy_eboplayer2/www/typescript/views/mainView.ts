import {View} from "./view";
import {AllUris, ExpandedStreamModel, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel, MessageType, StreamUri, TrackUri, Views} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {unreachable} from "../global";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {BrowseView} from "./browseView";
import {DisplayMode} from "../components/eboListItemComp";
import {AlbumView} from "./albumView";
import {State} from "../playerState";
import {addEboEventListener} from "../events";
import {EboBigRadioComp} from "../components/eboBigRadioComp";
import {RadioView} from "./radioView";
import {EboTimeLineDetailsComp} from "../components/eboTimeLineDetailsComp";

export class MainView extends View {
    private browseView: BrowseView;
    private albumView: AlbumView;
    private radioView: RadioView;

    constructor(state: State, browseView: BrowseView, albumView: AlbumView, radioView: RadioView) {
        super(state);
        this.browseView = browseView;
        this.albumView = albumView;
        this.radioView = radioView;
    }

    bind() {
        this.browseView.bind();
        this.albumView.bind();
        this.radioView.bind();
        document.getElementById("headerSearchBtn")?.addEventListener("click", () => {
            this.onBrowseButtonClick();
        });
        document.getElementById("headerNowPlayingBtn")?.addEventListener("click", () => {
            this.onNowPlayingButtonClick();
        });
        document.getElementById("headerFavoritesBtn")?.addEventListener("click", async () => {
            await this.state.getController().gotoFavorites();
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
        this.state.getModel().addEboEventListener("currentRadioChanged.eboplayer", async () => {
            await this.onRadioToViewChanged();
        });
        let timelineDetailsView = document.getElementById("timelineDetails") as EboBrowseComp;
        timelineDetailsView.addEboEventListener("bigTimelineImageClicked.eboplayer", async () => {
            await this.onTimelineBigImgClick();
        });
        timelineDetailsView.addEboEventListener("bigTrackAlbumSmallImgClicked.eboplayer", async () => {
            timelineDetailsView.setAttribute("show_back", "false");
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

        let layout = document.getElementById("layout") as HTMLElement;
        addEboEventListener(layout, "rememberedRequested.eboplayer", () => {
            this.state.getController().setView(Views.Remembered);
        });

        addEboEventListener(layout, "genreSelected.eboplayer", ev => {
            this.onGenreSelected(ev.detail.text);
        });
        addEboEventListener(layout, "favoriteToggle.eboplayer", async (ev) => {
            await this.onToggleFavorite(ev.detail.uri);
        });
        addEboEventListener(layout, "rememberStreamLines.eboplayer", async (ev) => {
            await this.rememberStreamLines(ev.detail.lines);
        });

    }

    private getListButtonStates(currentView: Views) {
        let states: ListButtonStates = ListButtonState_AllHidden();
        switch (currentView) {
            case Views.Album:
                states = this.showHideTrackAndAlbumButtons(states, "show");
                states.new_playlist = "hide";
                states.edit = "hide";
                states.line_or_icon = "hide";
                return states;
            case Views.Radio:
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
        this.state.getController().setView(Views.Browse);
    }

    private onNowPlayingButtonClick() {
        this.state.getController().setView(Views.NowPlaying);
    }

    async setCurrentView() {
        let view = this.state.getModel().getView();
        await this.showView(view);
    }

    private hashToViewId(hash: Views): string {
        switch (hash) {
            case Views.NowPlaying:
                return "timelineDetails";
            case Views.Browse:
                return "browseView";
            case Views.WhatsNew:
                return "browseView"; //note this one!
            case Views.Remembered:
                return "rememberedView";
            case Views.Album:
                return "bigAlbumView";
            case Views.Settings:
                return "settingsView";
            case Views.Genres:
                return "genresView"
            case Views.Radio:
                return "bigRadioView";
            default:
                return unreachable(hash);
        }
    }

    private async showView(view: Views) {
        let fullViews = document.querySelectorAll(".fullView");
        fullViews.forEach(v => v.classList.remove("shownView"));
        let currentView = document.getElementById(this.hashToViewId(view)) as HTMLElement;
        currentView.classList.add("shownView");
        let browseBtn = document.getElementById("headerSearchBtn") as HTMLButtonElement;
        let nowPlayingBtn = document.getElementById("headerNowPlayingBtn") as HTMLButtonElement;
        let layout = document.getElementById("layout") as HTMLElement;
        let prevViewClass = [...layout.classList].filter(c => ["browse", "bigAlbum", "bigTrack"].includes(c))[0];
        let resultsDisplayMode: DisplayMode = this.state.getController().localStorageProxy.getLineOrIconPreference();
        layout.classList.remove("showFullView");
        switch (view) {
            case Views.WhatsNew:
                await this.state.getController().setWhatsNewFilter();
                resultsDisplayMode = "icon";
                layout.classList.add("showFullView");
                //fall through
            case Views.Browse:
                location.hash = view;
                browseBtn.style.display = "none";
                nowPlayingBtn.style.display = "block";
                this.browseView.updateCompFromState(resultsDisplayMode);
                layout.classList.add("showFullView");
                break;
            case Views.NowPlaying:
                location.hash = ""; //default = now playing
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "none";
                break;
            case Views.Album:
                location.hash = Views.Album;
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                let albumComp = document.getElementById("bigAlbumView") as EboBigAlbumComp;
                albumComp.btn_states = this.getListButtonStates(view);
                layout.classList.add("showFullView");
                break;
            case Views.Radio:
                location.hash = Views.Radio;
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                let radioComp = document.getElementById("bigRadioView") as EboBigRadioComp;
                radioComp.btn_states = this.getListButtonStates(view);
                layout.classList.add("showFullView");
                break;
            case Views.Settings:
                location.hash = Views.Settings;
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                layout.classList.add("showFullView");
                break;
            case Views.Remembered:
                location.hash = Views.Remembered;
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                layout.classList.add("showFullView");
                break;
            case Views.Genres:
                location.hash = Views.Genres;
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                layout.classList.add("showFullView");
                break;
            default:
                return unreachable(view);
        }
    }

    private async onTimelineBigImgClick() {
        let selectedTrack = this.state.getModel().getSelectedTrack();
        if (!selectedTrack) return;
        let expandedTrackInfo = await this.state.getController().getExpandedTrackModel(selectedTrack);
        if (!expandedTrackInfo) return;
        if (isInstanceOfExpandedTrackModel(expandedTrackInfo)) {
            if(expandedTrackInfo.album?.albumInfo)
                this.state.getController().showAlbum(expandedTrackInfo.album.albumInfo.uri, expandedTrackInfo.track.track.uri as TrackUri); //Shouldn't be a Stream.
            else { //orphaned track (no album)
                this.state.getController().showTempMessage("This track has no album.", MessageType.Error);
            }
            return;
        }
        if(isInstanceOfExpandedStreamModel(expandedTrackInfo)) {
            this.state.getController().showRadio(expandedTrackInfo.stream.ref.uri as StreamUri);
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

    private async onSettingsButtonClick() {
        await this.showView(Views.Settings);
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
}
