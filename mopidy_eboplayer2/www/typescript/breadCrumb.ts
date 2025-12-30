import {IdStack, WithId} from "./util/idStack";

export class BreadCrumb<Tdata, TName extends string> implements WithId<number>{
    id: number;
    label: string;
    data: Tdata;
    type: TName

    private static nextId = 1;


    constructor(label: string, value: Tdata, type: TName) {
        this.label = label;
        this.data = value;
        this.id = BreadCrumb.nextId++;
        this.type = type;
    }
}

export class BreadCrumbStack<TName extends string, Tbreadcrumb extends BreadCrumb<any, TName> & WithId<number>,> extends IdStack<Tbreadcrumb, number> {}
