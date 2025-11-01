import {console_yellow} from "../gui";

export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName {
    static globalCss: CSSStyleSheet[];
    protected shadow: ShadowRoot;

    protected constructor() {
        super();
        this.shadow = this.attachShadow({mode: "open"});
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

}