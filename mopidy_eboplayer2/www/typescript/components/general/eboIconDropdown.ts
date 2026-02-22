import {EboComponent} from "../EboComponent";
import {PlaybackUserOptions} from "../../modelTypes";

export class EboIconDropdown extends EboComponent {
    static override readonly tagName=  "ebo-dropdown";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = ["value"];
    private value: PlaybackUserOptions = "justPlay";

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            .menuButton {
                padding: 0;
                border-radius: 100vw;
                aspect-ratio: 1;
                
                anchor-name: --popup-button;
            }
            
            .popupMenu {
                border: none;
                border-radius: .3rem;
                position-anchor: --popup-button;
                inset: auto;
                top: anchor(bottom);
                left: anchor(left);
                margin: 0;
                padding: .5rem;
                opacity: 0;
                background-color: #444;
                
                &:popover-open {
                    opacity: 1;
                }
            }
            
            .trackButton {
                border-color: gray;
                text-align: left;
                & i {
                    position: relative;
                    top: 2px;
                }
            }
      </style>
    `;

    static htmlText = `
        <button id="menuButton" class="menuButton" popovertarget="menu">
           ??
        </button>
        <div popover id="menu" class="popupMenu">
            <slot></slot>
        </div>
        `;

    constructor() {
        super(EboIconDropdown.styleText, EboIconDropdown.htmlText);
    }

    override onConnected() {
        super.onConnected();
        this.requestRender();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "value":
                this[name] = newValue as PlaybackUserOptions;
                break;
        }
        this.requestUpdate();
        }

    closeMenu() {
        (this.getShadow().getElementById("menu") as HTMLElement).hidePopover();
    }

    override render(shadow:ShadowRoot) {
        let options = this.querySelectorAll("ebo-option");
        options.forEach(option => option.addEventListener("click", (ev) => {
            this.closeMenu();
            let options = this.querySelectorAll("ebo-option");
            options.forEach(option => option.removeAttribute("selected"));
            (ev.currentTarget as HTMLElement).setAttribute("selected", "true");
            let value = (ev.currentTarget as HTMLElement).getAttribute("value");
            this.requestUpdate();
            this.dispatchEboEvent("optionSelected.eboplayer", { selected: value as PlaybackUserOptions});
        }));
        this.requestUpdate();
    }

    override update(shadow:ShadowRoot) {
        //set selected item based on value attribute.
        let options = this.querySelectorAll("ebo-option");
        options.forEach(option => {
            option.toggleAttribute("selected", option.getAttribute("value") === this.value);
        });

        //get selected item and duplicate it in the button.
        let button = shadow.getElementById("menuButton") as HTMLButtonElement;
        let selectedItem = this.querySelector("ebo-option[selected]") as HTMLElement;
        if(!selectedItem) {
            selectedItem = this.querySelector("ebo-option") as HTMLElement;
        }
        if(!selectedItem)
            return;

        let clone = selectedItem.cloneNode(true) as HTMLElement;
        button.innerText = "";
        button.appendChild(clone);
    }
}