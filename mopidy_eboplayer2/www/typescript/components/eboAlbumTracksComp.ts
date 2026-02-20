import {EboComponent} from "./EboComponent";
import {ExpandedAlbumModel, ExpandedStreamModel, TrackUri} from "../modelTypes";
import {EboMenuButton} from "./eboMenuButton";
import {EboButton} from "./eboButton";

export class EboAlbumTracksComp extends EboComponent {
    get selected_track_uris(): TrackUri[] {
        return this._selected_track_uris;
    }

    set selected_track_uris(value: TrackUri[]) {
        this._selected_track_uris = value;
        this.requestUpdate();
    }
    static override readonly tagName=  "ebo-album-tracks-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["img"];

    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.highLightActiveTrack();
    }
    get albumInfo(): ExpandedAlbumModel | null {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel | null) {
        if(value != this._albumInfo) {
            this._albumInfo = value;
            this.requestRender();
        }
    }

    private _activeTrackUri: string | null = null;
    private _albumInfo: ExpandedAlbumModel | null = null;
    private _selected_track_uris: TrackUri[] = [];

    constructor() {
        super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);

        this.albumInfo = null;
        this.requestRender();
    }

    static styleText = `
            <style>
                :host { 
                    display: flex;
                    text-align: start;
                } 
                #wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                .info {
                    font-size: .7em;
                }
                #tableScroller {
                    overflow: scroll;
                    scrollbar-width: none;
                    height: 100%;    
                }
                #tracksTable {
                    width: 100%;
                    border-collapse: collapse;
                    tr {
                        border-bottom: 1px solid #ffffff80;
                    }
                }
                .selected {
                    background-color: var(--selected-background);
                }
            </style>
        `;
        static htmlText = `
            <div id="wrapper">
                <div id="tableScroller">
                    <table id="tracksTable">
                        <colgroup>
                            <col span="1" style="width: auto;">
                            <col span="1" style="width: 1em;">                        
                            <col span="1" style="width: 1em;">                        
                        </colgroup>
                        <tbody>
                        </tbody>                
                    </table>
                </div>          
            </div>
            <dialog popover id="albumTrackPopup">
              Tadaaa....
            </dialog>        
        `;

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
        }

    override async render(shadow:ShadowRoot) {
        let tbody = (shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.albumInfo) {
            (await this.albumInfo.getTrackModels()).forEach(track => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let tdData = tr.appendChild(document.createElement("td"));
                tr.dataset.uri = track.track.uri;
                tdData.innerText = track.track.name?? "--no name--";
                let tdHeart = tr.appendChild(document.createElement("td"));
                tdHeart.innerHTML = `
                    <ebo-button toggl class="heartButton">
                        <i slot="off" class="fa fa-heart-o"></i>
                        <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>
                    </ebo-button>
                `;
                let tdButton = tr.appendChild(document.createElement("td"));
                tdButton.innerHTML = `
                    <ebo-menu-button >
                        <div class="flexColumn">
                            <button id="" class="roundBorder trackButton">Set genre</button>
                            <button id="" class="roundBorder trackButton">Add to playlist</button>
                            <button id="" class="roundBorder trackButton">Rename</button>
                            <button id="" class="roundBorder trackButton">Artist ></button>
                            <button id="" class="roundBorder trackButton">Album ></button>
                            <div class="flexRow">
                                <button id="addTrack" class="roundBorder trackButton">
                                    <i class="fa fa-plus"></i>
                                </button>
                                <button id="playTrack" class="roundBorder trackButton">
                                    <i class="fa fa-play"></i>
                                </button>
                            </div>
                        </div>  
                    </ebo-menu-button>`;
                tdButton.querySelector("#addTrack")?.addEventListener("click", (ev) => {
                    let menuButton = ev.target as HTMLElement;
                    let button = menuButton.closest("ebo-menu-button") as EboMenuButton;
                    button.closeMenu();
                    this.dispatchEboEvent("addTrackClicked.eboplayer", {uri: track.track.uri as TrackUri});
                });
                tdButton.querySelector("#playTrack")?.addEventListener("click", (ev) => {
                    let menuButton = ev.target as HTMLElement;
                    let button = menuButton.closest("ebo-menu-button") as EboMenuButton;
                    button.closeMenu();
                    this.dispatchEboEvent("playTrackClicked.eboplayer", {uri: track.track.uri as TrackUri});
                });
                tr.addEventListener("click", (ev) => {
                    tr.classList.toggle("selected");
                    this.dispatchEboEvent("trackClicked.eboplayer", {uri: tr.dataset.uri as TrackUri});
                });
                let heartButton = tdHeart.querySelector("ebo-button.heartButton") as EboButton;
                heartButton.addEboEventListener("pressedChange.eboplayer", (ev) => {
                    this.dispatchEboEvent("favoriteToggle.eboplayer", {"uri": track.track.uri});
                });
            });
        }
        this.highLightActiveTrack();
        this.requestUpdate();
    }

    private highLightActiveTrack() {
        if(!this._activeTrackUri)
            return;
        let tr = this.getShadow().querySelector(`tr[data-uri="${this._activeTrackUri}"]`) as HTMLTableRowElement;
        if(tr) {
            tr.classList.add("current", "textGlow");
        }
    }

    override async update(shadow:ShadowRoot) {
        shadow.querySelectorAll("tr").forEach(tr => {
            if(this._selected_track_uris.includes(tr.dataset.uri as TrackUri)) {
                tr.classList.add("selected");
            } else
                tr.classList.remove("selected");
        });
        await this.updateFavorites();
    }

    private getSelectedUris() {
        return [...this.getShadow().querySelectorAll("tr.selected") as NodeListOf<HTMLTableRowElement>]
            .map((tr) => {
                return tr.dataset.uri;
            })
            .filter((uri: string) => uri != null && uri != "" && uri != undefined) as TrackUri[];
    }

    async updateFavorites(){
        let trs = this.getShadow().querySelectorAll("#tracksTable tr") as NodeListOf<HTMLTableRowElement>;
        for (const tr of trs) {
            let isFavorite = await this.albumInfo?.isTrackFavorite(tr.dataset.uri as TrackUri)?? false;
            let eboButton = tr.querySelector("ebo-button.heartButton") as EboButton;
            eboButton.toggleAttribute("pressed", isFavorite);
        }
    }
}