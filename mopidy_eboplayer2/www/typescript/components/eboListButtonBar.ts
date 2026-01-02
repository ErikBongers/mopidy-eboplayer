import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {EboplayerEvent, EboplayerEvents, GuiSource, GuiSourceArgs, UriArgs} from "../events";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";

export class EboListButtonBar extends EboComponent {
    static readonly tagName=  "ebo-list-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["show_add_btn", "show_play_btn", "list_source"];
    show_add_btn: boolean;
    show_play_btn: boolean;
    list_source: GuiSource;
    static styleText = `
        <style>
            #buttons {
                display: flex;
                flex-direction: row;
                margin-bottom: .5em;
            }
        </style>
    `;
    static htmlText = `
        <div id="buttons">
            <button id="btnPlay" class="roundBorder">Play</button>
            <button id="btnAdd" class="roundBorder">Add</button>
        </div>                   
    `;

    constructor() {
        super(EboListButtonBar.styleText, EboListButtonBar.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "show_add_btn":
            case "show_play_btn":
                this.updateBoolAtrribute(newValue, name);
                break;
            case "list_source":
                this.list_source = newValue as GuiSource;
                break;
        }
        this.requestRender();
        }

    render(shadow:ShadowRoot) {
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            this.dispatchEvent(new EboplayerEvent<GuiSourceArgs>(EboplayerEvents.playItemListClicked, {source: this.list_source})); //todo: override dispatchEvent to make it tied to EboplayerEvent?
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            this.dispatchEvent(new EboplayerEvent<GuiSourceArgs>(EboplayerEvents.addItemListClicked, {source: this.list_source}));
        });
        this.requestUpdate();
    }
}