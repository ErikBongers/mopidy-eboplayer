import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import {AlbumUri, AllUris} from "../modelTypes";
import {EboBigAlbumComp} from "../components/eboBigAlbumComp";
import {EboBrowseComp} from "../components/eboBrowseComp";
import {addEboEventListener, GuiSourceArgs} from "../events";
import {ListButtonState, ListButtonState_AllHidden, ListButtonStates} from "../components/eboListButtonBar";
import {DisplayMode} from "../components/eboListItemComp";
import {AlbumToView} from "../model";

export class BrowseView extends View {
    private browseComp: EboBrowseComp;
    constructor() {
        super();
        this.browseComp = document.getElementById("browseView") as EboBrowseComp;
    }

    bind() {
        this.browseComp.addEboEventListener("guiBrowseFilterChanged.eboplayer", async () => {
            await this.onGuiBrowseFilterChanged();
        });
        this.browseComp.addEboEventListener("breadCrumbClick.eboplayer", async (ev) => {
            await this.onBreadcrumbClick(ev.detail.breadcrumbId);
        });
        this.browseComp.addEboEventListener("browseResultClick.eboplayer", async (ev) => {
            await this.onBrowseResultClick(ev.detail.label, ev.detail.uri, ev.detail.type);
        });
        this.browseComp.addEboEventListener("browseResultDblClick.eboplayer", async (ev) => {
            await this.onBrowseResultDblClick(ev.detail.uri as AllUris);
        });
        getState().getModel().addEboEventListener("genreDefsChanged.eboplayer", async () => {
            await this.onGenreDefsChanged();
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
        this.browseComp.addEboEventListener("playItemListClicked.eboplayer", async (ev) => {
            await this.onPlayItemListClick(ev.detail);
        });
        this.browseComp.addEboEventListener("addItemListClicked.eboplayer", async (ev) => {
            await this.onAddItemListClick(ev.detail);
        });
        this.browseComp.addEboEventListener("replaceItemListClicked.eboplayer", async (ev) => {
            await this.onReplaceItemListClick(ev.detail);
        });
        this.browseComp.addEboEventListener("displayModeChanged.eboplayer", async (ev) => {
            this.browseComp.setAttribute("display_mode", ev.detail.mode);
        });
    }

    private async onGuiBrowseFilterChanged() {
        await getState().getController().setAndSaveBrowseFilter(this.browseComp.browseFilter);
    }

    private onRefsFiltered() {
        this.browseComp.results = getState().getModel().getCurrentSearchResults();
        this.browseComp.action_btn_states = this.getListButtonStates();
    }

    private getListButtonStates() {
        let states: ListButtonStates = ListButtonState_AllHidden();
        let searchResults = getState().getModel().getCurrentSearchResults();
        let browseFilter = getState().getModel().getCurrentBrowseFilter();

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
        this.browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter(); //todo: already set in controller?
        this.browseComp.results = getState()?.getModel()?.getCurrentSearchResults() ?? {refs: [], availableRefTypes: new Set()}; //todo: the default should be provided by getCurrentSearchResults()
        this.browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
        this.browseComp.setFocusAndSelect();
        this.browseComp.action_btn_states = this.getListButtonStates();
        this.browseComp.setAttribute("display_mode", displayMode);
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
        this.browseComp.breadCrumbs = getState()?.getModel()?.getBreadCrumbs() ?? [];
    }

    private onModelBrowseFilterChanged() {
        this.browseComp.browseFilter = getState().getModel().getCurrentBrowseFilter();
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList];
    }

    private async onPlayItemListClick(detail: GuiSourceArgs) {
        await getState().getPlayer().clear();
        await getState().getController().addCurrentSearchResultsToPlayer();
        await getState().getPlayer().play();
    }

    private async onAddItemListClick(detail: GuiSourceArgs) {
        await getState().getController().addCurrentSearchResultsToPlayer();
    }

    private async onReplaceItemListClick(detail: GuiSourceArgs) {
        await getState().getPlayer().clear();
        await this.onAddItemListClick(detail);
    }

    private async onBrowseResultDblClick(uri: AllUris) {
        await getState().getPlayer().clearAndPlay([uri]);
    }

    private async onBrowseResultClick(label: string, uri: AllUris, type: string) {
        await getState().getController().diveIntoBrowseResult(label, uri, type, true);
    }

    private async onBreadcrumbClick(breadcrumbId: number) {
        await getState().getController().resetToBreadCrumb(breadcrumbId);
    }

    private async onGenreDefsChanged() {
        this.browseComp.genreDefs = await getState().getController().getGenreDefsCached();
    }

}
