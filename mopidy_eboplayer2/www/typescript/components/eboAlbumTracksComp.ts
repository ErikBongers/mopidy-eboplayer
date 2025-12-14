import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone} from "../modelTypes";

export class EboAlbumTracksComp extends EboComponent {
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.highLightActiveTrack();
    }
    get albumInfo(): AlbumData {
        return this._albumInfo;
    }

    set albumInfo(value: AlbumData) {
        this._albumInfo = value;
        this.render();
    }

    private _activeTrackUri: string | null = null;

    static readonly tagName=  "ebo-album-tracks-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "img",
    ];
    private _albumInfo: AlbumData;


    constructor() {
        super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);

        this.albumInfo = AlbumNone;
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
                    margin-left: 1em;
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
        `;

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.render();
        }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        this.shadow.appendChild(this.divTemplate.content.cloneNode(true));
        this.renderTrackList();
    }

    renderTrackList() {
        let tbody = (this.shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        switch (this.albumInfo?.type) {
            case AlbumDataType.Loaded:
                this.albumInfo.tracks.forEach(track => {
                    let tr = tbody.appendChild(document.createElement("tr"));
                    let td = tr.appendChild(document.createElement("td"));
                    tr.dataset.uri = track.uri;
                    td.innerText = track.name;
                });
                break;
            case AlbumDataType.StreamLinesLoaded:
                this.albumInfo.lines.forEach(lineGroup => {
                    let tr = tbody.appendChild(document.createElement("tr"));
                    let td = tr.appendChild(document.createElement("td"));
                    td.innerHTML = lineGroup.join("<br>");
                    td.classList.add("selectable");
                });
                break;
        }
        this.highLightActiveTrack();
    }

    private highLightActiveTrack() {
        if(!this._activeTrackUri)
            return;
        let tr = this.shadow.querySelector(`tr[data-uri="${this._activeTrackUri}"]`) as HTMLTableRowElement;
        if(tr) {
            tr.classList.add("current", "textGlow");
        }
    }
}