import {EboComponent} from "../EboComponent";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";
import {AlbumUri, ExpandedAlbumModel, TrackUri} from "../../modelTypes";
import {GuiSource} from "../../events";
import {EboAlbumDetails} from "./eboAlbumDetails";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "../eboListButtonBar";
import {EboButton} from "../general/eboButton";
import {property, template} from "../placeholders";


export class EboBigAlbumComp extends EboComponent {
    static override readonly tagName=  "ebo-big-album-view";

    get selected_track_uris(): TrackUri[] {
        return (this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp).selected_track_uris;
    }
    set selected_track_uris(value: TrackUri[]) {
        (this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp).selected_track_uris = value;
        this.requestUpdate();
    }

    @property() btn_states: ListButtonStates = ListButtonState_AllHidden();
    get activeTrackUri(): string | null {
        return this._activeTrackUri;
    }
    set activeTrackUri(value: string | null) {
        this._activeTrackUri = value;
        this.onActiveTrackChanged();
    }
    @property({forwardTo: "tracksView"}) albumInfo: ExpandedAlbumModel | null = null;

    private _activeTrackUri: string | null = null;
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    private img: string  = "";

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

    // noinspection HtmlUnknownTarget
    static htmlText = template`
        <div id="wrapper" class="front">
            <div id="top">
                <div id="front">
                    <div class="albumCoverContainer">
                        <img id="img" src="{img}" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 class="selectable flexRow">
                            <div id="name" class="selectable flexGrow">{name}</div>
                            <ebo-button id="btnFavorite" toggle>
                                <i slot="off" class="fa fa-heart-o"></i>
                                <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>                            
                            </ebo-button>
                        </h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info">{extra}</div>
                    </div>
                </div>
                <div id="back">
                    <ebo-album-details></ebo-album-details>
                </div>                
            </div>
            <div id="bottom">
                <ebo-list-button-bar list_source="albumView"></ebo-list-button-bar>
                <div id="albumTableWrapper">
                    <ebo-album-tracks-view id="tracksView" img="" ></ebo-album-tracks-view>
                </div>
            </div>
        </div>        
        `;

    constructor() {
        super(EboBigAlbumComp.styleText, EboBigAlbumComp.htmlText);
        this.albumInfo = null;
    }

    // noinspection JSUnusedGlobalSymbols
    override attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboBigAlbumComp.progressBarAttributes.includes(name)) {
            this.updateStringProperty(name, newValue);
            return;
        }
        }

    override render(shadow:ShadowRoot) {
        let image = this.shadow.getElementById("img") as HTMLImageElement;
        image.addEventListener("click", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.toggle("front");
            wrapper.classList.toggle("back");
        });
        this.on("detailsAlbumImgClicked.eboplayer", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.add("front");
            wrapper.classList.remove("back");
        });
        let heartButton = shadow.getElementById("btnFavorite") as EboButton;
        heartButton.on("pressedChange.eboplayer", (ev) => {
            this.dispatchEboEvent("favoriteToggle.eboplayer", {"uri": this.albumInfo?.album.ref.uri as AlbumUri});
        });
    }

    override update(shadow:ShadowRoot) {
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
        this.updateFavorite();
    }

    private onActiveTrackChanged() {
        let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.activeTrackUri = this.activeTrackUri;
    }

    updateFavorite() {
        let btnFavorite = this.shadow.getElementById("btnFavorite") as EboButton;
        if(this.albumInfo) {
            this.albumInfo.isFavorite().then((isFavorite) => {
                btnFavorite.toggleAttribute("pressed", isFavorite);
            });
        } else {
            btnFavorite.removeAttribute("pressed");
        }
        let tracksComp = this.getShadow().querySelector("ebo-album-tracks-view") as EboAlbumTracksComp;
        tracksComp.updateFavorites();
    }

    updateVolumeAdjust() {
        let albumDetailsComp = this.getShadow().querySelector("ebo-album-details") as EboAlbumDetails;
        albumDetailsComp.volumeAdjustChanged();
    }
}