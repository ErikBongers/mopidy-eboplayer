import {FilterBreadCrumbType} from "./modelTypes";

export class BreadCrumb<T> {
    id: number;
    label: string;
    data: T;

    private static nextId = 1;

    constructor(label: string, value: T) {
        this.label = label;
        this.data = value;
        this.id = BreadCrumb.nextId++;
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

    getLast() {
        return this.breadCrumbStack[this.breadCrumbStack.length-1];
    }

    setArray(breadCrumbsArray: T[]) {
        this.breadCrumbStack = breadCrumbsArray;
    }
}