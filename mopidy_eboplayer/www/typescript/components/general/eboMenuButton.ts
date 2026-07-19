import {EboComponent} from "../EboComponent";

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
                box-shadow: 0 0 40px rgba(255,255,255, .3);
                padding: .7ch;
                border: none;
                border-radius: 15px 15px 0px 15px;
                position-anchor: --popup-button;
                margin: 0;
                inset: auto;
                bottom: anchor(top);
                right: anchor(right);
                opacity: 0;
                margin-inline-start: 0.25rem;
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

    closeMenu() {
        (this.getShadow().getElementById("menu") as HTMLElement).hidePopover();
    }
}