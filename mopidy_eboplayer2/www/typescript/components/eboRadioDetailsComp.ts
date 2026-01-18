import {EboComponent} from "./EboComponent";
import {ExpandedAlbumModel, ExpandedStreamModel} from "../modelTypes";
import {EboMenuButton} from "./eboMenuButton";
import {console_yellow} from "../global";

export class EboRadioDetailsComp extends EboComponent {
    private _streamInfo: ExpandedStreamModel | null = null;
    get streamInfo(): ExpandedStreamModel | null {
        return this._streamInfo;
    }
    set streamInfo(value: ExpandedStreamModel | null) {
        this._streamInfo = value;
        this.requestUpdate();
    }

    static override readonly tagName=  "ebo-radio-details-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "img",
    ];

    constructor() {
        super(EboRadioDetailsComp.styleText, EboRadioDetailsComp.htmlText);
        this.requestRender();
    }

    static styleText = `
            <style>
                :host { 
                    display: flex;
                    text-align: start;
                } 
                #wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 100%;
                }
                .info {
                    font-size: .7em;
                }
                #tableScroller {
                    overflow: scroll;
                    scrollbar-width: none;
                    height: 100%;    
                }
                #tracksTable {
                    width: 100%;
                    border-collapse: collapse;
                    tr.lastLine {
                        border-bottom: 1px solid #ffffff80;
                    }
                }
            </style>
        `;
        static htmlText = `
            <div id="wrapper">
                <div id="tableScroller">
                    <table id="tracksTable">
                        <colgroup>
                            <col span="1" style="width: auto;">
                            <col span="1" style="width: 1em;">
                        </colgroup>
                        <tbody>
                        </tbody>                
                    </table>
                </div>          
            </div>
            <dialog popover id="albumTrackPopup">
            </dialog>        
        `;

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(_name: string, _oldValue: string, _newValue: string) {
        this.requestUpdate();
        }

    render(shadow:ShadowRoot) { //todo: make overridable.
    }

    override update(shadow:ShadowRoot) {
        let tbody = (shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.streamInfo) {
            this.streamInfo.historyLines.forEach((lineGroup, index) => {
                let tr: HTMLTableRowElement | null = null;
                lineGroup.forEach(line => {
                    tr = tbody.appendChild(document.createElement("tr"));
                    tr.dataset.index = index.toString();
                    let td = tr.appendChild(document.createElement("td"));
                    td.innerHTML = line;
                    td.classList.add("selectable");
                    let td2 = tr.appendChild(document.createElement("td"));
                    td2.innerHTML = `
                        <ebo-menu-button>
                            <div class="flexColumn">
                                <button id="rememberTrack" class="roundBorder">Remember track</button>
                                <button id="excludeLine" class="roundBorder">Exclude line</button>
                                <button id="isProgramTitle" class="roundBorder">Line is program title</button>
                            </div>
                        </ebo-menu-button>`;
                    td2.querySelector("#rememberTrack")?.addEventListener("click", (ev) => {
                        this.saveRemember(ev.target as HTMLElement);
                    });
                    td2.querySelector("#excludeLine")?.addEventListener("click", (ev) => {
                        console_yellow("Exclude line clicked");
                    });
                    td2.querySelector("#isProgramTitle")?.addEventListener("click", (ev) => {
                        console_yellow("Line is program title clicked");
                    });
                });
                if(tr != null)
                    (tr as HTMLTableRowElement).classList.add("lastLine");
            });
            let lastRow = tbody.lastElementChild as HTMLTableRowElement;
            if(lastRow)
                lastRow.scrollIntoView({block: "end"});
        }
    }

    private saveRemember(target: HTMLElement) {
        let lines = this.getLinesForBlock(target);
        if(!lines) {
            console.error("No text found");
            return;
        }
        this.dispatchEboEvent("rememberStreamLines.eboplayer", {lines});
    }

    private getLinesForBlock(target: HTMLElement) {
        let tr = target.closest("tr");
        if(!tr) {
            console.error("No tr found");
            return;
        }
        let index = parseInt(tr.dataset.index ?? "-1");
        if(index == -1) {
            console.error("No index found");
            return;
        }
        let trsWithIndex = tr.closest("tbody")?.querySelectorAll<HTMLTableRowElement>(`tr[data-index="${index}"]`);
        if(!trsWithIndex) {
            console.error("No trs with index found");
            return;
        }
        return [...trsWithIndex].map(tr => tr.cells[0].textContent ?? "--no text--");
    }
}