import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone} from "../modelTypes";
import {console_yellow} from "../global";

export class EboBigTrackComp extends EboComponent {
    get albumInfo(): AlbumData {
        return this._albumInfo;
    }

    set albumInfo(value: AlbumData) {
        this._albumInfo = value;
        this.render();
    }

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

    private img: string  = "";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: AlbumData = AlbumNone;

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
                    min-width: 200px;
                    min-height: 200px;
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
                        <img id="image" style="visibility: hidden" src="" alt="Album cover"/>
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
        this.albumClickEvent = new CustomEvent("albumClick", {
            bubbles: true,
            cancelable: false,
            composed: true, //needed to 'break' out of the shadow.
            detail: "todo: tadaaa!"
        });

        console_yellow("EboBigTrackComp constructor called.");
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboBigTrackComp.progressBarAttributes.includes(name)) {
            this[name] = newValue;
            this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
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
        console_yellow("eboBigTrackComp connectedCallback called.");
    }

    renderPrepared(shadow:ShadowRoot) {
        console_yellow("eboBigTrackComp renderPrepared called.");
        ["name", "stream_lines", "extra"].forEach(attName => {
            shadow.getElementById(attName).innerHTML = this[attName];
        });
        let progressBarElement = shadow.querySelector("ebo-progressbar") as HTMLElement;
        //todo: try casting to EboProgressBar class and set attributes directly? Without re-rendering?
        EboBigTrackComp.progressBarAttributes.forEach(attName => {
            progressBarElement.setAttribute(attName, this[attName]);//todo: check if each of these causes a re-rendering.
        });
        let img = shadow.getElementById("image") as HTMLImageElement;
        img.src = this.img;
        this.addShadowEventListener("image","click", (ev) => {
            this.dispatchEvent(this.albumClickEvent);
        });
        this.update();
    }

    override updateWhenRendered(shadow:ShadowRoot) {
        if(this.albumInfo.type == AlbumDataType.Loaded) {
            shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
        }
        let img = shadow.getElementById("image") as HTMLImageElement;
        if(this.img != "") {
            img.style.visibility = "";
            img.src = this.img;
        }
        else {
            img.style.visibility = "hidden";
        }
    }

}