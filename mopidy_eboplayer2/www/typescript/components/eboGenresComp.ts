import {EboComponent} from "./EboComponent";
import {EboButton} from "./eboButton";
import {GenreDef} from "../modelTypes";

export type ExpandedGenreDef = {
    genreDef: GenreDef,
    active: boolean,
}

export class EboGenresComp extends EboComponent {
    static override readonly tagName=  "ebo-genres-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

    private _genreDefs: ExpandedGenreDef[] = [];
    get genreDefs(): ExpandedGenreDef[] {
        return this._genreDefs;
    }

    set genreDefs(value: ExpandedGenreDef[]) {
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
            .active > summary {
                color: orange;
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
                this.showLevel(level);
            });
        });
    }

    override update(shadow:ShadowRoot) {
        let container = shadow.getElementById("scrollContainer") as HTMLElement;
        let nextIndex = this.renderGenreDef(container, 0, -1);
        while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].genreDef.level == 0) {
            nextIndex = this.renderGenreDef(container, nextIndex, -1);
        }
    }

    private renderGenreDef(container: HTMLElement, index: number, parentLevel: number): number {
        //prepare data
        let genreDef = this.genreDefs[index];

        if(genreDef.genreDef.level < parentLevel+1) {
            return index; //we need to jump a parent up.
        }

        let nextGenreDef = this.genreDefs.length > index+1 ? this.genreDefs[index+1]: null;
        let hasChildren = (nextGenreDef?.genreDef.level??-1) > genreDef.genreDef.level;
        let name = genreDef.genreDef.name;
        if(genreDef.genreDef.child) {
            name = genreDef.genreDef.child;
        }

        //start building
        if(hasChildren) {
            let newContainer = document.createElement("details");
            newContainer.open = false;
            newContainer.classList.add("lvl"+(genreDef.genreDef.level+1));
            newContainer.classList.toggle("active", genreDef.active);
            newContainer.dataset.level = (genreDef.genreDef.level+1).toString();
            container.appendChild(newContainer);
            let summary = document.createElement("summary");
            summary.textContent = name;
            newContainer.appendChild(summary);
            let nextIndex = this.renderGenreDef(newContainer, index+1, genreDef.genreDef.level);
            while (nextIndex < this.genreDefs.length && this.genreDefs[nextIndex].genreDef.level == genreDef.genreDef.level+1) {
                nextIndex = this.renderGenreDef(newContainer, nextIndex, genreDef.genreDef.level);
            }
            return nextIndex;
        }
        //no children, just a line
        let newLine = document.createElement("div");
        newLine.classList.add("lvl"+(genreDef.genreDef.level+1));
        newLine.classList.toggle("active", genreDef.active);
        newLine.dataset.level = (genreDef.genreDef.level+1).toString();
        container.appendChild(newLine);
        newLine.textContent = name;
        return index + 1;
    }

    private showLevel(level: number) {
        let detailElements = this.shadow.querySelectorAll("details");
        detailElements.forEach(detailElement => {
            detailElement.open = parseInt(detailElement.dataset.level!) < level;
        });
    }
}
