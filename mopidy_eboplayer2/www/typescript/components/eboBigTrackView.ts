import {EboComponent} from "./EboComponent";
import {console_yellow} from "../gui";
import {AlbumData, AlbumDataType, AlbumNone} from "../views/bigTrackViewUriAdapter";
import {EboAlbumTracksView} from "./eboAlbumTracksView";

export class EboBigTrackView extends EboComponent {
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
        ...EboBigTrackView.progressBarAttributes
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
    private styleTemplate: HTMLTemplateElement;
    private divTemplate: HTMLTemplateElement;
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: AlbumData;


    constructor() {
        super();
        this.styleTemplate = document.createElement("template");
        // noinspection CssUnresolvedCustomProperty,HtmlUnknownTarget
        this.styleTemplate.innerHTML = `
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
                    overflow: scroll;
                    scrollbar-width: none;    
                    height: 100%;
                }
            </style>
        `;
        this.divTemplate = document.createElement("template");
        this.divTemplate.innerHTML = `
            <div id="wrapper" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="img" src="${this.img}" alt="Album cover"/>
                        <ebo-progressbar position="${this.position}" active="${this.active}" button="${this.button}"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <div id="albumTableWrapper">
                        <ebo-album-tracks-view img="${this.img}" ></ebo-album-tracks-view>
                    </div>
                </div>
            </div>        
        `;
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
        if(EboBigTrackView.progressBarAttributes.includes(name)) {
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

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        ["name", "stream_lines", "extra"].forEach(attName => {
            fragment.getElementById(attName).innerHTML = this[attName];
        });
        let progressBarElement = fragment.querySelector("ebo-progressbar") as HTMLElement;
        //todo: try casting to EboProgressBar class and set attributes directly? Without re-rendering?
        EboBigTrackView.progressBarAttributes.forEach(attName => {
            progressBarElement.setAttribute(attName, this[attName]);//todo: check if each of these causes a re-rendering.
        });
        //todo: image.
        this.shadow.appendChild(fragment);
        // let img = this.shadow.getElementById("img");
        // img.addEventListener("click", (ev) => {
        //     console_yellow('CKICK');
        //     this.dispatchEvent(this.albumClickEvent);
        // });
        let wrapper = this.shadow.getElementById("wrapper");
        wrapper.classList.remove("front", "back");
        if(this.show_back)
            wrapper.classList.add("back");
        else
            wrapper.classList.add("front");
        this.shadow.getElementById("img").addEventListener("click", (ev) => {
            console_yellow('CKICK');
            this.dispatchEvent(this.albumClickEvent);
        });
        this.shadow.getElementById("back").addEventListener("click", (ev) => {
            console_yellow('CKICK');
            this.dispatchEvent(this.albumClickEvent);
        });
        let tracksComp = this.shadow.querySelector("ebo-album-tracks-view") as EboAlbumTracksView;
        tracksComp.albumInfo = this.albumInfo;
    }

}