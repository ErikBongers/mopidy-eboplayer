import {EboComponent} from "./EboComponent";

export class EboProgressBar extends EboComponent {
    static override readonly tagName=  "ebo-progressbar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["position", "min", "max", "button", "active"];
    private position: number = 51;
    private min: number = 0;
    private max: number = 100;
    private active: boolean = false;
    private button: boolean = true;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
        .movingGradient {
            background-color: #555;
        }
        .active .movingGradient {
            --darkGradient: #555;
            background: linear-gradient(to right, var(--darkGradient),
            #2a84a5, var(--darkGradient), #ffffff,
                var(--darkGradient), #ca497c, var(--darkGradient), #9e9c2d, var(--darkGradient), #ee7752, var(--darkGradient),
                #2a84a5
            );
            background-size: 1100% 1100%;  /*Must be a multiple of the number of colors above for a smooth transistion and the last color must be the first*/
            animation: gradient 15s forwards infinite linear;
            animation-timing-function: linear;
            animation-direction: normal;
        }
        .button #button {
                background-color: white;
                width: 3px; 
                display: inline-block;
                box-shadow: 0 0 5px white, 0 0 5px white,  0 0 5px white, 0 0 5px white, 0 0 15px white;
        }
        @keyframes gradient {
            0% {
                background-position: 0% 50%;
            }
            100% {
                background-position: 100% 50%;
            }
        }
        </style>
    `;

    static htmlText = `
        <div style="
            background-color: #444; 
            height: 1px; 
            display: flex; 
            ">
            <div class="movingGradient" style="
                height: 1px;
                display: inline-block;">
            </div>
            <div id="button"></div>
        </div>
        `;

    constructor() {
        super(EboProgressBar.styleText, EboProgressBar.htmlText);
        this.requestRender();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, oldValue: string, newValue: string) {
        switch (name) {
            case "position":
            case "min":
            case "max":
                let test = parseInt(newValue);
                if (isNaN(test))
                    throw `"${name}" attribute should be a number. Current value: "${newValue}"`;
                this[name] = test;
                break;
            case "active":
            case "button":
                this.updateBoolAtrribute(newValue, name);
                break;
        }
        if(!(this.min <= this.position && this.position <= this.max))
            throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
        this.requestRender();
        }

    // noinspection JSUnusedGlobalSymbols
    override connectedCallback() {
    }

    render(shadow:ShadowRoot) {
        let percent = (this.position - this.min) / (this.max-this.min) * 100;
        let styleElement = shadow.appendChild(document.createElement("style"));
        styleElement.innerHTML = `.movingGradient { width: ${percent}%; } `;
        this.setClassFromBoolAttribute(shadow.firstElementChild as HTMLElement, "button");
        this.setClassFromBoolAttribute(shadow.firstElementChild as HTMLElement, "active");
    }

}