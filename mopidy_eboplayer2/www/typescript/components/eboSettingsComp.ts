import {EboComponent} from "./EboComponent";
import {EboButton} from "./general/eboButton";
import {ScanStatus} from "../model";
import {unreachable} from "../global";

export class EboSettingsComp extends EboComponent {
    static override readonly tagName=  "ebo-settings-view";
    get scanStatus(): ScanStatus[] { //todo: receive a readonly array?
        return this._scanStatus;
    }
    set scanStatus(value: ScanStatus[]) {
        this._scanStatus = value;
        this.update(this.shadow);//force!
    }
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = ["show_whats_new"];

    private _scanStatus: ScanStatus[] = [];
    private show_whats_new: boolean = false;

    static styleText= `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
            #scanStatus {
                font-size: .7rem;
                details > div {
                    margin-inline-start: 1ch;
                }
                & .details {
                    opacity: .5;
                }
                & .error, & .error summary {
                    color: red;
                }
            }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
        <div id="wrapper" class="flexColumn">
            <ebo-button id="rememberedBtn" class="roundBorder">Remembered info.</ebo-button>
            <ebo-button id="scanBtn" class="roundBorder">Rescan media folder</ebo-button>
            <p id="scanStatus"></p>
            <ebo-button id="whatsNewBtn" class="roundBorder hidden">Show what's new!</ebo-button>
            <ebo-button id="readConfigBtn" class="roundBorder hidden">Read config</ebo-button>
        </div>        
        `;

    constructor() {
        super(EboSettingsComp.styleText, EboSettingsComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "show_whats_new":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        let scanBtn = shadow.getElementById("scanBtn") as EboButton;
        scanBtn.addEventListener("click", async (ev) => {
            let scanStatus = shadow.getElementById("scanStatus") as HTMLElement;
            scanStatus.innerText = "";
            this.dispatchEboEvent("scanRequested.eboplayer", {});
        });
        let whatsNewBtn = shadow.getElementById("whatsNewBtn") as EboButton;
        whatsNewBtn.addEventListener("click", async (ev) => {
            this.dispatchEboEvent("whatsNewRequested.eboplayer", {});
        });
        let rememberedBtn = shadow.getElementById("rememberedBtn") as EboButton;
        rememberedBtn.addEventListener("click", async (ev) => {
            this.dispatchEboEvent("rememberedRequested.eboplayer", {});
        });
        let configBtn = shadow.getElementById("readConfigBtn") as EboButton;
        configBtn.addEventListener("click", async (ev) => {
            this.dispatchEboEvent("mopidyConfigRequested.eboplayer", {});
        });
    }

    override update(shadow:ShadowRoot) {
        this.updateScanStatus(shadow);
        let whatsNewBtn = shadow.getElementById("whatsNewBtn") as EboButton;
        whatsNewBtn.classList.toggle("hidden", !this.show_whats_new);
    }

    private lastStatusShown = -1;
    private updateScanStatus(shadow: ShadowRoot) {
        let scanStatus = shadow.getElementById("scanStatus") as HTMLElement;
        while(this.lastStatusShown < this.scanStatus.length-1) {
            this.lastStatusShown = this.addScanStatus(scanStatus, shadow, this.lastStatusShown+1);
        }
    }

    private addScanStatus(scanStatus: HTMLElement, shadow: ShadowRoot, statusIndex: number) {
        let status = this.scanStatus[statusIndex];
        switch (status.type) {
            case "progress":
                let detals = scanStatus.appendChild(document.createElement("details"));
                let summary = detals.appendChild(document.createElement("summary"));
                summary.innerText = status.message;
                break;
            case "details": {
                let lastDetails = scanStatus.querySelector("details:last-of-type")!; //! Assuming first message is a progress!
                let div = lastDetails.appendChild(document.createElement("div"));
                div.innerHTML = status.message;
                div.classList.add(status.type);
                break;
            }
            case "error": {
                let lastDetails = scanStatus.querySelector("details:last-of-type")!; //! Assuming first message is a progress!
                let div = lastDetails.appendChild(document.createElement("div"));
                div.innerHTML = status.message;
                div.classList.add(status.type);
                lastDetails.classList.add("error");
                break;
            }
            default:
                unreachable(status.type);
        }
        return statusIndex;
    }
}
