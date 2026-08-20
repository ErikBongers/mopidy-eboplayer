import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumDataType, AlbumNone, ExpandedStreamModel} from "../modelTypes";
import models from "../../js/mopidy";
import {property, template} from "./placeholders";
import TlTrack = models.TlTrack;

export class EboNowPlayingComp extends EboComponent {
    static override readonly tagName=  "ebo-now-playing";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];

    @property() streamInfo: ExpandedStreamModel | null = null;
    @property({forwardTo: "tracklistView"}) tracklist: TlTrack[] = [];

    //for progressBar
    private position: string = "40";
    private min: string = "0";
    private max: string = "100";
    private button: string = "false";
    private active: string = "true";

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
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = template`
        <div id="wrapper">
            <div id="hero" class="front">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="img" src="{img}" alt="Album cover"/>
                        <ebo-progressbar position="40" active="false" button="false"></ebo-progressbar>
                    </div>
        
                    <div id="info">
                        <h3 id="albumTitle" class="selectable"></h3>
                        <h3 id="name" class="selectable">{name}</h3>
                        <div id="stream_lines" class="selectable nl info">{stream_lines}</div>
                        <div id="extra" class="selectable info">{extra}</div>
                    </div>
                </div>
            </div>
            <div id="tracklist" class="flex scroll {hide_tracklist?hidden}">
                <ebo-tracklist-view id="tracklistView"></ebo-tracklist-view>            
            </div>  
        </div>
        `;

    constructor() {
        super(EboNowPlayingComp.styleText, EboNowPlayingComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboNowPlayingComp.progressBarAttributes.includes(name)) {
            this.updateStringProperty(name, newValue);
            this.getShadow().querySelector("ebo-progressbar")?.setAttribute(name, newValue);
            return;
        }
    }

    override render(shadow:ShadowRoot) {
        this.addShadowEboEventListener("img","click","bigTimelineImageClicked.eboplayer", {});
    }

    override update(shadow:ShadowRoot) {
        let progressBarElement = shadow.querySelector("ebo-progressbar") as HTMLElement;
        EboNowPlayingComp.progressBarAttributes.forEach(attName => {
            // @ts-ignore
            progressBarElement.setAttribute(attName, this[attName]);
        });
    }
}
