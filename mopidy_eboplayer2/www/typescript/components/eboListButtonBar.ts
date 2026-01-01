import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {EboplayerEvent, EboplayerEvents, GuiSourceArgs, UriArgs} from "../events";
import {EboAlbumTracksComp} from "./eboAlbumTracksComp";

export class EboListButtonBar extends EboComponent {
    static readonly tagName=  "ebo-list-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["show_add_btn", "show_play_btn"];
    show_add_btn: boolean;
    show_play_btn: boolean;
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
        }
        this.requestRender();
        }

    private updateBoolAtrribute(newValue: string, name: string) { //todo: move to base class. Perhaps return true if value actually changed, so a re-render or update could be avoided.
        if (!["true", "false"].includes(newValue))
            throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
        this[name] = newValue == "true";
    }

    render(shadow:ShadowRoot) {
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            this.dispatchEvent(new EboplayerEvent<GuiSourceArgs>(EboplayerEvents.playItemListClicked, {source: "albumView"})); //todo: override dispatchEvent to make it tied to EboplayerEvent?
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            this.dispatchEvent(new EboplayerEvent<GuiSourceArgs>(EboplayerEvents.addItemListClicked, {source: "albumView"}));
        });
        this.requestUpdate();
    }
}