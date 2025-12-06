import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone} from "../views/bigTrackViewUriAdapter";
import {console_yellow} from "../gui";
import getState from "../playerState";

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
    private img: string  = "images/default_cover.png";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: AlbumData;


    constructor() {
        super(EboAlbumTracksComp.styleText, EboAlbumTracksComp.htmlText);

        this.albumInfo = AlbumNone;
        this.render();
        this.albumClickEvent = new CustomEvent("albumClick", {
            bubbles: true,
            cancelable: false,
            composed: true, //needed to 'break' out of the shadow.
            detail: "todo"
        });
    }

    static styleText = `
            <style>
                :host { 
                    display: flex;
                    text-align: start;
                } 
                h3 {
                    margin-block-start: 0;
                    margin-block-end: 0;
                }
                img {
                    width: 50px;
                    height: 50px;
                    object-fit: contain;
                    margin-right: .5em;
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
                #albumInfoWrapper {
                    display: flex;
                    flex-direction: row;
                    margin-top: .3em;
                    align-content: center;
                }
                #albumInfo {
                    flex-grow: 1;
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
                <div id="albumInfoWrapper">
                    <img src="" id="img" alt="">
                    <div id="albumInfo">
                        <h3 id="albumTitle"></h3>                    
                    </div>
                    <button><i class="fa fa-ellipsis-v"></i></button>
                </div>
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
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
        }
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        this.shadow.appendChild(this.divTemplate.content.cloneNode(true));
        let img = this.shadow.getElementById("img") as HTMLImageElement;
        img.src = this.img;
        let albumTitle = this.shadow.getElementById("albumTitle") as HTMLElement;
        switch (this.albumInfo.type) {
            case AlbumDataType.Loaded:
                albumTitle.innerText = this.albumInfo.albumTrack.album.name;
                break;
            case AlbumDataType.StreamLinesLoaded:
                albumTitle.innerText = this.albumInfo.albumTrack.name;
                break;
        }
        img.addEventListener("click", (ev) => {
            this.dispatchEvent(this.albumClickEvent);
        });

        this.renderTrackList();
    }

    renderTrackList() {
        let tbody = (this.shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        let title = this.shadow.querySelector("#albumTitle") as HTMLTitleElement;
        switch (this.albumInfo?.type) {
            case AlbumDataType.Loaded:
                title.innerText = this.albumInfo.albumTrack.album.name;
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