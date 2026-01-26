import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";

export type DisplayMode = "line" | "icon";

export class EboListItemComp extends EboComponent {
    static override readonly tagName=  "ebo-list-item";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["selected", "img", "selection_mode", "display", "text", 'image_class'];
    private selected: boolean = false;
    private img: string;
    private selection_mode: boolean;
    private display: DisplayMode = "icon";
    private text: string = "";
    private image_class: string = "";

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
                background-color: var(--playing-background); 
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
            #wrapper {
                display: flex;
                &.line {
                    flex-direction: row;
                    img {
                        display: none;
                    }
                }
                &.icon {
                    flex-direction: column;
                    align-items: center;
                    img {
                        margin-right: 0;
                        width: 5rem;
                        height: 5rem;
                    }
                    font-size: .5rem;
                    #text {
                    width: 5rem;
                    text-align: center;
                    overflow: auto;
                    text-overflow: ellipsis;
                    }
                    #button {
                        display: none;
                    }           
                }
                &.selected {
                    background-color: var(--playing-background); 
                }           
            }
        </style>
    `;

    static htmlText = `
        <div id="wrapper">
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
            case "image_class":
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

    override update(shadow: ShadowRoot) {
        let wrapper = shadow.getElementById("wrapper") as HTMLElement;
        this.setClassFromBoolAttribute(wrapper, "selected");
        wrapper.classList.remove("line", "icon");
        wrapper.classList.add(this.display);
        this.setImage("img", this.img);
        let img = shadow.getElementById("img") as HTMLImageElement;
        if(this.image_class)
            img.classList.add(this.image_class);
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
