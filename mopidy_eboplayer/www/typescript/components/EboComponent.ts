import {Batching} from "../Batching";
import {createEvent, EboEventHandlersEventMap, EboEventTarget, EboplayerEvent} from "../events";

export interface HasName {
    tagName: string;
}

// export type ElementId = string;
export type Updater = (value: string, shadow: ShadowRoot, el: HTMLElement) => void | string;
export type Updaters = Record<string, (value: string, shadow: ShadowRoot, el: HTMLElement) => string>;


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

        if(this.attributeReallyChangedCallback(name, oldValue, newValue)??true)
            this.requestUpdate();
    }

    abstract attributeReallyChangedCallback(name: string, oldValue: string, newValue: string): boolean | void;

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

    // noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
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
        // this.updateHtmlFromAtts();
        this.updatePlaceholders(this.shadow);
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
        if(this.render(this.shadow)??true)
            this.requestUpdate();
        this._isRendered = true;
    }

    render(shadow: ShadowRoot): void {
    };

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

    addShadowEboEventListener<TEventName extends keyof EboEventHandlersEventMap, TStrOrFnc extends (TEventName | ((this: HTMLElement, ev: Event) => any))> (
        id: string, type: string,
        listener_or_event: TStrOrFnc,
        ...args: TStrOrFnc extends TEventName ? [EboEventHandlersEventMap[TEventName]] : []
    ) {
        if(typeof listener_or_event == "function") {
            this.shadow.getElementById(id)?.addEventListener(type, listener_or_event);
            return;
        }
        this.shadow.getElementById(id)?.addEventListener(type, () => {
            this.dispatchEboEvent(listener_or_event, args[0]!); //! checked by generics.
        });
    }

    // noinspection JSUnusedLocalSymbols
    protected updatePlaceholders(shadow: ShadowRoot) {}
}

export function addShadowEboEventListener<TEventName extends keyof EboEventHandlersEventMap, TStrOrFnc extends (TEventName | ((this: HTMLElement, ev: Event) => any))> (
    element: HTMLElement,
    type: string,
    listener_or_event: TStrOrFnc,
...args: TStrOrFnc extends TEventName ? [EboEventHandlersEventMap[TEventName]] : []
) {
    if(typeof listener_or_event == "function") {
        element.addEventListener(type, listener_or_event);
        return;
    }
    element.addEventListener(type, () => {
        element.dispatchEvent(createEvent(listener_or_event, args[0]!)); //! checked by generics.
    });
}
