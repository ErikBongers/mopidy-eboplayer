
export interface HasName {
    tagName: string;
}

export abstract class EboComponent extends HTMLElement implements HasName {
    //todo abstract static registerComponent(ctor: EboComponent);

    protected constructor() {
        super();
    }
        // noinspection JSUnusedGlobalSymbols
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if(oldValue === newValue)
            return;
        this.attributeReallyChangedCallback(name, oldValue, newValue);
    }

    abstract attributeReallyChangedCallback(name: string, oldValue: string, newValue: string): void;
}