import {EboComponent} from "./EboComponent";

export class EboMenuButton extends EboComponent {
    static readonly tagName=  "ebo-menu-button";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];
    //todo: put all global css files in the same cache as the local ones<
    // make sure they aren't added twice: once from the global specs and once from the indivicual components.
    // noinspection JSUnusedGlobalSymbols
    // cssNeeded = ["vendors/font_awesome/css/font-awesome.css"];

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
                xposition: absolute;
                position-anchor: --popup-button;
                margin: 0;
                inset: auto;
                bottom: anchor(top);
                right: anchor(right);
                opacity: 0;
                margin-left: 0.25rem;
                background-color: var(--body-background);
                
                &:popover-open {
                    xdisplay: grid;
                    opacity: 1;
                }
            }
            
            .flexColumn {
                display: flex;
                flex-direction: column;
                & button {
                    border-color: gray;
                    text-align: left;
                    & i {
                        position: relative;
                        top: 2px;
                    }
                }
            }
            .flexRow {
                display: flex;
                flex-direction: row;
            }
      </style>
    `;

    static htmlText = `
        <button class="menuButton" popovertarget="menu">
            ...
        </button>
        <div popover id="menu" class="popupMenu">
            <div class="flexColumn">
                <button id="" class="roundBorder">Set genre</button>
                <button id="" class="roundBorder">Add to playlist</button>
                <button id="" class="roundBorder">Rename</button>
                <button id="" class="roundBorder">Artist ></button>
                <button id="" class="roundBorder">Album ></button>
                <div class="flexRow">
                    <button id="addTrack" class="roundBorder">
                        <i class="fa fa-plus"></i>
                    </button>
                    <button id="playTrack" class="roundBorder">
                        <i class="fa fa-play"></i>
                    </button>
                </div>
            </div>  
      </div>
        `;

    constructor() {
        super(EboMenuButton.styleText, EboMenuButton.htmlText);
    }

    onConnected() {
        super.onConnected();
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
            case "pressed": //todo: generalize capture of attributes.
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    renderPrepared() {
    }
}