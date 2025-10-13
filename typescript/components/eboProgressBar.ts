export class EboProgressBar extends HTMLElement {
    private shadow: ShadowRoot;
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["position", "min", "max", "button"];
    private position: number = 50;
    private min: number = 0;
    private max: number = 100;
    private button: boolean = true;
    constructor() {
        super();
        // let template = document.getElementById("history-line") as HTMLTemplateElement;
        // let content = template.content;
        this.shadow = this.attachShadow({mode: "open"});
        // this.root.appendChild(content.cloneNode(true));

        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "position":
            case "min":
            case "max":
                let test = parseInt(newValue);
                if(isNaN(test))
                    throw `"${name}" attribute should be a number. Current value: "${newValue}"`;
                this[name] = test;
                break;
            case "button":
                if(!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this.button = newValue == "true";
                break;
        }
        if(!(this.min <= this.position && this.position <= this.max))
            throw `Attribute position="${this.position}" should be between min="${this.min}" and max="${this.max}".`;
        this[name] = newValue;
        this.render();
        }

    connectedCallback() {
    }


    render() {
        const style = document.createElement("style");
        style.textContent = EboProgressBar.styleText;
        let percent = (this.position - this.min) / (this.max-this.min) * 100;
        this.shadow.innerHTML = `
    <div style="
        background-color: #444; 
        height: 1px; 
        display: flex; 
        margin: 10px;">
        <div class="movingGradient" style="
            width: ${percent}%;
            height: 1px;
            display: inline-block;">
        </div>
        <div style="
            background-color: white;
            width: 3px; 
            display: inline-block;
            box-shadow: 0 0 5px white, 0 0 5px white,  0 0 5px white, 0 0 5px white, 0 0 15px white;">
        </div>
    </div>
`;
        this.shadow.appendChild(style);
    }
    static define() {
        customElements.define("ebo-progressbar", EboProgressBar);
    }

    static styleText = `
.movingGradient {
    --darkGradient: #555;
    background: linear-gradient(to right, var(--darkGradient),
    #2a84a5, var(--darkGradient), #ffffff,
        var(--darkGradient), #872f51, var(--darkGradient), #757421, var(--darkGradient), #ee7752, var(--darkGradient),
        #2a84a5
    );
    background-size: 1100% 1100%;  /*Must be a multiple of the number of colors above for a smooth transistion and the last color must be the first*/
    animation: gradient 15s forwards infinite linear;
    animation-timing-function: linear;
    animation-direction: normal;
}

@keyframes gradient {
    0% {
        background-position: 0% 50%;
    }
    100% {
        background-position: 100% 50%;
    }
}
    `;
}