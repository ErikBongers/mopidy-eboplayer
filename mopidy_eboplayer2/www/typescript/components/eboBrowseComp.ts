import {EboComponent} from "./EboComponent";
import {EboButton, PressedChangeEvent} from "./eboButton";
import {AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, BrowseFilterFlags, FilterBreadCrumb, GenreDef} from "../modelTypes";
import {EmptySearchResults, RefType, SearchResults, TypedRef} from "../refs";
import {GuiSource} from "../events";
import {assertUnreachable} from "../global";
import {EboListButtonBar, ListButtonStates} from "./eboListButtonBar";
import {text} from "node:stream/consumers";
import models from "../../js/mopidy";
import Ref = models.Ref;

export class EboBrowseComp extends EboComponent {
    get genreDefs(){
        return this._genreDefs;
    }

    set genreDefs(value: Map<string, GenreDef>) {
        this._genreDefs = value;
    }
    get btn_states(): ListButtonStates {
        return this._btn_states;
    }

    set btn_states(value: ListButtonStates) {
        this._btn_states = value;
        this.requestUpdate();
    }
    static override readonly tagName=  "ebo-browse-view";
    private static listSource: GuiSource = "browseView";

    private _btn_states: ListButtonStates = {
        add: "hide",
        play: "hide",
        edit: "hide",
        replace: "hide",
        save: "hide",
        new_playlist: "hide"
    };

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
        this.requestRender();
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
                display: flex;
                flex-direction: row;
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
            #searchResultsTable {
                width: 100%;
                border-collapse: collapse;
            }
            #tableWrapper {
                height: 100%;
                width: 100%;
                overflow: scroll;
                scrollbar-width: none;
                td {
                    padding-top: .2em;
                    padding-bottom: .2em;
                }
            }
            #searchResults {
                height: 100%;
                display: flex;
                flex-direction: column;
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
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
<div id="wrapper">
    <div id="breadCrumbs"></div>
    <div id="filterBox">
        <div id="searchBox">
            <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIcon"></button>
            <input id="searchText" type="text" autofocus>
        </div>
        <div id="filterButtons">
            <ebo-button id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIcon"></ebo-button>
            <button> ALL </button>
            <button> &nbsp;&nbsp;(?) </button>
        </div>
    </div>    
    <div id="searchResults">
        <ebo-list-button-bar list_source="${this.listSource}"></ebo-list-button-bar>
        <div id="searchInfo">
        </div>  
        <div id="tableWrapper" class="">
            <table id="searchResultsTable">
                <colgroup>
                    <col span="1" style="width: auto;">
                    <col span="1" style="width: 1em;">
                </colgroup>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>        
        `;

    constructor() {
        super(EboBrowseComp.styleText, EboBrowseComp.htmlText);
        this._browseFilter = new BrowseFilter();
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

    override onConnected() {
    }

    setFocusAndSelect() {
        let searchText = this.getShadow().getElementById("searchText") as HTMLInputElement;
        searchText?.focus();
        searchText?.select();
    }

    render(shadow:ShadowRoot) {
        // @ts-ignore
        shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {
            //todo: is this button even needed?
        });
        this.renderBrowseFilter(shadow);
        this.renderBreadCrumbs();
        this.renderResults();
        this.requestUpdate();
    }

    private renderBrowseFilter(shadow: ShadowRoot) {
        let inputElement = shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.addEventListener("keyup", (ev: KeyboardEvent) => {
            this._browseFilter.searchText = inputElement.value;
            this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
        });
        shadow.querySelectorAll("ebo-button")
            .forEach((btn: EboButton) => {
                btn.addEventListener("pressedChange", async (ev: PressedChangeEvent) => {
                    this.onFilterButtonPress(ev);
                });
                btn.addEboEventListener("longPress.eboplayer", (ev) => {
                    this.onFilterButtonLongPress(ev);
                });
                btn.addEventListener("dblclick", (ev) => {
                    this.onFilterButtonDoubleClick(ev);
                })
            });
    }

    private onFilterButtonLongPress(ev: Event) {
        this.setSingleButton(ev);
    }

    private onFilterButtonDoubleClick(ev: Event) {
        this.setSingleButton(ev);
    }

    private setSingleButton(ev: Event) {
        this.clearFilterButtons();
        this.toggleFilterButton(ev.target as EboButton);
        this.requestUpdate();
    }

    private clearFilterButtons() {
        this.browseFilter.genre = false;
        this.browseFilter.radio = false;
        this.browseFilter.playlist = false;
        this.browseFilter.album = false;
        this.browseFilter.track = false;
        this.browseFilter.artist = false;
    }

    private onFilterButtonPress(ev: PressedChangeEvent) {
        let btn: EboButton = ev.target as EboButton;
        this.toggleFilterButton(btn);
    }

    private toggleFilterButton(btn: EboButton) {
        let propName = btn.id.replace("filter", "");
        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
        this.browseFilter[propName as keyof BrowseFilterFlags] = !this.browseFilter[propName as keyof BrowseFilterFlags];
        this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
    }

    override update(shadow:ShadowRoot) {
        [...shadow.querySelectorAll("ebo-button")]
            .filter(el => el.id.startsWith("filter"))
            .forEach(btn =>
                this.updateFilterButton(btn as HTMLButtonElement));
        let inputElement = shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.value = this._browseFilter.searchText;
        let listButtonBar = shadow.querySelector("ebo-list-button-bar") as EboListButtonBar;
        listButtonBar.btn_states = this.btn_states;
    }

    private updateFilterButton(btn: HTMLButtonElement) {
        let propName = btn.id
                .replace("filter", "").charAt(0).toLowerCase()
               + btn.id.replace("filter", "").slice(1) as RefType;
        btn.setAttribute("pressed", this._browseFilter[propName].toString());
        if(this.results)
            btn.setAttribute("disabled", (!this.results.availableRefTypes.has(propName)).toString());
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
        return assertUnreachable(crumb);
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
    renderResults() {
        if(!this.isRendered) //may be called directly, before initialization.
            return;
        this.setSearchInfo("");

        let table = this.getShadow().getElementById("searchResultsTable") as HTMLTableElement;
        let body = table.tBodies[0];
        body.innerHTML = "";

        if(this.results.refs.length == 0)
            return;

        body.innerHTML = this.results.refs
            .map(result => {
                let refType = result.item.type;
                return `
                    <tr data-uri="${result.item.ref.uri}" data-type="${refType}">
                    <td>${result.item.ref.name + this.getGenreAlias(result.item)}</td>
                    <td>...</td>
                    </tr>`;
            })
            .join("\n");
        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev).then(r => {})});
            tr.addEventListener("click", ev => {this.onRowClicked(ev)});
        });
        this.requestUpdate();
    }

    private getGenreAlias(ref: TypedRef) {
        if(ref.type != "genre")
            return "";
        let genreDef = this.genreDefs?.get(ref.ref.name?? "__undefined__");
        if(!genreDef)
            return "";
        if(genreDef.replacement != null)
            return ` (${genreDef.replacement})`;
        return "";
    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        this.dispatchEboEvent("browseResultClick.eboplayer", {"label": row.cells[0].innerText, "uri": row.dataset.uri as AllUris, "type": <string>row.dataset.type});
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        this.dispatchEboEvent("browseResultDblClick.eboplayer", {uri: row.dataset.uri as AllUris});
    }

    private onBreadCrumbClicked(ev: MouseEvent) {
        let btn = ev.currentTarget as HTMLButtonElement;
        this.dispatchEboEvent("breadCrumbClick.eboplayer", {breadcrumbId: parseInt(<string>btn.dataset.id)});
    }
}
