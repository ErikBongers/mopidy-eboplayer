import {EboComponent} from "./EboComponent";

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
        this.requestUpdate();//don't request render or the dialog may not show.
        }

    override render(shadow:ShadowRoot) {
        let okButton = shadow.getElementById("OkBtn") as HTMLButtonElement;
        okButton.addEventListener("click", (ev) => {
            this.onOkButtonClick(ev);
        });
        let cancelButton = shadow.getElementById("CancelBtn") as HTMLButtonElement;
        cancelButton.addEventListener("click", (ev) => {
            let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
            dialog.close();
        });
    }

    private onOkButtonClick(ev: PointerEvent) {
        let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
        this.dispatchEboEvent("dialogOkClicked.eboplayer", { dialog: this });
    }

    showModal() {
        let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
        dialog.showModal();
    }

    close() {
        let dialog = this.getShadow().getElementById("dialog") as HTMLDialogElement;
        dialog.close();
    }

    override update(shadow: ShadowRoot) {
        let okButton = shadow.getElementById("OkBtn") as HTMLButtonElement;
        okButton.innerText = this.ok_text;
    }
}