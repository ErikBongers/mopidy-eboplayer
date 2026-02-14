import {EboComponent} from "./EboComponent";

export class EboOption extends EboComponent {
    static override readonly tagName=  "ebo-option";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = ["value", "selected"];
    private value: string;
    private selected: boolean = false;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            #wrapper {
                /*width: 2rem;*/
            }
      </style>
    `;

    static htmlText = `
            <div id="wrapper">
                <slot></slot>
            </div>       
        `;

    constructor() {
        super(EboOption.styleText, EboOption.htmlText);
    }

    override onConnected() {
        super.onConnected();
        this.requestRender();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
        }
}