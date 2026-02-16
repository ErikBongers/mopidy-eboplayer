import {EboComponent} from "./EboComponent";
import {console_yellow} from "../global";
import {EboButton} from "./eboButton";
import {GenreDef} from "../modelTypes";

export class EboGenresComp extends EboComponent {
    static override readonly tagName=  "ebo-genres-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

    private _genreDefs: GenreDef[] = [];
    get genreDefs(): GenreDef[] {
        return this._genreDefs;
    }

    set genreDefs(value: GenreDef[]) {
        this._genreDefs = value;
        this.requestUpdate();
    }

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
            #scrollContainer {
                overflow-y: auto;
                flex-grow: 1;
            }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
        <div id="wrapper" class="flexColumn">
            <div id="scrollContainer">
            
            </div>
        </div>        
        `;

    constructor() {
        super(EboGenresComp.styleText, EboGenresComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
    }

    override update(shadow:ShadowRoot) {
        let container = shadow.getElementById("scrollContainer") as HTMLElement;
        this.genreDefs.forEach(genreDef => {
            this.renderGenreDef(container, genreDef);
        });
    }

    private renderGenreDef(container: HTMLElement, genreDef: GenreDef) {
        let lineDiv = document.createElement("div");
        container.appendChild(lineDiv);
        if(genreDef.child)
            lineDiv.textContent = genreDef.child;
        else
            lineDiv.textContent = genreDef.name;
    }
}
