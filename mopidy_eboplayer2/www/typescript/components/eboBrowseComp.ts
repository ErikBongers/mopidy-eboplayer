import {EboComponent} from "./EboComponent";
import getState from "../playerState";
import {EboButton, PressedChangeEvent} from "./eboButton";

import {BreadCrumbBrowseFilter, BreadCrumbRef, BrowseFilter, EboplayerEvents, FilterBreadCrumbType} from "../modelTypes";
import {LIBRARY_PROTOCOL} from "../controller";
import {SearchResult} from "../refs";

class EboBrowseComp extends EboComponent {
    static readonly tagName=  "ebo-browse-view";

    get breadCrumbs(): FilterBreadCrumbType[] {
        return this._breadCrumbs;
    }
    set breadCrumbs(value: FilterBreadCrumbType[]) {
        this._breadCrumbs = value;
        this.renderBreadCrumbs(); // don't render all, as user may be typing a search text.
    }

    private _breadCrumbs: FilterBreadCrumbType[] = [];


    get results(): SearchResult[] {
        return this._results;
    }

    set results(value: SearchResult[]) {
        this._results = value;
        this.renderResults(); // don't render all, as user may be typing a search text.
    }

    private _results: SearchResult[] = [];

    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }

    set browseFilter(value: BrowseFilter) {
        if(JSON.stringify(this._browseFilter) == JSON.stringify(value))
            return;
        this._browseFilter = value;
        this.render();
    }

    private _browseFilter: BrowseFilter;

    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

    private readonly browseFilterChangedEvent: CustomEvent<unknown>;

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
                    border-bottom: 1px solid #ffffff80;
                    & input {
                        flex-grow: 1;
                        background-color: transparent;
                        color: white;
                        border: none;
                        &:focus {
                            outline: none;
                        }
                    }
                }
                .filterButton {
                    width: 2em;
                    height: 2em;
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

            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
<div id="wrapper">
    <div id="searchBox">
        <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIconFilter"></button>
        <input id="searchText" type="text" autofocus>
    </div>
    <div id="filterButtons">
        <ebo-button id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIconFilter"></ebo-button>
        <ebo-button id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIconFilter"></ebo-button>
        <ebo-button id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIconFilter"></ebo-button>
        <ebo-button id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIconFilter"></ebo-button>
        <ebo-button id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIconFilter"></ebo-button>
        <ebo-button id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIconFilter"></ebo-button>
        <button> ALL </button>
        <button> &nbsp;&nbsp;(i) </button>
    </div>
    <div id="breacCrumbs"></div>
    <div id="searchResults">
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
        this.browseFilterChangedEvent = new CustomEvent("browseFilterChanged", {
            bubbles: true,
            cancelable: false,
            composed: true, //needed to 'break' out of the shadow.
            detail: "todo"
        });
        this._browseFilter = new BrowseFilter();
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
                this[name] = newValue;
                break;
            case "enabled":
            case "show_back":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    onConnected() {
    }

    setFocusAndSelect() {
        let searchText = this.shadow.getElementById("searchText") as HTMLInputElement;
        searchText?.focus();
        searchText?.select();
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.shadow.appendChild(fragment);
        this.shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {
            //todo: is this button even needed?
        });
        this.renderBrowseFilter();
        this.renderBreadCrumbs();
        this.renderResults();
        this.update();
    }

    private renderBrowseFilter() {
        let inputElement = this.shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.addEventListener("keyup", (ev: KeyboardEvent) => {
            this._browseFilter.searchText = inputElement.value;
            this.dispatchEvent(this.browseFilterChangedEvent);
        });
        this.shadow.querySelectorAll("ebo-button")
            .forEach(btn => {
                btn.addEventListener("pressedChange", async (ev: PressedChangeEvent) => {
                    this.onFilterButtonPress(ev);
                });
                btn.addEventListener(EboplayerEvents.longPress, (ev) => {
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
        this.update();
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
        this.browseFilter[propName] = !this.browseFilter[propName];
        this.dispatchEvent(this.browseFilterChangedEvent);
    }

    updateWhenRendered() {
        this.shadow.querySelectorAll("ebo-button")
            .forEach(btn =>
                this.updateFilterButton(btn));
        let inputElement = this.shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.value = this._browseFilter.searchText;
    }

    private updateFilterButton(btn: Element) {
        if (btn.id.startsWith("filter")) {
            let propName = btn.id
                    .replace("filter", "").charAt(0).toLowerCase()
                + btn.id.replace("filter", "").slice(1);
            btn.setAttribute("pressed", this._browseFilter[propName].toString());
        }
    }

    setSearchInfo(text: string) {
        let searchInfo = this.shadow.getElementById("searchInfo");
        if(searchInfo)
            searchInfo.innerHTML = text;
    }

    renderBreadCrumbs() {
        let breadCrumbsDiv = this.shadow.getElementById("breacCrumbs");
        breadCrumbsDiv.innerHTML = "Ĥ > " + (this.breadCrumbs)
            .map(crumb => this.renderBreadcrumb(crumb))
            .join(" > ");

        breadCrumbsDiv.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", (ev)  => {
                this.onBreadCrumbClicked(ev);
            });
        })
    }

    private renderBreadcrumb(crumb: FilterBreadCrumbType) {
        if(crumb instanceof BreadCrumbRef)
            return `<button data-id="${crumb.id}" class="uri">${crumb.label}</button>`; //todo: have the type of uri and add a little icon?
        else if(crumb instanceof BreadCrumbBrowseFilter)
            return `<button data-id="${crumb.id}" class="filter">"${crumb.label}"</button>`;
        //todo: click event.
    }

    renderResults() {
        if(!this.rendered) //may be called directly, before initialization.
            return;
        this.setSearchInfo("");

        let table = this.shadow.getElementById("searchResultsTable") as HTMLTableElement;
        let body = table.tBodies[0];
        body.innerHTML = "";

        if(this.results.length == 0)
            return;


        let resultsHtml = this.results
            .map(result => {
                let refType = result.ref.type as string;
                if(refType == "directory") {
                    if(result.ref.uri.includes( LIBRARY_PROTOCOL+"directory?genre="))
                        refType = "genre";
                }
                return `
                    <tr data-uri="${result.ref.uri}" data-type="${refType}">
                    <td>${result.ref.name}</td>
                    <td>...</td>
                    </tr>`;
            })
            .join("\n");
        body.innerHTML = resultsHtml;
        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev).then(r => {})});
            tr.addEventListener("click", ev => {this.onRowClicked(ev)});
        });

    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        getState().getController().diveIntoBrowseResult(row.cells[0].innerText, row.dataset.uri, row.dataset.type);
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        await getState().getController().clearListAndPlay(row.dataset.uri);
    }


    private onBreadCrumbClicked(ev: MouseEvent) {
        let btn = ev.currentTarget as HTMLButtonElement;
        getState().getController().resetToBreadCrumb(parseInt(btn.dataset.id)); //todo rename to breadCrumbId.
    }

}

export default EboBrowseComp
