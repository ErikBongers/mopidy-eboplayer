import {EboComponent} from "./EboComponent";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";
import {AlbumData, AlbumDataType, AlbumNone} from "../modelTypes";
import getState from "../playerState";

export class EboBigAlbumComp extends EboComponent {
    get activeTrackUri(): string | null {
        return this._activeTrackUri;
    }
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.onActiveTrackChanged();
    }
    get albumInfo(): AlbumData {
        return this._albumInfo;
    }

    set albumInfo(value: AlbumData) {
        this._albumInfo = value;
        this.render();
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
    private img: string  = "images/default_cover.png";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: AlbumData;

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
                }
                img {
                    width: 100%;
                    height: 100%;
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
                    #front {
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                    }
                    #back {
                        width: 100%;
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
                        <img id="img" src="images/default_cover.png" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                    <div>
                        <button id="btnPlay" class="roundBorder">Play</button>
                        <button id="btnAdd" class="roundBorder">Add</button>
                    </div>                
                </div>
                <div id="bottom">
                    <div id="albumTableWrapper">
                        <ebo-album-tracks-view img="images/default_cover.png" ></ebo-album-tracks-view>
                    </div>
                </div>
            </div>        
        `;

    constructor() {
        super(EboBigAlbumComp.styleText, EboBigAlbumComp.htmlText);
        this.albumInfo = AlbumNone;
        this.render();
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
        this.render();
        }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        ["name", "extra"].forEach(attName => {
            fragment.getElementById(attName).innerHTML = this[attName];
        });
        //todo: image.
        this.shadow.appendChild(fragment);
        let tracksComp = this.shadow.querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.albumInfo = this.albumInfo;
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            this.onBtnPlayClick();
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            this.onBtnAddClick();
        });
        this.update();
    }

    private onBtnPlayClick() {
        if (this.albumInfo.type != AlbumDataType.Loaded)
            return;
        getState().getController().playAlbum(this.albumInfo.albumTrack.album.uri); //todo: add album uri DIRECTLY to albumInfo.
    }

    private onBtnAddClick() {
        if (this.albumInfo.type != AlbumDataType.Loaded)
            return;
        getState().getController().addAlbum(this.albumInfo.albumTrack.album.uri); //todo: add album uri DIRECTLY to albumInfo.
    }

    addShadowEventListener(id: string, type: string, listener: (this:HTMLElement, ev: MouseEvent) => any){
        this.shadow.getElementById(id).addEventListener(type, listener);
    }

    override updateWhenConnected() {
        if(this.albumInfo.type == AlbumDataType.Loaded) {
            this.shadow.getElementById("albumTitle").textContent = this.albumInfo.albumTrack.album.name;
        }
    }

    private onActiveTrackChanged() {
        let tracksComp = this.shadow.querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.activeTrackUri = this.activeTrackUri;
    }
}