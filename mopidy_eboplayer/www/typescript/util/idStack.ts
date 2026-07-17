export interface WithId<T> {
    id: T;
}

export class IdStack<T extends WithId<Tid>, Tid> extends Array<T> {
    resetTo(id: number) {
        let index = this.findIndex((breadCrumb, index, obj) => {
            return breadCrumb.id == id;
        });
        this.splice(index + 1);
    }

    getLast(): WithId<Tid> | undefined {
        return this[this.length - 1];
    }

    get(id: number): WithId<Tid> | undefined {
        return this.find(crumb => crumb.id == id);
    }
}