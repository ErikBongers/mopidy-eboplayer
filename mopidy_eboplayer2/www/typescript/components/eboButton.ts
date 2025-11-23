import {EboComponent} from "./EboComponent";

class PressedChangeEvent extends Event {
    private _pressed: boolean;

    constructor(pressed: boolean) {
        super("pressedChange");
        this._pressed = pressed;
    }

    get pressed() {
        return this._pressed;
    }
}

export class EboButton extends EboComponent {
    static readonly tagName=  "ebo-button";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["toggle", "img", "img_pressed", "pressed", "opacity_off", "click"];
    private pressed: boolean = false;
    private img: string;
    private imgPressed: string;
    private opacityOff: number = 0.5;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 100%;
                opacity: 0.5;
            }
        </style>
    `;
    //todo: make a html (or style) template literal function to inject opacity and such.
    // > This function does NOT return a string, but the list of string fragments and placeholders.
    // > The template is rendered later with `this` as the context.

    static htmlText = `
        <button>
            <img id="img" src="images/default_cover.png" alt="Button image">
        </button>
        `;

    constructor() {
        super(EboButton.styleText, EboButton.htmlText);
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
            case "pressed":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.shadow.appendChild(fragment);
        let imgTag = this.shadow.getElementById("img") as HTMLImageElement;
        this.setClassFromBoolAttribute("pressed", imgTag);
        imgTag.src = this.img;
        let button = this.shadow.querySelector("button");
        button.addEventListener("click", (ev) => {
            this.pressed = !this.pressed;
            let event = new PressedChangeEvent(this.pressed);
            this.dispatchEvent(event);
        });
    }

    setClassFromBoolAttribute(attName: string, el: HTMLElement) {
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }
}