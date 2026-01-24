import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";

export type DisplayMode = "line" | "icon";

export class EboListItemComp extends EboComponent {
    static override readonly tagName=  "ebo-list-item";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["selected", "img", "selection_mode", "display", "text"];
    private selected: boolean = false;
    private img: string;
    private selection_mode: boolean;
    private display: DisplayMode = "line";
    private text: string = "";

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 2rem;
                height: 2rem;
                margin-right: 0.5rem;
            }
            :host {
                opacity: 1;
            }
            :host([selected]) { 
                background-color: var(--selected-background); 
            }
            #text {
                flex-grow: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: wrap;
            }
            #button {
                flex-shrink: 1;
                flex-grow: 0;
                padding: 0;
            }
        </style>
    `;

    static htmlText = `
        <div id="wrapper" class="flexRow">
            <img id="img" src="" alt="track image">
            <div id="text"></div>
            <button id="button">...</button>
        </div>       
        `;

    constructor() {
        super(EboListItemComp.styleText, EboListItemComp.htmlText);
        this.img = "";
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
            case "text":
                this[name] = newValue;
                break;
            case "display":
                this.display = newValue as DisplayMode;
                break;
            case "selection_mode":
            case "selected":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    render(shadow:ShadowRoot) {
        this.requestUpdate();
    }

    override update(shadow: ShadowRoot) {
        this.setClassFromBoolAttribute(shadow.getElementById("wrapper") as HTMLElement, "selected");
        this.setImage("img", this.img);
        this.setTextFromAttribute("text");
    }

    setImage(id: string, uri: string | undefined) {
        let imgTag = this.getShadow().getElementById("img") as HTMLImageElement;
        if(uri) {
            imgTag.src = uri;
            imgTag.style.visibility = "visible";
        } else {
            imgTag.style.visibility = "hidden";
        }
    }
}
