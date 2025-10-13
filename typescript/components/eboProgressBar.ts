import {console_yellow} from "../gui";

export class EboProgressBar extends HTMLElement {
    private shadow: ShadowRoot;
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["position", "min", "max", "button", "active"];
    private position: number = 50;
    private min: number = 0;
    private max: number = 100;
    private active: boolean = false;
    private button: boolean = true;
    private styleTemplate: HTMLTemplateElement;
    private divTemplate: HTMLTemplateElement;

    constructor() {
        super();
        this.styleTemplate = document.createElement("template");
        // noinspection CssUnresolvedCustomProperty
        this.styleTemplate.innerHTML = `
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
</style>`;
        this.divTemplate = document.createElement("template");
        this.divTemplate.innerHTML = `
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
        this.shadow = this.attachShadow({mode: "open"});

        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
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
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        if(!(this.min <= this.position && this.position <= this.max))
            throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
    }


    render() {
        let percent = (this.position - this.min) / (this.max-this.min) * 100;
        this.shadow.innerHTML="";
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let styleElement = this.shadow.appendChild(document.createElement("style"));
        styleElement.innerHTML = `.movingGradient { width: ${percent}%; } `;
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.setClassFromBoolAttribute("button", fragment.firstElementChild as HTMLElement);
        this.setClassFromBoolAttribute("active", fragment.firstElementChild as HTMLElement);
        this.shadow.appendChild(fragment);
    }
    static define() {
        customElements.define("ebo-progressbar", EboProgressBar);
    }

    setClassFromBoolAttribute(attName: string, el: HTMLElement) {
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }
}