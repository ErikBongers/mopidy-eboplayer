import {console_yellow} from "../gui";

export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName {
    static globalCss: CSSStyleSheet[];
    protected shadow: ShadowRoot;
    protected styleTemplate: HTMLTemplateElement;
    protected divTemplate: HTMLTemplateElement;

    protected constructor(styleText: string, htmlText: string) {
        super();
        this.shadow = this.attachShadow({mode: "open"});
        this.styleTemplate = document.createElement("template");
        this.divTemplate = document.createElement("template");
        this.styleTemplate.innerHTML = styleText;
        this.divTemplate.innerHTML = htmlText;
    }
        // noinspection JSUnusedGlobalSymbols
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if(oldValue === newValue)
            return;
        this.attributeReallyChangedCallback(name, oldValue, newValue);
    }

    abstract attributeReallyChangedCallback(name: string, oldValue: string, newValue: string): void;

    static setGlobalCss(text: string[]) {
        this.globalCss = text.map(text => {
            let css = new CSSStyleSheet();
            css.replaceSync(text);
            return css;
        });
    }

    render() {
        if(!this.shadow)
            return;
        this.shadow.innerHTML = "";
        if(EboComponent.globalCss) {
            this.shadow.adoptedStyleSheets = EboComponent.globalCss;
        }

        this.renderPrepared();
    }

    abstract renderPrepared(): void;

    setClassFromBoolAttribute(attName: string, el: HTMLElement) {
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }

}