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
            .lvl1, .lvl2, .lvl3, .lvl4, .lvl5, .lvl6 {
                margin: 0;
                padding: 0;
                font-size: 1rem;
                font-weight: normal;
                text-align: left;
            }
            .lvl1 {
                font-size: 1.2rem;
                font-weight: bold;
                margin-inline-start: 1rem;
            }
            .lvl2 {
                font-size: 1.1rem;
                font-weight: bold;
                margin-inline-start: 2rem;
            }
            .lvl3 {
                font-size: 1rem;
                margin-inline-start: 3rem;
            }
            .lvl4 {
                font-size: .9rem;
                margin-inline-start: 4rem;
            }
            .lvl5 {
                font-size: .8rem;
                margin-inline-start: 5rem;
            }
            .lvl6 {
                font-size: .7rem;
                margin-inline-start: 6rem;
            }
            .hasChildren::before {
                content: "\\25B6";
                color: white;
                position: relative;
                left: -1rem;
                float: left;
                width: 0;
                height: 1rem;
                cursor: pointer;
                font-size: .8rem;
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
        this.genreDefs.forEach((genreDef, index) => {
            if(this.genreDefs.length > index + 1)
                this.renderGenreDef(container, genreDef, this.genreDefs[index+1]);
            else
                this.renderGenreDef(container, genreDef, null);
        });
    }

    private renderGenreDef(container: HTMLElement, genreDef: GenreDef, nextGenreDef: GenreDef | null) {
        let lineDiv = document.createElement("div");
        container.appendChild(lineDiv);
        if(nextGenreDef?.name == genreDef.child)
            lineDiv.classList.add("hasChildren");
        let name = genreDef.name;
        if(genreDef.child) {
            name = genreDef.child;
        }
        lineDiv.textContent = name;
        let lvl = "lvl"+(genreDef.level+1);
        lineDiv.classList.add(lvl);
    }
}
