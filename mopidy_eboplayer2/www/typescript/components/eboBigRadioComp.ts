import {EboComponent} from "./EboComponent";
import {GuiSource} from "../events";
import {EboAlbumDetails} from "./eboAlbumDetails";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "./eboListButtonBar";
import {ExpandedStreamModel, StreamUri} from "../modelTypes";
import {EboRadioHistoryComp} from "./eboRadioHistoryComp";
import {EboRadioDetails} from "./eboRadioDetails";
import {EboButton} from "./eboButton";


export class EboBigRadioComp extends EboComponent {
    static override readonly tagName=  "ebo-big-radio-view";
    static observedAttributes = ["name", "extra", "img", "disabled"];

    get btn_states(): ListButtonStates {
        return this._btn_states;
    }

    set btn_states(value: ListButtonStates) {
        this._btn_states = value;
        this.requestUpdate();
    }
    get streamInfo(): ExpandedStreamModel | null {
        return this._streamInfo;
    }

    set streamInfo(value: ExpandedStreamModel | null) {
        this._streamInfo = value;
        this.requestUpdate();
    }
    private _streamInfo: ExpandedStreamModel | null = null;

    private img: string  = "";
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
            .coverContainer {
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
            #tableWrapper {
                overflow: hidden;
                display: flex;
            }
            ebo-radio-details-view {
                height: 100%;
            }
            ebo-radio-history {
                width: 100%;
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
                    <div class="coverContainer">
                        <img id="bigImage" src="" alt="Album cover"/>
                    </div>
        
                    <div id="info">
                        <h3 id="text" class="selectable"></h3>
                        <h3 class="selectable flexRow">
                            <div id="name" class="selectable flexGrow"></div>
                            <ebo-button id="btnFavorite" toggle>
                                <i slot="off" class="fa fa-heart-o"></i>
                                <i slot="on" class="fa fa-heart" style="color: var(--highlight-color);"></i>                            
                            </ebo-button>
                        </h3>
                        <div id="stream_lines" class="selectable info"></div>
                        <div id="extra" class="selectable info"></div>
                    </div>
                </div>
                <div id="back">
                    <ebo-radio-details></ebo-radio-details>
                </div>                
            </div>
            <div id="bottom">
                <ebo-list-button-bar list_source="${this.list_source}"></ebo-list-button-bar>
                <div id="tableWrapper">
                    <ebo-radio-history img="" ></ebo-radio-history>
                </div>
            </div>
        </div>        
        `;

    constructor() {
        super(EboBigRadioComp.styleText, EboBigRadioComp.htmlText);
        this.streamInfo = null;
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
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
        this.addEboEventListener("detailsRadioImgClicked.eboplayer", () => {
            let wrapper = this.getShadow().querySelector("#wrapper") as HTMLElement;
            wrapper.classList.add("front");
            wrapper.classList.remove("back");
        });
        let btnFavorite = shadow.getElementById("btnFavorite") as EboButton;
        btnFavorite.addEventListener("click", (ev) => {
            this.dispatchEboEvent("favoriteToggle.eboplayer", {"uri": this.streamInfo?.stream!.ref.uri as StreamUri});
        });

        this.requestUpdate();
    }

    override update(shadow:ShadowRoot) {
        let radioDetailsComp = shadow.querySelector("ebo-radio-details") as EboRadioDetails;
        radioDetailsComp.streamInfo = this.streamInfo;
        let radioHistoryComp = shadow.querySelector("ebo-radio-history") as EboRadioHistoryComp;
        radioHistoryComp.streamInfo = this.streamInfo;
        let img = shadow.getElementById("bigImage") as HTMLImageElement;
        if(this.streamInfo) {
            img.src = this.streamInfo.bigImageUrl;
            img.style.visibility = "visible";
            shadow.getElementById("name")!.innerHTML = this.streamInfo.stream.name;
            let buttonBar = shadow.querySelector("ebo-list-button-bar") as HTMLElement;
            buttonBar.setAttribute("uri", this.streamInfo.stream.ref.uri?? "--no albumInfo--");
            let detailsComp = shadow.querySelector("ebo-radio-details") as EboRadioHistoryComp;
            detailsComp.streamInfo = this.streamInfo;
        } else {
            img.style.visibility = "hidden";
        }
        let listButtonBar = shadow.querySelector("ebo-list-button-bar") as EboListButtonBar;
        listButtonBar.btn_states = this.btn_states;
        this.updateFavorite();
    }

    updateFavorite() {
        let btnFavorite = this.shadow.getElementById("btnFavorite") as EboButton;
        if(this.streamInfo) {
            this.streamInfo.isFavorite().then((isFavorite) => {
                btnFavorite.toggleAttribute("pressed", isFavorite);
            });
        } else {
            btnFavorite.removeAttribute("pressed");
        }
    }
}