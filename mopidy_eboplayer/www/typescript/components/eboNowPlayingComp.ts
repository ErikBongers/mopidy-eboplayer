import {addShadowEventListener, EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone, ExpandedStreamModel} from "../modelTypes";
import {EboRadioHistoryComp} from "./radio/eboRadioHistoryComp";
import models from "../../js/mopidy";
import {EboTracklistComp} from "./eboTracklistComp";
import {template} from "./placeholders";
import TlTrack = models.TlTrack;

export class EboNowPlayingComp extends EboComponent {
    static override readonly tagName=  "ebo-now-playing";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "stream_lines", "extra", "img", "disabled", "show_back", "hide_tracklist",
        ...EboNowPlayingComp.progressBarAttributes
    ];
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

    private _tracklist: TlTrack[] = [];
    get tracklist(): models.TlTrack[] {
        return this._tracklist;
    }

    set tracklist(value: models.TlTrack[]) {
        this._tracklist = value;
        this.requestUpdate();
    }

    //for progressBar
    private position: string = "40";
    private min: string = "0";
    private max: string = "100";
    private button: string = "false";
    private active: string = "true";

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
                    padding: 2ch;
                }
                img#img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    min-width: 200px;
                    min-height: 200px;
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
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                #hero {
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
                #hero.front {
                    #back {
                        display: none;
                    }                
                }
                #hero.back {
                    #front {
                        position: absolute;
                        display: none;
                    }                
                }
                .info {
                    font-size: .7em;
                }
                #info {
                    font-size: 1.2rem;
                    & * {
                        text-align: center;
                    }
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
    static htmlText = template`
        <div id="wrapper" class="{show_back}">
            <div id="hero" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="img" style="visibility: hidden" src="{img}" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable">{name}</h3>
                        <div id="stream_lines" class="selectable nl info">{stream_lines}</div>
                        <div id="extra" class="selectable info">{extra}</div>
                    </div>
                </div>
                <div id="back">
                    <div id="header" class="flexRow">
                        <img id="smallImage" src="{img}" alt="Album image">
                        <span id="title" class="selectable">{name}</span>
                    </div>
                    <div id="albumTableWrapper">
                        <ebo-radio-details-view img="images/default_cover.png" ></ebo-radio-details-view>
                    </div>
                </div>
            </div>
            <div id="tracklist" class="flex scroll {hide_tracklist}">
                <ebo-tracklist-view></ebo-tracklist-view>            
            </div>  
        </div>
        `;

    constructor() {
        super(EboNowPlayingComp.styleText, EboNowPlayingComp.htmlText);
        this.defineAtt("hide_tracklist", "", (value) => value == "true"? "hidden" : "");
        this.defineAtt("show_back", "", (value) => value == "true"? "back" : "front");
        this.defineAtt("name", "");
        this.defineAtt("extra", "");
        this.defineAtt("stream_lines", "");
        this.defineAtt("img", "", (value, shadow, el) => {
            let smallImg = shadow.getElementById("smallImage") as HTMLImageElement;
            if(value != "") {
                el.style.visibility = "";
                smallImg.style.visibility = "";
                (el as HTMLImageElement).src = value as string;
                smallImg.src = value as string;
            }
            else {
                (el as HTMLImageElement).style.visibility = "hidden";
                smallImg.style.visibility = "hidden";
            }
            return value as string;
        });
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboNowPlayingComp.progressBarAttributes.includes(name)) {
            this.updateStringProperty(name, newValue);
            this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
            return;
        }
        switch (name) {
            case "enabled":
            case "show_back":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        this.addShadowEventListener("img","click","bigTimelineImageClicked.eboplayer", {});
        let smallImage = shadow.getElementById("smallImage") as HTMLImageElement;
        addShadowEventListener(smallImage, "click", "bigTrackAlbumSmallImgClicked.eboplayer", {});
        this.requestUpdate();
    }

    getTracklistComp(): EboTracklistComp {
        return this.getShadow().querySelector("ebo-tracklist-view") as EboTracklistComp;
    }

    override update(shadow:ShadowRoot) {
        this.getTracklistComp().tracklist = this.tracklist;
        let progressBarElement = shadow.querySelector("ebo-progressbar") as HTMLElement;
        EboNowPlayingComp.progressBarAttributes.forEach(attName => {
            // @ts-ignore
            progressBarElement.setAttribute(attName, this[attName]);
        });
        if(this.albumInfo.type == AlbumDataType.Loaded) {
            // @ts-ignore
            shadow.getElementById("albumTitle").textContent = this.albumInfo.album.albumInfo.name;
        }
        let redioDetailsComp = shadow.querySelector("ebo-radio-details-view") as EboRadioHistoryComp;
        redioDetailsComp.streamInfo = this.streamInfo;
    }
}
