import {console_yellow} from "../gui";

export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName {
    static globalCss: CSSStyleSheet[];
    protected shadow: ShadowRoot; //todo: make private and expose only in renderPrepared and updateWhenConnected.
    protected styleTemplate: HTMLTemplateElement;
    protected divTemplate: HTMLTemplateElement;
    private connected = false;
    private static readonly NO_TAG_NAME: string = "todo: override in subclass";
    static tagName: string = EboComponent.NO_TAG_NAME;

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

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
        console_yellow("EboCompoent: connectedCallback");
        this.connected = true;
        this.onConnected();
    }

    onConnected(){
        //todo: make this abstract.
    }

    update() { //todo: aad TS option `noImplicitOverride` and set `override` modifier where needed.
        if (!this.connected)
            return;
        console_yellow("EboCompoent: update");
        //todo: batch updates.
        this.updateWhenConnected();
    }

    updateWhenConnected(): void {
        //should be overridden by subclasses.
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

    static define(comp: new (...args: any[]) => EboComponent) {
        // @ts-ignore
        if((comp as typeof EboComponent).tagName == EboComponent.NO_TAG_NAME)
            throw "Component class should have tagName defined.";
        // @ts-ignore
        customElements.define(comp.tagName, comp);
    }

}

