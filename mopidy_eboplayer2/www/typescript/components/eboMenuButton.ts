import {EboComponent} from "./EboComponent";

export class EboMenuButton extends EboComponent {
    static override readonly tagName=  "ebo-menu-button";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

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
                border: solid white 1px;
                border-radius: 20px 20px 0px 20px;
                position-anchor: --popup-button;
                margin: 0;
                inset: auto;
                bottom: anchor(top);
                right: anchor(right);
                opacity: 0;
                margin-left: 0.25rem;
                background-color: var(--body-background);
                
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
        <button class="menuButton" popovertarget="menu">
            ...
        </button>
        <div popover id="menu" class="popupMenu">
            <slot></slot>
        </div>
        `;

    constructor() {
        super(EboMenuButton.styleText, EboMenuButton.htmlText);
    }

    override onConnected() {
        super.onConnected();
        this.requestRender();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestRender();
        }

    render() {
    }

    closeMenu() {
        (this.getShadow().getElementById("menu") as HTMLElement).hidePopover();
    }
}