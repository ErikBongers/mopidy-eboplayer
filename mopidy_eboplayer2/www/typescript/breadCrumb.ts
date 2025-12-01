import {FilterBreadCrumbType} from "./modelTypes";

export class BreadCrumb<T> {
    id: number;
    label: string;
    data: T;
    type: string

    private static nextId = 1;

    constructor(label: string, value: T, type: string) {
        this.label = label;
        this.data = value;
        this.id = BreadCrumb.nextId++;
        this.type = type;
    }
}

export class BreadCrumbStack<T extends BreadCrumb<any>> { //todo: use extends Array<BreadCrumb<T>>?
    private breadCrumbStack: T[] = [];

    push(crumb: T) {
        this.breadCrumbStack.push(crumb);
    }

    pop() {
        this.breadCrumbStack.pop();
    }
    list = () => this.breadCrumbStack;

    resetTo(breadCrumb: BreadCrumb<T>) {
        let index = this.breadCrumbStack.findIndex((value, index, obj) => {
            return value.id == breadCrumb.id;
        });
        this.breadCrumbStack = this.breadCrumbStack.slice(0, index+1);
    }

    clear() {
        this.breadCrumbStack = [];
    }

    getLast(): T | undefined {
        if(this.breadCrumbStack.length == 0)
            return undefined;
        return this.breadCrumbStack[this.breadCrumbStack.length-1];
    }

    setArray(breadCrumbsArray: T[]) {
        this.breadCrumbStack = breadCrumbsArray;
    }
}