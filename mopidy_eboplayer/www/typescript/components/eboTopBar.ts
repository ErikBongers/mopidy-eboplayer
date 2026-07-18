import {EboComponent} from "./EboComponent";
import {Goto, Message, MessageType} from "../modelTypes";
import {unreachable} from "../global";

export class EboTopBar extends EboComponent {
    get message(): Message {
        return this._message;
    }

    set message(value: Message) {
        this._message = value;
        this.requestUpdate();
    }
    get tmpMessage(): Message {
        return this._tmpMessage;
    }

    set tmpMessage(value: Message) {
        this._tmpMessage = value;
        this.requestUpdate();
    }
    get page(): Goto {
        return this._page;
    }

    set page(value: Goto) {
        this._page = value;
        this.requestUpdate();
    }

    private _message: Message = { message: "", type: MessageType.None };
    private _tmpMessage: Message = { message: "", type: MessageType.None };

    static override readonly tagName=  "ebo-top-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

    private _page: Goto = "#NowPlaying";

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            #header {
                padding-top: 8px;
            }
            ul#header {
                background-color: var(--header-background);
                width: 100%;
                display: flex;
                justify-content: space-between;
                li {
                    display: inline;
                }
                p {
                    padding: .2em 1em;
                    font-size: .7em;
                    margin-top: .2em;
                }
            }
            ul#header li {
                margin-inline: .1rem;
            }
            #headerNowPlayingBtn {
                img {
                    width: 18px;
                    height: 18px;
                    corner-shape: squircle;
                    border-radius: 50%;
                }
            }
            #contentHeadline {
                justify-self: center;
            }
            .title.condensed  {
                font-family: "Sofia Sans", sans-serif;
                font-optical-sizing: auto;
                font-weight: 400;
            }
        </style>
    `;

    static htmlText = `
        <ul id="header" class="nobullet title condensed">
            <li class="flexShrink">
                <button id="headerFavoritesBtn" title="Search">
                    <i class="fa fa-heart"></i>
                </button>
            </li>
            <li class="flexShrink">
                <button id="headerSearchBtn" title="Search" data-goto="#Browse">
                    <i class="fa fa-search"></i>
                </button>
            </li>
            <li class="flexShrink">
                <button id="headerNowPlayingBtn" title="Search" data-goto="#NowPlaying">
                    <img id="img" src="images/default_cover.png" alt="Album cover"/>
                </button>
            </li>
            <li class="flexGrow textCenter">
                <span id="contentHeadline">Initializing...</span>
            </li>
            <li>
                <button id="settingsBtn"><i class="fa fa fa-ellipsis-v"></i></button>
            </li>
        </ul>
        `;

    constructor() {
        super(EboTopBar.styleText, EboTopBar.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        shadow.getElementById("headerSearchBtn")?.addEventListener("click", (ev) => {
            this.dispatchEboEvent("gotoPage.eboplayer", {page: "#Browse"});
        });
        shadow.getElementById("headerNowPlayingBtn")?.addEventListener("click", () => {
            this.dispatchEboEvent("gotoPage.eboplayer", {page: "#NowPlaying"});
        });
        shadow.getElementById("headerFavoritesBtn")?.addEventListener("click", async () => {
            this.dispatchEboEvent("gotoPage.eboplayer", {page: "#Browse.Favorites"});
        });
        shadow.getElementById("settingsBtn")?.addEventListener("click", async () => {
            this.dispatchEboEvent("gotoPage.eboplayer", {page: "#Settings"});
        });
    }

    override update(shadow: ShadowRoot) {
        let browseBtn = shadow.getElementById("headerSearchBtn") as HTMLButtonElement;
        let nowPlayingBtn = shadow.getElementById("headerNowPlayingBtn") as HTMLButtonElement;
        switch (this.page) {
            case "#WhatsNew":
            //fall through
            case "#Browse":
            case "#Browse.Favorites":
                browseBtn.style.display = "none";
                nowPlayingBtn.style.display = "block";
                break;
            case "#NowPlaying":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "none";
                break;
            case "#Album":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                break;
            case "#Radio":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                break;
            case "#Settings":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                break;
            case "#Remembered":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                break;
            case "#Genres":
                browseBtn.style.display = "block";
                nowPlayingBtn.style.display = "block";
                break;
            default:
                return unreachable(this.page);
        }
        this.updateMessage();
    }

    private updateMessage() {
        let message = this.message;
        if(this.tmpMessage.type != MessageType.None)
            message = this.tmpMessage;
        let contentHeadline = this.getShadow().getElementById("contentHeadline") as HTMLSpanElement;
        if(message.message) {
            contentHeadline.innerText = message.message;
        } else {
            contentHeadline.innerText = "";
        }
        switch (message.type) {
            case MessageType.Error:
                contentHeadline.classList.add("warning");
                break;
            default:
                contentHeadline.classList.remove("warning", "error");
                break;
        }
    }
}