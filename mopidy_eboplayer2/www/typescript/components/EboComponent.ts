import {Batching} from "../Batching";
import EboEventTarget, {createEvent, EboEventHandlersEventMap, EboplayerEvent} from "../events";

export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName, EboEventTarget {
    get rendered(): boolean {
        return this._rendered;
    }
    static globalCss: CSSStyleSheet[] = [];
    static cssCache: Map<string, CSSStyleSheet> = new Map();
    protected shadow: ShadowRoot;
    protected styleTemplate?: HTMLTemplateElement;
    protected divTemplate?: HTMLTemplateElement;
    private connected = false;
    private _rendered = false;
    private static readonly NO_TAG_NAME: string = "todo: override in subclass";
    static tagName: string = EboComponent.NO_TAG_NAME;
    private renderBatching: Batching;
    private updateBatching: Batching;
    protected cssNeeded: string[] = [];

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

    addEboEventListener<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
    // @ts-ignore
        super.addEventListener(type, listener, options);
    }

    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean {
        return super.dispatchEvent(createEvent(key, args));
    }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
        this.shadow = this.attachShadow({mode: "open"});
        this.fetchCssAndCache().then( () => {
            this.connected = true;
            this.onConnected();
            this.requestRender();
        });
    }

    private async fetchCssAndCache() {
        let fetches: Promise<string>[] = [];
        this.cssNeeded.forEach(url => {
            if (!EboComponent.cssCache.has(url)) {
                fetches.push(fetch(url).then(res => res.text()));
            }
        });

        const texts = await Promise.all(fetches);
        texts.forEach((text, i) => {
            let css = new CSSStyleSheet();
            css.replaceSync(text);
            EboComponent.cssCache.set(this.cssNeeded[i], css);
        });
    }

    onConnected(){}

    requestUpdate() {
        // noinspection JSIgnoredPromiseFromCall
        this.updateBatching.schedule();
    }
    private doUpdate() {
        if (!this.connected)
            return;
        if (!this._rendered)
            return;
        this.update(this.shadow);
    }

    update(shadow: ShadowRoot): void {
        //should be overridden by subclasses.
    }

    requestRender() {
        // noinspection JSIgnoredPromiseFromCall
        this.renderBatching.schedule();
    }
    private doRender() {
        if(!this.shadow)
            return;
        this.shadow.innerHTML = "";
        let css = [...EboComponent.globalCss];
        css = css.concat(this.cssNeeded.map(name => EboComponent.cssCache.get(name)!));
        this.shadow.adoptedStyleSheets = css;
        if(this.styleTemplate)
            this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        if(this.divTemplate)
            this.shadow.appendChild(this.divTemplate.content.cloneNode(true));

        this.render(this.shadow);
        this._rendered = true;
    }

    abstract render(shadow: ShadowRoot): void;

    getShadow(){
        return this.shadow;
    }

    setClassFromBoolAttribute(el: HTMLElement, attName: string) {
        // @ts-ignore
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }

    protected updateStringProperty(name: string, newValue: string) {
        // @ts-ignore
        this[name] = newValue;

    }
    protected updateBoolProperty(name: string, newValue: string) {
        if (!["true", "false"].includes(newValue))
            throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
        // @ts-ignore
        this[name] = newValue == "true";
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

