import {ComponentView} from "./view";
import {AllUris} from "../modelTypes";
import {EboBrowseComp} from "../components/browse/eboBrowseComp";
import {GuiSourceArgs} from "../events";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {DisplayMode} from "../components/eboListItemComp";
import {State} from "../playerState";

export class BrowseView extends ComponentView<EboBrowseComp> {
    constructor(state: State, component: EboBrowseComp) {
        super(state, component);
    }

    bind() {
        this.component.hideInfoButton = this.state.getController().localStorageProxy.getHideBrowseInfoButton();
        this.on("guiBrowseFilterChanged.eboplayer", async () => {
            await this.onGuiBrowseFilterChanged();
        });
        this.on("breadCrumbClick.eboplayer", async (ev) => {
            await this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        this.on("browseResultClick.eboplayer", async (ev) => {
            await this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        this.on("browseResultDblClick.eboplayer", async (ev) => {
            await this.onBrowseResultDblClick(ev.detail.uri as AllUris);
        });
        this.state.getModel().addEboEventListener("genreReplacementsChanged.eboplayer", async () => {
            await this.onGenreReplacementChanged();
        });
        this.state.getModel().addEboEventListener("refsFiltered.eboplayer", () => {
            this.onRefsFiltered();
        });
        this.state.getModel().addEboEventListener("breadCrumbsChanged.eboplayer", () => {
            this.onBreadCrumbsChanged();
        });
        this.state.getModel().addEboEventListener("modelBrowseFilterChanged.eboplayer", () => {
            this.onModelBrowseFilterChanged();
        });
        this.on("playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        this.on("addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        this.on("replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        this.on("displayModeChanged.eboplayer", async (ev) => {
            this.component.setAttribute("display_mode", ev.detail.mode);
            this.state.getController().localStorageProxy.saveLineOrIconPreference(ev.detail.mode);
        });
        this.component.setAttribute("display_mode", this.state.getController().localStorageProxy.getLineOrIconPreference());
        this.component.addEboEventListener("hideBrowseInfoButton.eboplayer", async (ev) => {
            this.state.getController().localStorageProxy.setHideBrowseInfoButton(true);
        });
    }

    private async onGuiBrowseFilterChanged() {
        await this.state.getController().setAndSaveBrowseFilter(this.component.browseFilter);
    }

    private onRefsFiltered() {
        this.component.results = this.state.getModel().getCurrentSearchResults();
        this.component.action_btn_states = this.getListButtonStates();
        let displayMode: DisplayMode = this.state.getController().localStorageProxy.getLineOrIconPreference();
        this.setEffectiveDisplayMode(displayMode);
    }

    private getListButtonStates() {
        let states: ListButtonStates = ListButtonState_AllHidden();
        let searchResults = this.state.getModel().getCurrentSearchResults();
        let browseFilter = this.state.getModel().getCurrentBrowseFilter();

        states.line_or_icon = "show";

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

    updateCompFromState(displayMode: DisplayMode) {
        this.component.browseFilter = this.state.getModel().getCurrentBrowseFilter(); //todo: already set in controller?
        this.component.results = this.state.getModel().getCurrentSearchResults();
        this.component.breadCrumbs = this.state.getModel().getBreadCrumbs();
        this.component.setFocusAndSelect();
        this.component.action_btn_states = this.getListButtonStates();

        this.setEffectiveDisplayMode(displayMode);
    }

    private setEffectiveDisplayMode(displayMode: "line" | "icon") {
        let effectiveDisplayMode = displayMode;
        if (!this.component.results.refs.some(res => res.item.idMaxImage)) {
            effectiveDisplayMode = "line";
        }

        this.component.setAttribute("display_mode", effectiveDisplayMode);
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
        this.component.breadCrumbs = this.state.getModel()?.getBreadCrumbs() ?? [];
    }

    private onModelBrowseFilterChanged() {
        this.component.browseFilter = this.state.getModel().getCurrentBrowseFilter();
    }

    private async onPlayItemListClick(detail: GuiSourceArgs) {
        await this.state.getPlayer().clear();
        await this.state.getController().addCurrentSearchResultsToPlayer();
        await this.state.getPlayer().play();
    }

    private async onAddItemListClick(detail: GuiSourceArgs) {
        await this.state.getController().addCurrentSearchResultsToPlayer();
    }

    private async onReplaceItemListClick(detail: GuiSourceArgs) {
        await this.state.getPlayer().clear();
        await this.onAddItemListClick(detail);
    }

    private async onBrowseResultDblClick(uri: AllUris) {
        await this.state.getPlayer().clearAndPlay([uri]);
    }

    private async onBrowseResultClick(label: string, uri: AllUris, type: string) {
        await this.state.getController().diveIntoBrowseResult(label, uri, type, true);
    }

    private async onBreadcrumbClick(breadcrumbId: number) {
        await this.state.getController().resetToBreadCrumb(breadcrumbId);
    }

    private async onGenreReplacementChanged() {
        this.component.genreReplacements = await this.state.getController().cache.getGenreReplacementsCached();
    }

}
