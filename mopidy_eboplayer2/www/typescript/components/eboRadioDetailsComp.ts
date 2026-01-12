import {EboComponent} from "./EboComponent";
import {ExpandedAlbumModel, ExpandedStreamModel} from "../modelTypes";
import {EboMenuButton} from "./eboMenuButton";

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
                    tr {
                        border-bottom: 1px solid #ffffff80;
                    }
                }
            </style>
        `;
        static htmlText = `
            <div id="wrapper">
                <div id="tableScroller">
                    <table id="tracksTable">
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

    render(shadow:ShadowRoot) {
    }

    override update(shadow:ShadowRoot) {
        let tbody = (shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.streamInfo) {
            this.streamInfo.historyLines.forEach(lineGroup => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let td = tr.appendChild(document.createElement("td"));
                td.innerHTML = lineGroup.join("<br>");
                td.classList.add("selectable");
            });
            let lastRow = tbody.lastElementChild as HTMLTableRowElement;
            if(lastRow)
                lastRow.scrollIntoView({block: "end"});
        }
    }
}