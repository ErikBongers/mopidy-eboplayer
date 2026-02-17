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
            <div class="flexRow">
                <ebo-button data-level="1" toggle><div id="lvl1" class="squircleButton" style="margin-inline-end: .2rem;">1</div></ebo-button>            
                <ebo-button data-level="2" toggle><div id="lvl2" class="squircleButton" style="margin-inline-end: .2rem;">2</div></ebo-button>            
                <ebo-button data-level="3" toggle><div id="lvl3" class="squircleButton" style="margin-inline-end: .2rem;">3</div></ebo-button>            
                <ebo-button data-level="4" toggle><div id="lvl4" class="squircleButton" style="margin-inline-end: .2rem;">4</div></ebo-button>            
                <ebo-button data-level="5" toggle><div id="lvl5" class="squircleButton" style="margin-inline-end: .2rem;">5</div></ebo-button>            
                <ebo-button data-level="6" toggle><div id="lvl6" class="squircleButton" style="margin-inline-end: .2rem;">6</div></ebo-button>            
            </div>
            <div id="scrollContainer"></div>
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
        let eboButtons = shadow.querySelectorAll("ebo-button") as NodeListOf<EboButton>;
        eboButtons.forEach(eboButton => {
            eboButton.addEventListener("click", (ev) => {
                let level = parseInt(eboButton.dataset.level!);
                let eboButtons = shadow.querySelectorAll("ebo-button") as NodeListOf<EboButton>;
                eboButtons.forEach(eboButton => {
                    eboButton.toggleAttribute("pressed", eboButton.dataset.level! <= level.toString());
                });
                let container = shadow.getElementById("scrollContainer") as HTMLElement;
                container.classList.remove(...[...Array(6).keys()].map(x => "hideLvl"+x));
                container.classList.toggle("hideLvl"+(level+1), true);
            });
        });
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
