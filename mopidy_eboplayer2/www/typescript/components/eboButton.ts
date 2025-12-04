import {EboComponent} from "./EboComponent";
import {EboplayerEvents} from "../modelTypes";
import {console_yellow} from "../gui";
import {MouseTimer} from "../MouseTimer";

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
    static observedAttributes = ["toggle", "img", "img_pressed", "pressed", "opacity_off", "click"];
    private pressed: boolean = false;
    private img: string;
    private imgPressed: string;
    private opacityOff: number = 0.5;
    private pressTimer: MouseTimer<EboButton>;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 100%;
                opacity: 0.5;
                &.pressed { 
                    opacity: 1; 
                }
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
        this.pressTimer = new MouseTimer<EboButton>(
            this,
            (source) => this.onClick(source),
            (source, clickCount) => this.onMultiClick(source, clickCount),
            (source) => this.onTimeOut(source)
        );
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
        imgTag.src = this.img ?? "";
        let button = this.shadow.querySelector("button");
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
        let button = this.shadow.querySelector("button");
        this.pressed = !this.pressed;
        this.setClassFromBoolAttribute("pressed", button);
        this.setAttribute("pressed", this.pressed.toString());
        let event = new PressedChangeEvent(this.pressed);
        this.dispatchEvent(event);
    }

    onTimeOut(source: EboButton) {
        console_yellow("onLongPress");
        this.dispatchEvent(new Event(EboplayerEvents.longPress, {bubbles: true, composed: true}));
    }

    setClassFromBoolAttribute(attName: string, el: HTMLElement) {
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }

    private onMultiClick(eboButton: EboButton, clickCount: number) {
        this.dispatchEvent(new Event("dblclick", {bubbles: true, composed: true}));
    }
}