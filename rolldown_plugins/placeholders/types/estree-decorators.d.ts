import * as estree from 'estree';

declare module 'estree' {
    // 1. Define the missing Decorator node interface
    export interface Decorator extends estree.BaseNode {
        type: 'Decorator';
        expression: estree.Expression;
    }

    // 2. Add the Decorator node to the main Node union type
    export interface NodeMap {
        Decorator: Decorator;
    }

    // 3. Extend existing AST nodes to support the decorators array
    export interface ClassDeclaration extends estree.MaybeNamedClassDeclaration {
        decorators?: Decorator[];
    }

    export interface MethodDefinition extends estree.BaseNode {
        decorators?: Decorator[];
    }

    export interface PropertyDefinition extends estree.BaseNode {
        decorators?: Decorator[];
    }

    export interface AccessorProperty extends estree.BaseNode {
        decorators?: Decorator[];
    }

    export type ExtendedNode =
        | estree.Node
        | Decorator;
        // | TSTypeAnnotation;
}
