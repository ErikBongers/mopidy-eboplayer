import {EboComponent} from "./EboComponent";
import {EboButton, PressedChangeEvent} from "./eboButton";
import {BrowseFilter, BrowseFilterFlags} from "../modelTypes";
import {RefType} from "../refs";
import {GuiSource} from "../events";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "./eboListButtonBar";
import {text} from "node:stream/consumers";

export class EboBrowseFilterComp extends EboComponent {
    get availableRefTypes(): Set<RefType> {
        return this._availableRefTypes;
    }

    set availableRefTypes(value: Set<RefType>) {
        this._availableRefTypes = value;
        this.requestUpdate();
    }

    static override readonly tagName=  "ebo-browse-filter";
    private static listSource: GuiSource = "browseView";

    get browseFilter(): BrowseFilter {
        return this._browseFilter;
    }

    set browseFilter(value: BrowseFilter) {
        this._browseFilter = value;
        this.requestUpdate();
    }

    private _browseFilter: BrowseFilter;

    private _availableRefTypes: Set<RefType>

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
            #expandFilterBtn {
                margin-left: .5rem;
            }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
<div id="wrapper">
    <div id="filterBox">
        <div id="searchBox" class="flexRow">
            <button id="headerSearchBtn"><img src="images/icons/Magnifier.svg" alt="" class="filterButton whiteIcon"></button>
            <input id="searchText" type="text" autofocus>
            <button id="expandFilterBtn"><i class="fa fa-angle-down"></i></button>
        </div>
        <div id="filterButtons">
            <ebo-button toggle id="filterAlbum" img="images/icons/Album.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterTrack" img="images/icons/Track.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterRadio" img="images/icons/Radio.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterArtist" img="images/icons/Artist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterPlaylist" img="images/icons/Playlist.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button toggle id="filterGenre" img="images/icons/Genre.svg" class="filterButton whiteIcon"></ebo-button>
            <ebo-button id="all"> ALL </ebo-button>
            <button> &nbsp;&nbsp;(?) </button>
        </div>
    </div>    
</div>        
        `;

    constructor() {
        super(EboBrowseFilterComp.styleText, EboBrowseFilterComp.htmlText);
        this._browseFilter = new BrowseFilter();
        this.availableRefTypes = new Set();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestRender();
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
        let inputElement = shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.addEventListener("keyup", (ev: KeyboardEvent) => {
            this._browseFilter.searchText = inputElement.value;
            this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
        });
        let allButton = shadow.getElementById("all") as HTMLButtonElement;
        allButton.addEventListener("click", (ev) => {
            this.onShowAllTypesButtonPress();
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
        this.requestUpdate();
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
        let filterButtons = [...shadow.querySelectorAll("ebo-button")]
            .filter(el => el.id.startsWith("filter")) as EboButton[];
        filterButtons
            .forEach(btn =>
                this.updateFilterButton(btn));
        let inputElement = shadow.getElementById("searchText") as HTMLInputElement;
        inputElement.value = this._browseFilter.searchText;
        let allButton = shadow.getElementById("all") as EboButton;
        let nonPressed = filterButtons.every(btn => !btn.hasAttribute("pressed"));
        if(this.availableRefTypes.size == 1 || nonPressed) {
            allButton.setAttribute("disabled", "");
        } else {
            allButton.removeAttribute("disabled");
        }
    }

    private updateFilterButton(btn: EboButton) {
        let propName = btn.id
                .replace("filter", "").charAt(0).toLowerCase()
               + btn.id.replace("filter", "").slice(1) as RefType;
        if(this._browseFilter[propName])
            btn.setAttribute("pressed", "");
        else
            btn.removeAttribute("pressed");
        if(this.availableRefTypes.has(propName))
            btn.removeAttribute("disabled");
        else
            btn.setAttribute("disabled", "");
        //todo: use toggleAttribute?
    }

    setSearchInfo(text: string) {
        let searchInfo = this.getShadow().getElementById("searchInfo");
        if(searchInfo)
            searchInfo.innerHTML = text;
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

    private onShowAllTypesButtonPress() {
        this.clearFilterButtons();
        this.requestUpdate();
        this.dispatchEboEvent("guiBrowseFilterChanged.eboplayer", {});
    }
}
