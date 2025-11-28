import {EboComponent} from "./EboComponent";
import {console_yellow} from "../gui";
import getState from "../playerState";
import {EboButton, PressedChangeEvent} from "./eboButton";

import {BrowseFilter} from "../modelTypes";

export class EboBrowseComp extends EboComponent {
    get refsLoaded(): boolean {
        return this._refsLoaded;
    }

    set refsLoaded(value: boolean) {
        this._refsLoaded = value;
        this.update();
    }
    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }
    set browseFilter(value: BrowseFilter) {
        this._browseFilter = value;
        this.update();
    }

    private _refsLoaded: boolean = false;

    private _browseFilter: BrowseFilter;
    static readonly tagName=  "ebo-browse-view";
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
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
            <div id="wrapper">
                <div id="searchBox">
                    <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIconFilter"></button>
                    <input id="searchText" type="text" value="sdfsdf" autofocus>
                </div>
                <div id="filterButtons">
                    <ebo-button id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <ebo-button id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <ebo-button id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <ebo-button id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <ebo-button id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <ebo-button id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIconFilter"></ebo-button>
                    <button> X </button>
                </div>
                
                <div id="searchResults">
                    TODO: show "loading data..." while refs have not been loaded and "searching..." while refiltering.
                    Keep the old results while filtering to avoid flicker.
                    BATCH the filter requests!!!                
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
        this._browseFilter = {
            searchText: "",
            track: false,
            artist: false,
            genre: false,
            radio: false,
            playlist: false,
            album: false,
        };
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
            case "img":
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
        console_yellow("EboBrowseComponent: onConnected");
    }

    setFocusAndSelect() {
        let searchText = this.shadow.getElementById("searchText") as HTMLInputElement;
        searchText.focus();
        searchText.select();
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.shadow.appendChild(fragment);
        this.shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {
            //todo: is this button even needed?
        });
        let inputElement = this.shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.addEventListener("keydown", (ev: KeyboardEvent)=> {
            this._browseFilter.searchText = inputElement.value;
            this.dispatchEvent(this.browseFilterChangedEvent);
        });
        this.shadow.querySelectorAll("ebo-button")
            .forEach(btn =>
                btn.addEventListener("pressedChange", async (ev: PressedChangeEvent) => {
                    let btn: EboButton = ev.target as EboButton;
                    let propName = btn.id.replace("filter", "");
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1);
                    this.browseFilter[propName] = !this.browseFilter[propName];
                    this.dispatchEvent(this.browseFilterChangedEvent);
                })
            );
        this.update();
    }

    updateWhenConnected() {
        this.shadow.querySelectorAll("ebo-button")
            .forEach(btn =>
                this.updateFilterButton(btn));
        let inputElement = this.shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.value = this._browseFilter.searchText;
        let searchResults = this.shadow.getElementById("searchResults");
        if(!this.refsLoaded) {
            searchResults.innerHTML = "Loading data...";
            return;
        } else {
            searchResults.innerHTML = "Filtering...";
        }
    }

    private updateFilterButton(btn: Element) {
        if (btn.id.startsWith("filter")) {
            let propName = btn.id
                    .replace("filter", "").charAt(0).toLowerCase()
                + btn.id.replace("filter", "").slice(1);
            btn.setAttribute("pressed", this._browseFilter[propName].toString());
        }
    }

    renderResults() {
        let searchResults = this.shadow.getElementById("searchResults");
        searchResults.innerHTML = "Results";
    }
}
