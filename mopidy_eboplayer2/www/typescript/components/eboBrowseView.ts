import {EboComponent} from "./EboComponent";
import {console_yellow} from "../gui";
import getState from "../playerState";
import {EboButton, PressedChangeEvent} from "./eboButton";

export class EboBrowseView extends EboComponent {
    static readonly tagName=  "ebo-browse-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

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
            </div>        
        `;

    constructor() {
        super(EboBrowseView.styleText, EboBrowseView.htmlText);
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

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
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
        //todo: put the above in EboComponent?
        this.shadow.getElementById("headerSearchBtn").addEventListener("click", async (ev) => {
            await testDataGrab();
        });

        let browseFilters = getBrowseFilters();
        this.shadow.querySelectorAll("ebo-button")
            .forEach(btn =>
                this.renderFilterButton(btn, browseFilters));
    }

    private renderFilterButton(btn: Element, browseFilters: BrowseFilter) {
        if (btn.id.startsWith("filter")) {
            let propName = btn.id
                    .replace("filter", "").charAt(0).toLowerCase()
                + btn.id.replace("filter", "").slice(1);
            btn.setAttribute("pressed", browseFilters[propName].toString());
        }

        btn.addEventListener("pressedChange", async (ev: PressedChangeEvent) => {
            let btn: EboButton = ev.target as EboButton;
            let propName = btn.id.replace("filter", "");
            propName = propName.charAt(0).toLowerCase() + propName.slice(1);
            let browseFilters = getBrowseFilters();
            browseFilters[propName] = !browseFilters[propName];
            saveBrowseFilters(browseFilters);
        });
    }
}

interface BrowseFilter {
    album: boolean;
    track: boolean;
    radio: boolean;
    artist: boolean;
    playlist: boolean;
    genre: boolean;
}

//todo: move to controller -> model -> state
const BROWSE_FILTERS_KEY = "browseFilters";

function getBrowseFilters(): BrowseFilter {
    let browseFilters = localStorage.getItem(BROWSE_FILTERS_KEY);
    if(browseFilters) {
        return JSON.parse(browseFilters);
    }
    return {
        album: false,
        track: false,
        radio: false,
        artist: false,
        playlist: false,
        genre: false
    }
}

function saveBrowseFilters(browseFilters: BrowseFilter) {
    localStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify(browseFilters));
}

async function testDataGrab() {
    // returns "Files" and "Local media"
    let roots = await getState().getController().getRootDirs();
    console_yellow("Roots:");
    console.log(roots);
    let subDir1 = await getState().getController().browse(roots[1].uri);
    console_yellow("subDir1:");
    console.log(subDir1);
    let allTracks = await getState().getController().browse("local:directory?type=track");
    console_yellow("allTracks:");
    console.log(allTracks);
    let allAlbums = await getState().getController().browse("local:directory?type=album");
    console_yellow("allAlbums:");
    console.log(allAlbums);
    let artists = await getState().getController().getTracksforArtist();
    console_yellow("artists:");
    console.log(artists);
}
