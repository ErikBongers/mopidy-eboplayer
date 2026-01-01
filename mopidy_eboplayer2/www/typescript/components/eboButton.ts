import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {EboplayerEvents} from "../events";

export class PressedChangeEvent extends Event {
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
    static observedAttributes = ["toggle", "img", "img_pressed", "pressed", "opacity_off", "click", "disabled"];
    private pressed: boolean = false;
    private disabled: boolean = false;
    private img: string;
    private pressTimer: MouseTimer<EboButton>;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 100%;
                opacity: 0.5;
                &.pressed { 
                    opacity: 1; 
                    &.disabled { 
                        opacity: .2; /*if needed, set this too a lower value then when disabled+not pressed. */
                    }
                }
                &.disabled { 
                    opacity: .2; 
                }
            }
        </style>
    `;
    //todo: make a html (or style) template literal function to inject opacity and such.
    // > This function does NOT return a string, but the list of string fragments and placeholders.
    // > The template is rendered later with `this` as the context.

    static htmlText = `
        <button>
            <img id="image" src="" alt="Button image">
        </button>
        `;

    constructor() {
        super(EboButton.styleText, EboButton.htmlText);
        this.pressTimer = new MouseTimer<EboButton>(
            this,
            (source) => this.onClick(source),
            (source, clickCount) => this.onMultiClick(source, clickCount),
            (source) => this.onFilterButtonTimeOut(source)
        );
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
            case "pressed":
            case "disabled":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.requestRender();
        }

    render(shadow:ShadowRoot) {
        let imgTag = shadow.getElementById("image") as HTMLImageElement;
        this.setClassFromBoolAttribute(imgTag, "pressed");
        this.setClassFromBoolAttribute(imgTag, "disabled");
        imgTag.src = this.img ?? "";
        let button = shadow.querySelector("button");
        button.addEventListener("mousedown", (ev) => {
            this.pressTimer.onMouseDown(ev);
        });
        button.addEventListener("mouseup", (ev) => {
            this.pressTimer.onMouseUp(ev);
        });
        button.addEventListener("mouseleave", (ev) => {
            this.pressTimer.onMouseLeave(ev);
        });
    }

    private onClick(eboButton: EboButton) {
        if(this.disabled) return;
        let button = this.getShadow().querySelector("button");
        this.pressed = !this.pressed;
        this.setClassFromBoolAttribute(button, "pressed");
        this.setAttribute("pressed", this.pressed.toString());
        let event = new PressedChangeEvent(this.pressed);
        this.dispatchEvent(event);
    }

    onFilterButtonTimeOut(source: EboButton) {
        this.dispatchEvent(new Event(EboplayerEvents.longPress, {bubbles: true, composed: true}));
    }

    private onMultiClick(eboButton: EboButton, clickCount: number) {
        if(this.disabled) return;
        this.dispatchEvent(new Event("dblclick", {bubbles: true, composed: true}));
    }
}