import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone} from "../modelTypes";

export class EboBigTrackComp extends EboComponent {
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
    static readonly tagName=  "ebo-big-track-view";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "stream_lines", "extra", "img", "disabled", "show_back",
        ...EboBigTrackComp.progressBarAttributes
    ];
    private name: string = "";
    private stream_lines: string = "";
    private extra: string = "";
    private enabled: boolean = false;
    private show_back: boolean = false;
    //for progressBar
    private position: string = "40";
    private min: string = "0";
    private max: string = "100";
    private button: string = "false";
    private active: string = "true";

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
                    flex-direction: row;
                    height: 100%;
                    width: 100%;
                    #front {
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                    }
                }
                #wrapper.front {
                    #back {
                        display: none;
                    }                
                }
                .info {
                    font-size: .7em;
                }
                ebo-album-tracks-view {
                    height: 100%;
                }
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
            <div id="wrapper" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="img" src="images/default_cover.png" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
            </div>        
        `;

    constructor() {
        super(EboBigTrackComp.styleText, EboBigTrackComp.htmlText);
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
        if(EboBigTrackComp.progressBarAttributes.includes(name)) {
            this[name] = newValue;
            this.shadow.querySelector("ebo-progressbar")?.setAttribute(name, newValue);
            return;
        }
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
            case "img":
                this[name] = newValue;
                break;
            case "enabled":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
        super.connectedCallback();
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        ["name", "stream_lines", "extra"].forEach(attName => {
            fragment.getElementById(attName).innerHTML = this[attName];
        });
        let progressBarElement = fragment.querySelector("ebo-progressbar") as HTMLElement;
        //todo: try casting to EboProgressBar class and set attributes directly? Without re-rendering?
        EboBigTrackComp.progressBarAttributes.forEach(attName => {
            progressBarElement.setAttribute(attName, this[attName]);//todo: check if each of these causes a re-rendering.
        });
        //todo: image.
        this.shadow.appendChild(fragment);
        // let img = this.shadow.getElementById("img");
        // img.addEventListener("click", (ev) => {
        //     this.dispatchEvent(this.albumClickEvent);
        // });
        this.addShadowEventListener("img","click", (ev) => {
            this.dispatchEvent(this.albumClickEvent);
        });
        this.update();
    }

    override updateWhenConnected() {
        if(this.albumInfo.type == AlbumDataType.Loaded) {
            this.shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
        }
        let img = this.shadow.getElementById("img") as HTMLImageElement;
        if(this.albumInfo.type == AlbumDataType.Loaded)
            img.src = this.albumInfo.album.tracks[0].imageUri;
    }

    private onActiveTrackChanged() {

    }
}