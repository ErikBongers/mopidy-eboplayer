import {EboPlayerDataType} from "./view";

export interface Parent<Child> {
    addChildren(...children: Child[]): void;

    get children(): Child[];
}

export interface DataRequester {
    getRequiredDataTypes(): EboPlayerDataType[];
    getRequiredDataTypesRecursive(): EboPlayerDataType[];
}

export abstract class NestedDataRequester<T extends NestedDataRequester<T>> implements Parent<T>, DataRequester {
    private _children: T[] = [];

    abstract getRequiredDataTypes(): EboPlayerDataType[];

    getRequiredDataTypesRecursive(): EboPlayerDataType[] {
        return [...this.getRequiredDataTypes(), ...this._children.map(child => child.getRequiredDataTypesRecursive()).flat()];
    }

    addChildren(...children: T[]) {
        this._children.push(...children);
    }

    get children(): T[] {
        return this._children;
    }
}