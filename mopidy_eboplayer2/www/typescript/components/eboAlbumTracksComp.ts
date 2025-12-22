import {EboComponent} from "./EboComponent";
import {ExpandedAlbumModel, ExpandedStreamModel} from "../modelTypes";

export class EboAlbumTracksComp extends EboComponent {
    private _streamInfo?: ExpandedStreamModel;
    get streamInfo(): ExpandedStreamModel {
        return this._streamInfo;
    }

    set streamInfo(value: ExpandedStreamModel) {
        this._streamInfo = value;
        this.render();
    }
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.highLightActiveTrack();
    }
    get albumInfo() {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel) {
        this._albumInfo = value;
        this.render();
    }

    private _activeTrackUri: string | null = null;

    static readonly tagName=  "ebo-album-tracks-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "img",
    ];
    private _albumInfo?: ExpandedAlbumModel;


    constructor() {
        super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);

        this.albumInfo = undefined;
        this.render();
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
    attributeReallyChangedCallback(_name: string, _oldValue: string, _newValue: string) {
        this.render();
        }

    renderPrepared(shadow:ShadowRoot) {
        this.renderTrackList(shadow);
    }

    renderTrackList(shadow:ShadowRoot) {
        let tbody = (shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.albumInfo) {
            this.albumInfo.tracks.forEach(track => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let tdData = tr.appendChild(document.createElement("td"));
                tr.dataset.uri = track.track.uri;
                tdData.innerText = track.track.name;
                let tdButton = tr.appendChild(document.createElement("td"));
                tdButton.innerHTML = `<ebo-menu-button ></ebo-menu-button>`;
            });
        }

        if(this.streamInfo) {
            this.streamInfo.historyLines.forEach(lineGroup => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let td = tr.appendChild(document.createElement("td"));
                td.innerHTML = lineGroup.join("<br>");
                td.classList.add("selectable");
            });
        }
        this.highLightActiveTrack();
    }

    private highLightActiveTrack() {
        if(!this._activeTrackUri)
            return;
        let tr = this.getShadow().querySelector(`tr[data-uri="${this._activeTrackUri}"]`) as HTMLTableRowElement;
        if(tr) {
            tr.classList.add("current", "textGlow");
        }
    }
}