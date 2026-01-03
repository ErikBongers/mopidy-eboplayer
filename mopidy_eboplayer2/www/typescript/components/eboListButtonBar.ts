import {EboComponent} from "./EboComponent";
import {GuiSource} from "../events";
import {AllUris} from "../modelTypes";

export class EboListButtonBar extends EboComponent {
    static override readonly tagName=  "ebo-list-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["show_add_btn", "show_play_btn", "list_source", "uri"];
    show_add_btn: boolean;
    show_play_btn: boolean;
    list_source: GuiSource;
    uri: string;
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
            <button id="btnPlay" class="roundBorder"><i class="fa fa-play"></i></button>
            <button id="btnAdd" class="roundBorder"><i class="fa fa-plus"></i></button>
            <button id="btnReplace" class="roundBorder">Replace</button>
            <button id="btnEdit" class="roundBorder"><i class="fa fa-pencil"></i></button>
            <button id="btnSave" class="roundBorder"><i class="fa fa-save"></i></button>
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
            case "uri":
                this[name] = newValue;
                break;
        }
        this.requestRender();
        }

    render(shadow:ShadowRoot) {
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            this.dispatchEboEvent("playItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            this.dispatchEboEvent("addItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnReplace", "click", (ev) => {
            this.dispatchEboEvent("replaceItemListClicked.eboplayer", {source: this.list_source});
        });
        // this.addShadowEventListener("btnEdit", "click", (ev) => {
        //     this.dispatchEboEvent("editClicked.eboplayer", {source: this.list_source});
        // });
        this.addShadowEventListener("btnSave", "click", (ev) => {
            this.dispatchEboEvent("saveClicked.eboplayer", {source: this.list_source, uri: this.uri as AllUris});
        });
        this.requestUpdate();
    }
}