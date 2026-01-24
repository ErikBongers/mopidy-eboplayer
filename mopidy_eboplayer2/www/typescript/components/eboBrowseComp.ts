import {EboComponent} from "./EboComponent";
import {AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, ExpandedAlbumModel, FilterBreadCrumb, GenreDef, isInstanceOfExpandedStreamModel, isInstanceOfExpandedTrackModel} from "../modelTypes";
import {EmptySearchResults, RefType, SearchResult, SearchResults} from "../refs";
import {GuiSource} from "../events";
import {unreachable} from "../global";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "./eboListButtonBar";
import {EboBrowseFilterComp} from "./eboBrowseFilterComp";
import {EboListItemComp} from "./eboListItemComp";
import getState from "../playerState";

export class EboBrowseComp extends EboComponent {
    get genreDefs(){
        return this._genreDefs;
    }

    set genreDefs(value: Map<string, GenreDef>) {
        this._genreDefs = value;
    }
    get action_btn_states(): ListButtonStates {
        return this._action_btn_states;
    }

    set action_btn_states(value: ListButtonStates) {
        this._action_btn_states = value;
        this.requestUpdate();
    }
    static override readonly tagName=  "ebo-browse-view";
    private static listSource: GuiSource = "browseView";

    private _action_btn_states: ListButtonStates = ListButtonState_AllHidden();

    get breadCrumbs(): FilterBreadCrumb[] {
        return this._breadCrumbs;
    }
    set breadCrumbs(value: FilterBreadCrumb[]) {
        this._breadCrumbs = value;
        this.renderBreadCrumbs(); // don't render all, as user may be typing a search text.
    }

    private _breadCrumbs: FilterBreadCrumb[] = [];

    get results(): SearchResults {
        return this._results;
    }

    set results(value: SearchResults) {
        this._results = value;
        this.renderResults(); // don't render all, as user may be typing a search text.
        this.requestUpdate();
    }

    private _results: SearchResults = EmptySearchResults;

    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }

    set browseFilter(value: BrowseFilter) {
        if(JSON.stringify(this._browseFilter) == JSON.stringify(value))
            return;
        this._browseFilter = value;
        this.requestUpdate();
    }

    private _browseFilter: BrowseFilter;

    private _genreDefs: Map<string, GenreDef>;

    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

    static styleText= `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #filterButtons {
                margin-top: .3em;
                display: flex;
                flex-direction: row;
            }
            #searchBox {
                & input {
                    flex-grow: 1;
                    color: white;
                    border: none;
                    &:focus {
                        outline: none;
                    }
                }
            }
            
           #filterBox {
                margin-block: .5rem;
                padding:.3rem;
                background-color: rgba(0,0,0,.5);
                border-radius: .5rem;
            }
            .filterButton {
                width: 1.5em;
                height: 1.5em;
                object-fit: contain;
                margin-right: .5em;
            }
            #searchResults {
                display: flex;
                flex-direction: column;
                overflow: hidden;
                height: 100%;
            }
            #tableWrapper {
                height: 100%;
                width: 100%;
                overflow: scroll;
                scrollbar-width: none;
                &.lines {
                    display: flex;
                    flex-direction: column;
                }
                &.icons {
                    display: grid;
                    grid-template-columns: repeat(3, auto);
                }
                td {
                    padding-top: .2em;
                    padding-bottom: .2em;
                }
            }
            .breadcrumb {
                background-color: var(--highlight-background);
                border-radius: 1rem;
                padding-inline-start: 0.5rem;
                padding-inline-end: 0.6em;
                corner-inline-end-shape: bevel;
                .filterButton {
                    filter: invert(100%) sepia(100%) saturate(0%) hue-rotate(350deg) brightness(104%) contrast(102%);
                    height: 1rem;
                    width: 1rem;
                    position: relative;
                    top: .1rem;
                    margin-right: .2rem;
                }
            }
            #expandFilterBtn {
                margin-left: .5rem;
            }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
<div id="wrapper">
    <div id="breadCrumbs"></div>
    <ebo-browse-filter></ebo-browse-filter>
    <div id="searchResults">
        <ebo-list-button-bar list_source="${this.listSource}"></ebo-list-button-bar>
        <div id="searchInfo">
        </div>  
        <div id="tableWrapper">
            Wait for it...
        </div>
    </div>
</div>        
        `;

    constructor() {
        super(EboBrowseComp.styleText, EboBrowseComp.htmlText);
        this._browseFilter = new BrowseFilter();
        this.results = EmptySearchResults;
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
                this.updateStringProperty(name, newValue);
                break;
            case "enabled":
            case "show_back":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestRender();
        }

    setFocusAndSelect() {
        let searchText = this.getShadow().getElementById("searchText") as HTMLInputElement;
        searchText?.focus();
        searchText?.select();
    }

    render(shadow:ShadowRoot) {
        this.renderBreadCrumbs();
        this.renderResults();
        this.requestUpdate();
    }

    override update(shadow:ShadowRoot) {

        let listButtonBar = shadow.querySelector("ebo-list-button-bar") as EboListButtonBar;
        listButtonBar.btn_states = this.action_btn_states;
        let browseFilterComp = shadow.querySelector("ebo-browse-filter") as EboBrowseFilterComp;
        browseFilterComp.browseFilter = this._browseFilter;
        browseFilterComp.availableRefTypes = this.results.availableRefTypes;
    }

    setSearchInfo(text: string) {
        let searchInfo = this.getShadow().getElementById("searchInfo");
        if(searchInfo)
            searchInfo.innerHTML = text;
    }

    renderBreadCrumbs() {
        if(!this.isRendered) //may be called directly, before initialization.
            return;
        let breadCrumbsDiv = this.getShadow().getElementById("breadCrumbs") as HTMLDivElement;
        breadCrumbsDiv.innerHTML = this.breadCrumbs
            .map(crumb => this.renderBreadcrumb(crumb))
            .join(" ");

        breadCrumbsDiv.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", (ev)  => {
                this.onBreadCrumbClicked(ev);
            });
        })
    }

    private renderBreadcrumb(crumb: FilterBreadCrumb) {
        //todo: make switch statement:  https://stackoverflow.com/a/36332700/1311434
        if(crumb instanceof BreadCrumbRef)
            return `<button data-id="${crumb.id}" class="breadcrumb uri">${crumb.label}</button>`;
        else if(crumb instanceof BreadCrumbBrowseFilter) {
            let selectedFilters = crumb.data.getSelectedFilters();
            let imgTags = "";
            let filterText = "";
            imgTags = selectedFilters.map(filter => this.filterToImg(filter)).join("");
            if(crumb.data.searchText)
                filterText = `"${crumb.data.searchText}"`;
            return `<button data-id="${crumb.id}" class="breadcrumb filter">${imgTags}${filterText}</button>`;
        }
        else if(crumb instanceof BreadCrumbHome)
            return `<button data-id="${crumb.id}" class="breadcrumb filter"><i class="fa fa-home"></i></button>`;
        return unreachable(crumb);
    }

    private filterToImg(filter: string) {
        let imgUrl = "";
        switch (filter) {
            case "album": imgUrl = "images/icons/Album.svg"; break;
            case "track": imgUrl = "images/icons/Track.svg"; break;
            case "radio": imgUrl = "images/icons/Radio.svg"; break;
            case "artist": imgUrl = "images/icons/Artist.svg"; break;
            case "playlist": imgUrl = "images/icons/Playlist.svg"; break;
            case "genre": imgUrl = "images/icons/Genre.svg"; break;
        }
        return `<img class="filterButton" src="${imgUrl}" alt="">`;
    }

    async renderResults() {
        if(!this.isRendered) //may be called directly, before initialization.
            return;
        this.setSearchInfo("");

        let tableWrapper = this.getShadow().getElementById("tableWrapper") as HTMLDivElement;
        tableWrapper.innerHTML = "--no results--";

        if(this.results.refs.length == 0)
            return;

        tableWrapper.innerHTML = "";

        let html = "";
        for(let result of this.results.refs) {
            let imgUrl = "";
            if(result.type == "ref") {
                let model = await getState().getController().getExpandedModel(result.item);
                if (model) {
                    if(isInstanceOfExpandedTrackModel(model))
                        imgUrl = model.album?.imageUrl??"";
                    else if(isInstanceOfExpandedStreamModel(model))
                        imgUrl = model.stream.imageUrl;
                    else //album track model
                       imgUrl = model.album.imageUrl;
                }
            }
            let refType = result.item.ref.type;
            html += `
                    <ebo-list-item 
                        data-uri="${result.item.ref.uri}" 
                        data-type="${refType}"
                        text="${result.item.ref.name + this.getGenreAlias(result)}"
                        img="${imgUrl}">
                    </ebo-list-item>`;

        }

        tableWrapper.innerHTML = html;
        tableWrapper.querySelectorAll("ebo-list-item").forEach((row: HTMLElement) => {
            row.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev).then(r => {})});
            row.addEventListener("click", ev => {this.onRowClicked(ev)});
        });
        this.requestUpdate();
    }

    private getGenreAlias(result: SearchResult) {
        if(result.type != "genreDef")
            return "";
        let genreDef = this.genreDefs?.get(result.item.ref.name?? "__undefined__");
        if(!genreDef)
            return "";
        if(genreDef.replacement != null)
            return ` (${genreDef.replacement})`;
        return "";
    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as EboListItemComp;
        this.dispatchEboEvent("browseResultClick.eboplayer", {"label": row.getAttribute("text")??"", "uri": row.dataset.uri as AllUris, "type": <string>row.dataset.type});
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        let row = ev.currentTarget as EboListItemComp;
        this.dispatchEboEvent("browseResultDblClick.eboplayer", {uri: row.dataset.uri as AllUris});
    }

    private onBreadCrumbClicked(ev: MouseEvent) {
        let btn = ev.currentTarget as HTMLButtonElement;
        this.dispatchEboEvent("breadCrumbClick.eboplayer", {breadcrumbId: parseInt(<string>btn.dataset.id)});
    }

}
