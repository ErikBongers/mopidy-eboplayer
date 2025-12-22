import {EboComponent} from "./EboComponent";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";
import {EboplayerEvents, ExpandedAlbumModel, ExpandedStreamModel} from "../modelTypes";


export class EboBigAlbumComp extends EboComponent {
    get activeTrackUri(): string | null {
        return this._activeTrackUri;
    }
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.onActiveTrackChanged();
    }
    get albumInfo() {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel) {
        this._albumInfo = value;
        this.update();
    }

    private _streamInfo?: ExpandedStreamModel;
    get streamInfo(): ExpandedStreamModel {
        return this._streamInfo;
    }
    set streamInfo(value: ExpandedStreamModel) {
        this._streamInfo = value;
        this.update();
    }

    private _activeTrackUri: string | null = null;
    static readonly tagName=  "ebo-big-album-view";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "extra", "img", "disabled"
    ];
    private name: string = "";
    private extra: string = "";
    private img: string  = "";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: ExpandedAlbumModel;

    static styleText= `
            <style>
                :host { 
                    display: flex;
                } 
                h3 {
                    margin-block-start: .5em;
                    margin-block-end: .5em;
                }
                .albumCoverContainer {
                    display: flex;
                    flex-direction: column;
                    align-content: center;
                    overflow: hidden;
                    flex-wrap: wrap;
                }
                img {
                    width: 90vw;
                    height: 45vh;
                    object-fit: contain;
                }
                ebo-progressbar {
                    margin-top: .5em;
                }
                #wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                    #bottom {
                        overflow: hidden;
                    }
                    #buttons {
                        display: flex;
                        flex-direction: row;
                        margin-bottom: .5em;
                    }
                }
                #wrapper.front {
                    #back {
                        display: none;
                    }                
                }
                #wrapper.back {
                    #front {
                        position: absolute;
                        display: none;
                    }                
                }
                .info {
                    font-size: .7em;
                }
                #albumTableWrapper {
                    height: 100%;
                }
                ebo-album-tracks-view {
                    height: 100%;
                }
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
            <div id="wrapper" class="front">
                <div id="top">
                    <div class="albumCoverContainer">
                        <img id="image" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                    <div id="buttons">
                        <button id="btnPlay" class="roundBorder">Play</button>
                        <button id="btnAdd" class="roundBorder">Add</button>
                    </div>                
                </div>
                <div id="bottom">
                    <div id="albumTableWrapper">
                        <ebo-album-tracks-view img="" ></ebo-album-tracks-view>
                    </div>
                </div>
            </div>        
        `;

    constructor() {
        super(EboBigAlbumComp.styleText, EboBigAlbumComp.htmlText);
        this.albumInfo = undefined;
        this.albumClickEvent = new CustomEvent("albumClick", {
            bubbles: true,
            cancelable: false,
            composed: true, //needed to 'break' out of the shadow.
            detail: "todo: tadaaa!"
        });
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboBigAlbumComp.progressBarAttributes.includes(name)) {
            this[name] = newValue;
            return;
        }
        switch (name) {
            case "name":
            case "extra":
            case "img":
                this[name] = newValue;
                break;
        }
        this.update();
        }

    renderPrepared(shadow:ShadowRoot) {
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            this.onBtnPlayClick();
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            this.onBtnAddClick();
        });
        this.update();
    }

    private onBtnPlayClick() {
        this.dispatchEvent(new Event(EboplayerEvents.playAlbumClicked));
    }

    private onBtnAddClick() {
        this.dispatchEvent(new Event(EboplayerEvents.addAlbumClicked));
    }

    override updateWhenRendered(shadow:ShadowRoot) {
        ["name", "extra"].forEach(attName => {
            shadow.getElementById(attName).innerHTML = this[attName];
        });
        let tracksComp = shadow.querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.albumInfo = this.albumInfo;
        tracksComp.streamInfo = this.streamInfo;
        let img = shadow.getElementById("image") as HTMLImageElement;
        if(this.img != "") {
            img.style.visibility = "";
            img.src = this.img;
        } else
            img.style.visibility = "hidden";
    }

    private onActiveTrackChanged() {
        let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.activeTrackUri = this.activeTrackUri;
    }
}