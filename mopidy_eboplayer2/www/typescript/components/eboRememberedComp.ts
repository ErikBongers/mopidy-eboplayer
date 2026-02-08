import {EboComponent} from "./EboComponent";
import {console_yellow, searchImageOnGoogle, searchOnGoogle} from "../global";
import {EboButton} from "./eboButton";
import {RemeberIdArgs} from "../events";
import {RememberDef} from "../modelTypes";

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
        <div id="wrapper" class="flexColumn selectable">
            <p>Remembered</p>
            <table id="rememberedTable">
                <colgroup>
                    <col span="1" style="width: auto;">
                    <col span="1" style="width: 1em;">
                </colgroup>
                <tbody></tbody>
            </table>       
        </div>        
        `;

    get rememberedList(): RememberDef[] {
        return this._rememberedList;
    }

    set rememberedList(value: RememberDef[]) {
        this._rememberedList = value;
        this.update(this.shadow);
    }
    private _rememberedList: RememberDef[];

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
        let tbody = shadow.querySelector("tbody") as HTMLTableSectionElement;
        tbody.innerHTML = "";
        for (let remembered of this.rememberedList) {
            let tr = document.createElement("tr");
            tbody.appendChild(tr);
            let td = document.createElement("td");
            tr.appendChild(td);
            td.innerText = remembered.text;
            td.dataset.id = remembered.id;
            let td2 = document.createElement("td");
            tr.appendChild(td2);
            td2.innerHTML = `
                <ebo-menu-button>
                    <div class="flexColumn">
                        <button id="deleteRememberedBtn" class="roundBorder">Delete</button>
                        <button id="deleteAllRememberedBtn" class="roundBorder">Delete all</button>
                        <button id="googleRememberedBtn" class="roundBorder">Google</button>
                    </div>
                </ebo-menu-button>`;
            td2.querySelector("#deleteRememberedBtn")?.addEventListener("click", (ev) => {
                this.dispatchEboEvent("deleteRemember.eboplayer", {"id": remembered.id})
            });
            td2.querySelector("#deleteAllRememberedBtn")?.addEventListener("click", (ev) => {
                console_yellow("deleteAllRememberedBtn");
            });
            td2.querySelector("#googleRememberedBtn")?.addEventListener("click", (ev) => {
                searchOnGoogle(td.innerText);
            });
        }
    }
}
