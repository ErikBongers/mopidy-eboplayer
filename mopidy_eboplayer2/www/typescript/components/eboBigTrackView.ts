import {EboComponent} from "./EboComponent";

export class EboBigTrackView extends EboComponent {
    static readonly tagName=  "ebo-big-track-view";
    private shadow: ShadowRoot;
    static progressBarAttributes = ["position", "min", "max", "button", "active"];
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "name", "stream_lines", "extra", "img", "disabled",
        ...EboBigTrackView.progressBarAttributes
    ];
    private name: string = "";
    private stream_lines: string = "";
    private extra: string = "";
    private enabled: boolean = false;
    //for progressBar
    private position: string = "40";
    private min: string = "0";
    private max: string = "100";
    private button: string = "false";
    private active: string = "true";

    private img: string  = "images/default_cover.png";
    private styleTemplate: HTMLTemplateElement;
    private divTemplate: HTMLTemplateElement;

    constructor() {
        super();
        this.styleTemplate = document.createElement("template");
        // noinspection CssUnresolvedCustomProperty
        this.styleTemplate.innerHTML = `
            <style>
                .albumCoverContainer {
                    display: flex;
                    flex-direction: column;
                    flex-wrap: wrap;
                    align-content: center;
                }
                ebo-progressbar {
                    margin-top: .5em;
                }
                .selectable {
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    -o-user-select: text;
                    user-select: text;
                }
            </style>
        `;
        this.divTemplate = document.createElement("template");
        this.divTemplate.innerHTML = `
            <div class="albumCoverContainer">
                <img id="img" src="${this.img}" alt="Album cover"/>
                <ebo-progressbar position="${this.position}" active="${this.active}" button="${this.button}"></ebo-progressbar>
            </div>

            <div id="info">
                <h3 id="name"></h3>
                <div id="stream_lines" class="selectable"></div>
                <div id="extra" class="selectable"></div>
            </div>
        `;
        this.shadow = this.attachShadow({mode: "open"});

        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        if(EboBigTrackView.progressBarAttributes.includes(name)) {
            this[name] = newValue;
            this.shadow.querySelector("ebo-progressbar").setAttribute(name, newValue);
            return;
        }
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
            case "img":
                this[name] = newValue;
                break;
            case "enabled":
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

    render() {
        this.shadow.innerHTML="";
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        ["name", "stream_lines", "extra"].forEach(attName => {
            fragment.getElementById(attName).innerHTML = this[attName];
        });
        let progressBarElement = fragment.querySelector("ebo-progressbar") as HTMLElement;
        //todo: try casting to EboProgressBar class and set attributes directly? Without re-rendering?
        EboBigTrackView.progressBarAttributes.forEach(attName => {
            progressBarElement.setAttribute(attName, this[attName]);//todo: check if each of these causes a re-rendering.
        });
        //todo: image.
        this.shadow.appendChild(fragment);
    }

    //todo: move in a base class.
    setClassFromBoolAttribute(attName: string, el: HTMLElement) {
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }
}