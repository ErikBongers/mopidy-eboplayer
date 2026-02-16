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
            h1, h2, h3, h4, h5, h6 {
                margin: 0;
                padding: 0;
                font-size: 1rem;
                font-weight: normal;
                text-align: left;
            }
            h1 {
                font-size: 1.2rem;
                font-weight: bold;
                margin-inline-start: 1rem;
            }
            h2 {
                font-size: 1.1rem;
                font-weight: bold;
                margin-inline-start: 2rem;
            }
            h3 {
                font-size: 1rem;
                margin-inline-start: 3rem;
            }
            h4 {
                font-size: .9rem;
                margin-inline-start: 4rem;
            }
            h5 {
                font-size: .8rem;
                margin-inline-start: 5rem;
            }
            h6 {
                font-size: .7rem;
                margin-inline-start: 6rem;
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
        let name = genreDef.name;
        if(genreDef.child)
            name = genreDef.child;
        let h = "h"+(genreDef.level+1);
        let lineElement = document.createElement(h) as HTMLHeadingElement;
        lineDiv.appendChild(lineElement);
        lineElement.textContent = name;
    }
}
