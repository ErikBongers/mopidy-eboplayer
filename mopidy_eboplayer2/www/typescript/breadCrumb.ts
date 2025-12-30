export class BreadCrumb<T, TName extends string> {
    id: number;
    label: string;
    data: T;
    type: TName

    private static nextId = 1;


    constructor(label: string, value: T, type: TName) {
        this.label = label;
        this.data = value;
        this.id = BreadCrumb.nextId++;
        this.type = type;
    }
}

export class BreadCrumbStack<T extends BreadCrumb<any, any>> { //todo: use extends Array<BreadCrumb<T>>?
    private breadCrumbStack: T[] = [];

    push(crumb: T) {
        this.breadCrumbStack.push(crumb);
    }

    pop() {
        return this.breadCrumbStack.pop();
    }
    list = () => this.breadCrumbStack;

    resetTo(id: number) {
        let index = this.breadCrumbStack.findIndex((breadCrumb, index, obj) => {
            return breadCrumb.id == id;
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

    get(id: number): T | undefined {
        return this.breadCrumbStack.find(crumb => crumb.id == id);
    }

    setArray(breadCrumbsArray: T[]) {
        this.breadCrumbStack = breadCrumbsArray;
    }
}