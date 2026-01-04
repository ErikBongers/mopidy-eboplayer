import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {console_yellow} from "../global";

export class PressedChangeEvent extends Event {
    private _pressed: boolean;

    constructor(pressed: boolean) {
        super("pressedChange"); //todo: make ebo event.
        this._pressed = pressed;
    }

    get pressed() {
        return this._pressed;
    }
}

export class EboDialog extends EboComponent {
    static override readonly tagName=  "ebo-dialog";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = ["ok_text"];

    ok_text: string = "TODO";

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            dialog {
                background-color: var(--body-background);
                & input {
                    background-color: var(--body-background);
                }
            }        
        </style>
    `;

    static htmlText = `
        <dialog id="dialog">
            <div id="content">
                <slot></slot>
            </div>
            <div>
                <button id="OkBtn">TODO</button>
                <button id="CancelBtn">Cancel</button>
            </div>
        </dialog>
        `;

    constructor() {
        super(EboDialog.styleText, EboDialog.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "ok_text":
                this[name] = newValue;
                break;
        }
        //todo: can I use this.shadowRoot here? What's the difference?
        this.render(this.shadow); //render immediately!
        }

    render(shadow:ShadowRoot) {
        let okButton = shadow.getElementById("OkBtn") as HTMLButtonElement;
        okButton.addEventListener("click", (ev) => {
            this.onOkButtonClick(ev);
        });
        let cancelButton = shadow.getElementById("CancelBtn") as HTMLButtonElement;
        cancelButton.addEventListener("click", (ev) => {
            let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
            dialog.close();
        });
        okButton.innerText = this.ok_text;
    }

    private onOkButtonClick(ev: PointerEvent) {
        let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
        dialog.close();
    }

    showModal() {
        console_yellow("EboDialog.showModal called.");
        let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
        dialog.showModal();
    }
}