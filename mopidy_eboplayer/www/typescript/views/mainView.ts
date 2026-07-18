import {View} from "./view";
import {AlbumUri, AllUris, Goto} from "../modelTypes";
import {unreachable} from "../global";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {State} from "../playerState";
import {addEboEventListener} from "../events";

export class MainView extends View {

    constructor(state: State) {
        super(state);
    }

    bind() {
        this.state.getModel().on("viewChanged.eboplayer", async () => {
            await this.setCurrentPage();
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
                return "nowPlayingView";
            case "#Browse":
            case "#Browse.WhatsNew":
            case "#Browse.Favorites":
                return "browseView";
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
        location.hash = "#Genres";
        layout.classList.add("showFullPage");
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
