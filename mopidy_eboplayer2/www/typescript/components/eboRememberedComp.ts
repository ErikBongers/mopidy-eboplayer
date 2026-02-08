import {EboComponent} from "./EboComponent";
import {console_yellow} from "../global";
import {EboButton} from "./eboButton";

export class EboRememberedComp extends EboComponent {
    static override readonly tagName=  "ebo-remembered-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [""];
    static styleText= `
        <style>
        #rememberedTable tr {
            background-color: #ffffff25;
        }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
        <div id="wrapper" class="flexColumn">
            <p>Remembered</p>
        </div>        
        `;

    get rememberedList(): string[] {
        return this._rememberedList;
    }

    set rememberedList(value: string[]) {
        this._rememberedList = value;
        this.update(this.shadow);
    }
    private _rememberedList: string [];

    constructor() {
        super(EboRememberedComp.styleText, EboRememberedComp.htmlText);
        this._rememberedList = [];
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "nada":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
    }

    override update(shadow:ShadowRoot) {
        let wrapper = shadow.getElementById("wrapper") as HTMLElement;
        let table = document.createElement("table");
        table.id = "rememberedTable";
        let tbody = document.createElement("tbody");
        table.appendChild(tbody);
        for(let i=0; i<this.rememberedList.length; i++) {
            let tr = document.createElement("tr");
            tbody.appendChild(tr);
            let td = document.createElement("td");
            tr.appendChild(td);
            td.innerText = this.rememberedList[i];
        }
        wrapper.appendChild(table);
    }
}
