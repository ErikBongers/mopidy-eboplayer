import {Batching} from "../Batching";

export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName {
    get rendered(): boolean {
        return this._rendered;
    }
    static globalCss: CSSStyleSheet[];
    private shadow: ShadowRoot; //todo: make private and expose only in renderPrepared and updateWhenConnected.
    protected styleTemplate?: HTMLTemplateElement;
    protected divTemplate?: HTMLTemplateElement;
    private connected = false;
    private _rendered = false;
    private static readonly NO_TAG_NAME: string = "todo: override in subclass";
    static tagName: string = EboComponent.NO_TAG_NAME;
    private renderBatching: Batching;
    private updateBatching: Batching;

    protected constructor(styleText: string, htmlText: string) {
        super();
        if(styleText) {
            this.styleTemplate = document.createElement("template");
            this.styleTemplate.innerHTML = styleText;
        }
        if(htmlText) {
            this.divTemplate = document.createElement("template");
            this.divTemplate.innerHTML = htmlText;
        }
        this.renderBatching = new Batching(this.doRender.bind(this));
        this.updateBatching = new Batching(this.doUpdate.bind(this));
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
        this.shadow = this.attachShadow({mode: "open"});
        this.connected = true;
        this.onConnected();
        this.render();
    }

    onConnected(){}

    update() {
        // noinspection JSIgnoredPromiseFromCall
        this.updateBatching.schedule();
    }
    private doUpdate() { //todo: aad TS option `noImplicitOverride` and set `override` modifier where needed.
        if (!this.connected)
            return;
        if (!this._rendered)
            return;
        this.updateWhenRendered(this.shadow);
    }

    updateWhenRendered(shadow: ShadowRoot): void {
        //should be overridden by subclasses.
    }

    render() {
        // noinspection JSIgnoredPromiseFromCall
        this.renderBatching.schedule();
    }
    private doRender() {
        if(!this.shadow)
            return;
        this.shadow.innerHTML = "";
        if(EboComponent.globalCss) {
            this.shadow.adoptedStyleSheets = EboComponent.globalCss;
        }
        if(this.styleTemplate)
            this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        if(this.divTemplate)
            this.shadow.appendChild(this.divTemplate.content.cloneNode(true));

        this.renderPrepared(this.shadow);
        this._rendered = true;
    }

    abstract renderPrepared(shadow: ShadowRoot): void;

    getShadow(){
        return this.shadow;
    }

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

    addShadowEventListener(id: string, type: string, listener: (this: HTMLElement, ev: MouseEvent) => any) {
        this.shadow.getElementById(id).addEventListener(type, listener);
    }
}

