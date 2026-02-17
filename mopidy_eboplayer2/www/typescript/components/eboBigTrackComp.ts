import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone, ExpandedStreamModel} from "../modelTypes";
import {EboRadioDetailsComp} from "./eboRadioDetailsComp";

class EboBigTrackComp extends EboComponent {
    get albumInfo(): AlbumData {
        return this._albumInfo;
    }

    set albumInfo(value: AlbumData) {
        this._albumInfo = value;
        this.requestRender();
    }

    private _streamInfo: ExpandedStreamModel | null = null;
    get streamInfo(): ExpandedStreamModel | null {
        return this._streamInfo;
    }
    set streamInfo(value: ExpandedStreamModel | null) {
        this._streamInfo = value;
        this.requestUpdate();
    }

    static override readonly tagName=  "ebo-big-track-view";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "stream_lines", "extra", "img", "disabled", "show_back", "program_title",
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
    private program_title: string = "";

    private img: string  = "";
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
                    /*align-content: center;*/
                    overflow: hidden;
                }
                img#bigImage {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    min-width: 200px;
                    min-height: 200px;
                    background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
                }
                img#smallImage {
                    width: 2.1rem;
                    height: 2.1rem;
                    object-fit: contain;
                    margin-right: .5rem;
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
                        align-items: center;
                    }
                    #back {
                        width: 100%;
                        padding: 1rem;
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
                ebo-radio-details-view {
                    height: 100%;
                }
                #albumTableWrapper {
                    height: 100%;
                    font-size: .8rem;
                }
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
            <div id="wrapper" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="bigImage" style="visibility: hidden" src="" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <div id="header" class="flexRow">
                        <img id="smallImage" src="" alt="Album image">
                        <span id="title" class="selectable"></span>
                    </div>
                    <div id="albumTableWrapper">
                        <ebo-radio-details-view img="images/default_cover.png" ></ebo-radio-details-view>
                    </div>
                </div>
            </div>        
        `;

    constructor() {
        super(EboBigTrackComp.styleText, EboBigTrackComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboBigTrackComp.progressBarAttributes.includes(name)) {
            this.updateStringProperty(name, newValue);
            this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
            return;
        }
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
            case "img":
            case "program_title":
                this[name] = newValue;
                break;
            case "enabled":
            case "show_back":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        this.addShadowEventListener("bigImage","click", (ev) => {
            this.dispatchEboEvent("bigTrackAlbumImgClicked.eboplayer", {});
        });
        let smallImage = shadow.getElementById("smallImage") as HTMLImageElement;
        smallImage.addEventListener("click", (ev) => {
            this.dispatchEboEvent("bigTrackAlbumSmallImgClicked.eboplayer", {});
        });
        this.requestUpdate();
    }

    override update(shadow:ShadowRoot) {
        ["name", "stream_lines", "extra"].forEach(attName => {
            // @ts-ignore
            shadow.getElementById(attName).innerHTML = this[attName];
        });
        if(this.program_title != "") {
            // @ts-ignore
            shadow.getElementById("name").innerHTML = this.name + " - " + this.program_title;
        }
        let progressBarElement = shadow.querySelector("ebo-progressbar") as HTMLElement;
        EboBigTrackComp.progressBarAttributes.forEach(attName => {
            // @ts-ignore
            progressBarElement.setAttribute(attName, this[attName]);
        });
        let img = shadow.getElementById("bigImage") as HTMLImageElement;
        img.src = this.img;
        this.switchFrontBackNoRender();
        if(this.albumInfo.type == AlbumDataType.Loaded) {
            // @ts-ignore
            shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
        }
        let redioDetailsComp = shadow.querySelector("ebo-radio-details-view") as EboRadioDetailsComp;
        redioDetailsComp.streamInfo = this.streamInfo;
        let smallImg = shadow.getElementById("smallImage") as HTMLImageElement;
        if(this.img != "") {
            img.style.visibility = "";
            smallImg.style.visibility = "";
            img.src = this.img;
            smallImg.src = this.img;
        }
        else {
            img.style.visibility = "hidden";
            smallImg.style.visibility = "hidden";
        }
        let title = shadow.getElementById("title") as HTMLElement;
        title.textContent = this.name;
    }

    private switchFrontBackNoRender() {
        let wrapper = this.shadow.getElementById("wrapper") as HTMLElement;
        wrapper.classList.remove("front", "back");
        if (this.show_back)
            wrapper.classList.add("back");
        else
            wrapper.classList.add("front");
    }

}

export default EboBigTrackComp