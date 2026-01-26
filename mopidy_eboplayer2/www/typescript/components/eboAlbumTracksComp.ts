import {EboComponent} from "./EboComponent";
import {ExpandedAlbumModel, ExpandedStreamModel, TrackUri} from "../modelTypes";
import {EboMenuButton} from "./eboMenuButton";

export class EboAlbumTracksComp extends EboComponent {
    static override readonly tagName=  "ebo-album-tracks-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["img", "selected_track_uri"];

    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.highLightActiveTrack();
    }
    get albumInfo(): ExpandedAlbumModel | null {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel | null) {
        this._albumInfo = value;
        this.requestRender();
    }

    private _activeTrackUri: string | null = null;
    private _albumInfo: ExpandedAlbumModel | null = null;
    private selected_track_uri: string = "";

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
        switch (name) {
            case "selected_track_uri":
                this.selected_track_uri = newValue;
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        let tbody = (shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.albumInfo) {
            this.albumInfo.tracks.forEach(track => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let tdData = tr.appendChild(document.createElement("td"));
                tr.dataset.uri = track.track.uri;
                tdData.innerText = track.track.name?? "--no name--";
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

    override update(shadow:ShadowRoot) {
        shadow.querySelectorAll("tr").forEach(tr => {
            if(tr.dataset.uri == this.selected_track_uri)
                tr.classList.add("selected");
            else
                tr.classList.remove("selected");
        });
    }
}