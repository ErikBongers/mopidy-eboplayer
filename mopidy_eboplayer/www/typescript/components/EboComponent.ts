import {Batching} from "../Batching";
import {EboEventTarget, createEvent, EboEventHandlersEventMap, EboplayerEvent} from "../events";
import {unreachable} from "../global";

export interface HasName {
    tagName: string;
}

export type AttType = "string" | "hide";
export type ElementId = string;
export interface AttDef {
    type: AttType;
    value: unknown;
    updater: Updater | ElementId[] | null;
}

export type Updater = (value: unknown, shadow: ShadowRoot, el: HTMLElement) => void | string;


export abstract class EboComponent extends HTMLElement implements HasName, EboEventTarget {
    get isRendered(): boolean {
        return this._isRendered;
    }
    static globalCss: CSSStyleSheet[] = [];
    static cssCache: Map<string, CSSStyleSheet> = new Map();
    // @ts-ignore
    protected shadow: ShadowRoot;
    protected styleText: string;
    protected divText: string;
    private connected = false;
    private _isRendered = false;
    private static readonly NO_TAG_NAME: string = "todo: override in subclass";
    static tagName: string = EboComponent.NO_TAG_NAME;
    private renderBatching: Batching;
    private updateBatching: Batching;
    protected cssNeeded: string[] = [];
    private attDefs: Map<string, AttDef> = new Map();

    protected constructor(styleText: string, htmlText: string) {
        super();
        this.styleText = styleText;
        this.divText = htmlText;

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

    on<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
    // @ts-ignore
        super.addEventListener(type, listener, options);
    }

    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean {
        return super.dispatchEvent(createEvent(key, args));
    }

    // noinspection JSUnusedGlobalSymbols
    private connectedCallback() {
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
        if (!this._isRendered)
            return;
        this.updateHtmlFromAtts();
        this.testPlugin(this.shadow);
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
        if(this.styleText) {
            let template = document.createElement("template");
            template.innerHTML = this.styleText.trim();
            this.shadow.append(...template.content.childNodes);
        }
        if(this.divText) {
            let template = document.createElement("template");
            template.innerHTML = this.divText.trim();
            this.shadow.append(...template.content.childNodes);
        }
        this.render(this.shadow);
        this._isRendered = true;
    }

    render(shadow: ShadowRoot): void {
        this.requestUpdate();
    };

    getShadow(){
        return this.shadow;
    }

    protected defineAtt(name: string, type: AttType, value: any, updater: Updater | ElementId[] | null = null) {
        this.attDefs.set(name, {type: type, value, updater});
    }

    getAtt = (name: string) => this.attDefs.get(name);

    updateAtts(name: string, _oldValue: string, newValue: string): boolean {
        let attDef = this.getAtt(name);
        if(attDef == undefined)
            return false;

        switch (attDef.type) {
            case "string":
                attDef.value = newValue;
                return true;
            case "hide":
                attDef.value = newValue;
                return true;
            default:
                unreachable(attDef.type);
        }
    }

    updateHtmlFromAtts(shadow: ShadowRoot = this.getShadow()) {
        this.attDefs
            .forEach((attDef, attName) => {
                if (typeof attDef.updater == "function") {
                    let el = this.shadow.getElementById(attName) as HTMLElement;
                    attDef.updater(attDef.value, shadow, el);
                } else if (attDef.updater instanceof Array) {
                    attDef.updater.forEach(elementId => {
                        this.updateHtmlFromAtt(elementId, attDef);
                    });
                } else {
                    this.updateHtmlFromAtt(attName, attDef);
                }
            });
    }

    private updateHtmlFromAtt(elementId: string, attDef: AttDef) {
        let el = this.shadow.getElementById(elementId) as HTMLElement
        if (el == null) {
            console.error("Element with id " + elementId + " not found");
            return;
        }
        switch (attDef.type) {
            case "string":
                el.innerHTML = attDef.value as string;
                break;
            case "hide":
                el.style.display = attDef.value == "true" ? "none" : "";
                break;
            default:
                unreachable(attDef.type);
        }
    }

    setClassFromBoolAttribute(el: HTMLElement, attName: string) {
        // @ts-ignore
        if (this[attName] == true)
            el.classList.add(attName);
        else
            el.classList.remove(attName);
    }

    setTextFromAttribute(attName: string) {
        let el = this.shadow.getElementById(attName);
        if(!el) {
            console.warn(`Element with id "${attName}" not found.`);
            return;
        }

        // @ts-ignore
        if (this[attName])
            { // @ts-ignore
                el.textContent = this[attName];
            }
        else
            el.textContent = "";
    }

    protected updateStringProperty(name: string, newValue: string) {
        // @ts-ignore
        this[name] = newValue;

    }
    protected updateBoolProperty(name: string, newValue: string) {
        if(newValue == null) {
            // @ts-ignore
            this[name] = false;
            return;
        }
        if(newValue == "") {
            // @ts-ignore
            this[name] = true;
            return;
        }
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

    addShadowEventListener(id: string, type: string, listener: (this: HTMLElement, ev: Event) => any) {
        this.shadow.getElementById(id)?.addEventListener(type, listener);
    }

    protected testPlugin(shadow: ShadowRoot) {}
}

