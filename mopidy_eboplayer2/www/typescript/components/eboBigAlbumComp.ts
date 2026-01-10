import {EboComponent} from "./EboComponent";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";
import {ExpandedAlbumModel, ExpandedStreamModel} from "../modelTypes";
import {GuiSource} from "../events";
import {EboAlbumDetails} from "./eboAlbumDetails";


export class EboBigAlbumComp extends EboComponent {
    get activeTrackUri(): string | null {
        return this._activeTrackUri;
    }
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.onActiveTrackChanged();
    }
    get albumInfo(): ExpandedAlbumModel | null {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel | null) {
        this._albumInfo = value;
        this.requestUpdate();
    }

    private _streamInfo: ExpandedStreamModel | null = null;
    get streamInfo(): ExpandedStreamModel | null {
        return this._streamInfo;
    }
    set streamInfo(value: ExpandedStreamModel | null) {
        this._streamInfo = value;
        this.requestUpdate();
    }

    private _activeTrackUri: string | null = null;
    static override readonly tagName=  "ebo-big-album-view";
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "extra", "img", "disabled"
    ];
    private name: string = "";
    private extra: string = "";
    private img: string  = "";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: ExpandedAlbumModel | null = null;

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
                max-width: 90vw;
                height: 45vh;
                object-fit: contain;
                background-image: radial-gradient(circle, rgba(255,255,255, .5) 0%, transparent 100%);
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
            }
            #wrapper.front {
                #back {
                    display: none;
                }                
            }
            #wrapper.back {
                #front {
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
            #back {
                min-height: 40vh;
            }
        </style>
        `;

    private static readonly list_source: GuiSource = "albumView";
    // noinspection HtmlUnknownTarget
    static htmlText = `
        <div id="wrapper" class="front">
            <div id="top">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="image" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                    <ebo-list-button-bar 
                        list_source="${this.list_source}"
                        add_btn_state="show"
                        play_btn_state="show"
                        replace_btn_state="show"
                        edit_btn_state="show"
                    >
                    </ebo-list-button-bar>
                </div>
                <div id="back">
                    <ebo-album-details></ebo-album-details>
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
        this.albumInfo = null;
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
            this.updateStringProperty(name, newValue);
            return;
        }
        switch (name) {
            case "name":
            case "extra":
            case "img":
                this[name] = newValue;
                break;
        }
        this.requestUpdate();
        }

    override update(shadow:ShadowRoot) {
        ["name", "extra"].forEach(attName => {
            // @ts-ignore
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
        if(this.albumInfo) {
            let buttonBar = shadow.querySelector("ebo-list-button-bar") as HTMLElement;
            buttonBar.setAttribute("uri", this.albumInfo.album.albumInfo.uri);
            let albumDetails = shadow.querySelector("ebo-album-details") as EboAlbumDetails;
            albumDetails.albumInfo = this.albumInfo;
        }

    }

    override render(shadow:ShadowRoot) {
        let image = this.shadow.getElementById("image") as HTMLImageElement;
        image.addEventListener("click", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.toggle("front");
            wrapper.classList.toggle("back");
        });
        this.addEboEventListener("detailsAlbumImgClicked.eboplayer", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.add("front");
            wrapper.classList.remove("back");
        })
    }

    private onActiveTrackChanged() {
        let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.activeTrackUri = this.activeTrackUri;
    }
}