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
                margin-inline-start: 1rem;
            }
            .lvl1 {
                font-size: 1.2rem;
                font-weight: bold;
            }
            .lvl2 {
                font-size: 1.1rem;
                font-weight: bold;
                /*margin-inline-start: 2rem;*/
            }
            .lvl3 {
                font-size: 1rem;
                /*margin-inline-start: 3rem;*/
            }
            .lvl4 {
                font-size: .9rem;
                /*margin-inline-start: 4rem;*/
            }
            .lvl5 {
                font-size: .8rem;
                /*margin-inline-start: 5rem;*/
            }
            .lvl6 {
                font-size: .7rem;
                /*margin-inline-start: 6rem;*/
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
            details summary::marker {
                margin-inline-end: 0 !important;
                margin-right: 0 !important;
                margin: 0 !important;
                padding: 0;
            }
            .hideLvl2 {
                & .lvl2, & .lvl3, & .lvl4, & .lvl5, & .lvl6 {
                    display: none;
                }            
            }
            .hideLvl3 {
                & .lvl3, & .lvl4, & .lvl5, & .lvl6 {
                    display: none;
                }            
            }
            .hideLvl4 {
                & .lvl4, & .lvl5, & .lvl6 {
                    display: none;
                }
            }
            .hideLvl5 {
                & .lvl5, & .lvl6 {
                    display: none;
                }
            }
            .hideLvl6 {
                & .lvl6 {
                    display: none;
                }
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
        let nextIndex = this.renderGenreDef(container, 0, -1);
        while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].level == 0) {
            nextIndex = this.renderGenreDef(container, nextIndex, -1);
        }
    }

    private renderGenreDef(container: HTMLElement, index: number, parentLevel: number): number {
        //prepare data
        let genreDef = this.genreDefs[index];

        if(genreDef.level < parentLevel+1) {
            return index; //we need to jump a parent up.
        }

        let nextGenreDef = this.genreDefs.length > index+1 ? this.genreDefs[index+1]: null;
        let hasChildren = (nextGenreDef?.level??-1) > genreDef.level;
        let name = genreDef.name;
        if(genreDef.child) {
            name = genreDef.child;
        }

        //start building
        if(hasChildren) {
            let newContainer = document.createElement("details");
            newContainer.open = true;
            newContainer.classList.add("lvl"+(genreDef.level+1));
            container.appendChild(newContainer);
            let summary = document.createElement("summary");
            summary.textContent = name;
            newContainer.appendChild(summary);
            let nextIndex = this.renderGenreDef(newContainer, index+1, genreDef.level);
            while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].level == genreDef.level+1) {
                nextIndex = this.renderGenreDef(newContainer, nextIndex, genreDef.level);
            }
            return nextIndex;
        }
        //no children, just a line
        let newLine = document.createElement("div");
        newLine.classList.add("lvl"+(genreDef.level+1));
        container.appendChild(newLine);
        newLine.textContent = name;
        return index + 1;
    }
}
