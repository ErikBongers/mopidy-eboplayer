import {EboComponent} from "./EboComponent";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";
import {ExpandedAlbumModel, TrackUri} from "../modelTypes";
import {GuiSource} from "../events";
import {EboAlbumDetails} from "./eboAlbumDetails";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "./eboListButtonBar";
import {arrayToggle} from "../global";


export class EboBigAlbumComp extends EboComponent {
    static override readonly tagName=  "ebo-big-album-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["name", "extra", "img", "disabled"];

    get selected_track_uris(): TrackUri[] {
        return (this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp).selected_track_uris;
    }
    set selected_track_uris(value: TrackUri[]) {
        (this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp).selected_track_uris = value;
        this.requestUpdate();
    }

    get btn_states(): ListButtonStates {
        return this._btn_states;
    }

    set btn_states(value: ListButtonStates) {
        this._btn_states = value;
        this.requestUpdate();
    }
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

    private _activeTrackUri: string | null = null;
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    private name: string = "";
    private extra: string = "";
    private img: string  = "";
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: ExpandedAlbumModel | null = null;
    private _btn_states: ListButtonStates = ListButtonState_AllHidden();

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
                    display: flex;
                    flex-direction: column;
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
                overflow: hidden;
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
                        <img id="bigImage" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 id="name" class="selectable"></h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <ebo-album-details></ebo-album-details>
                </div>                
            </div>
            <div id="bottom">
                <ebo-list-button-bar list_source="${this.list_source}"></ebo-list-button-bar>
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

    override render(shadow:ShadowRoot) {
        let image = this.shadow.getElementById("bigImage") as HTMLImageElement;
        image.addEventListener("click", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.toggle("front");
            wrapper.classList.toggle("back");
        });
        this.addEboEventListener("detailsAlbumImgClicked.eboplayer", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.add("front");
            wrapper.classList.remove("back");
        });
    }

    override update(shadow:ShadowRoot) {
        ["name", "extra"].forEach(attName => {
            // @ts-ignore
            shadow.getElementById(attName).innerHTML = this[attName];
        });
        let tracksComp = shadow.querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.albumInfo = this.albumInfo;
        let img = shadow.getElementById("bigImage") as HTMLImageElement;
        if(this.img != "") {
            img.style.visibility = "";
            img.src = this.img;
        } else
            img.style.visibility = "hidden";
        if(this.albumInfo) {
            let buttonBar = shadow.querySelector("ebo-list-button-bar") as HTMLElement;
            buttonBar.setAttribute("uri", this.albumInfo.album.albumInfo?.uri?? "--no albumInfo--");
            let albumDetails = shadow.querySelector("ebo-album-details") as EboAlbumDetails;
            albumDetails.albumInfo = this.albumInfo;
        }
        let listButtonBar = shadow.querySelector("ebo-list-button-bar") as EboListButtonBar;
        listButtonBar.btn_states = this.btn_states;
        if(this.selected_track_uris.length > 0)
            listButtonBar.setAttribute("use_selected_color", "true");
        else
            listButtonBar.removeAttribute("use_selected_color");
    }

    private onActiveTrackChanged() {
        let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.activeTrackUri = this.activeTrackUri;
    }
}