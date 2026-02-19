import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";

export class EboButton extends EboComponent {
    static override readonly tagName=  "ebo-button";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["toggle", "img", "img_pressed", "pressed", "opacity_off", "click", "disabled"];
    private pressed: boolean = false;
    private disabled: boolean = false;
    private img: string;
    private pressTimer: MouseTimer<EboButton>;
    private toggle: boolean = false;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 100%;
            }
            :host {
                opacity: 1;
            }
            :host([toggle]) { 
                opacity: 0.5; 
            }
            :host([pressed]) { 
                opacity: 1; 
            }
            :host([disabled]) {
                opacity: .2; 
            }
        </style>
    `;

    static htmlText = `
        <button>
            <img id="bigImage" src="" alt="Button image">
            <slot></slot>      
            <slot name="on"></slot>     
            <slot name="off"></slot>     
        </button>
        `;

    constructor() {
        super(EboButton.styleText, EboButton.htmlText);
        this.img = "";
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
            case "toggle":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        let button = shadow.querySelector("button") as HTMLButtonElement;
        button.addEventListener("mousedown", (ev) => {
            this.pressTimer.onMouseDown(ev);
        });
        button.addEventListener("mouseup", (ev) => {
            this.pressTimer.onMouseUp(ev);
        });
        button.addEventListener("mouseleave", (ev) => {
            this.pressTimer.onMouseLeave(ev);
        });
        this.requestUpdate();
    }

    override update(shadow: ShadowRoot) {
        let imgTag = shadow.getElementById("bigImage") as HTMLImageElement;
        if(this.img) {
            imgTag.src = this.img;
            imgTag.style.display = "";
        } else {
            imgTag.style.display = "none";
        }
        if(this.toggle)
            this.setClassFromBoolAttribute(imgTag, "pressed");
        this.setClassFromBoolAttribute(imgTag, "disabled");
        let onSlot = shadow.querySelector("slot[name='on']") as HTMLSlotElement;
        let offSlot = shadow.querySelector("slot[name='off']") as HTMLSlotElement;
        onSlot.style.display = this.pressed ? "block" : "none";
        offSlot.style.display = this.pressed ? "none" : "block";
    }

    private onClick(eboButton: EboButton) {
        if(this.disabled) return;
        let button = this.getShadow().querySelector("button") as HTMLButtonElement;
        if(this.toggle) {
            this.pressed = !this.pressed;
            this.setClassFromBoolAttribute(button, "pressed");
            this.setAttribute("pressed", this.pressed.toString());
        }
        this.dispatchEboEvent("pressedChange.eboplayer", { pressed: this.pressed });
    }

    onFilterButtonTimeOut(source: EboButton) {
        this.dispatchEboEvent("longPress.eboplayer", {});
    }

    private onMultiClick(eboButton: EboButton, clickCount: number) {
        if(this.disabled) return;
        this.dispatchEvent(new Event("dblclick", {bubbles: true, composed: true}));
    }
}