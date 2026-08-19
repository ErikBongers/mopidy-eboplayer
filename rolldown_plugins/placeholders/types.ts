type AccessModifier = "public" | "private" | "protected";

export interface ClassDef {
    name: string;
    start: number;
    end: number;
    placeHolderIds: string[] | null;
    observedAttDef: ObservedAttDef | null;
}

export interface ObservedAttDef {
    observedAttRaws: string[];
    start: number;
    end: number;
}

export interface PropDef {
    classDef: ClassDef;
    id: {
        name: string;
        start: number;
        end: number;
    },
    start: number;
    end: number;
    accessibility: AccessModifier | null;
}

export interface DecoratorDef {
    propDef: PropDef;
    name: string;
    start: number;
    end: number;
    decoratorArg: string | null;
}

export interface TemplateDef {
    propDef: PropDef;
    id: string;
}