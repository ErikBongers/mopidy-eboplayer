import {EboComponent} from "./EboComponent";
import {EboplayerEvents} from "../modelTypes";
import {MouseTimer} from "../MouseTimer";

export class EboMenuButton extends EboComponent {
    static readonly tagName=  "ebo-menu-button";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
        </style>
    `;

    static htmlText = `
        <button>
            ...
        </button>
        `;

    constructor() {
        super(EboMenuButton.styleText, EboMenuButton.htmlText);
    }

    onConnected() {
        super.onConnected();
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
            case "pressed": //todo: generalize capture of attributes.
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    renderPrepared() {
    }
}