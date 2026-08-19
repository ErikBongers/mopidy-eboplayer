import type {TSESTree} from "@typescript-eslint/types";
import MagicString from "magic-string";
import {Visitors} from "zimmerframe";

export type Next = (state?: WalkStateMachine | undefined) => void | TSESTree.Node;
export type NotHandled = false;

export abstract class MachineState {
    classDeclaration(node: TSESTree.ClassDeclaration, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }

    propertyDefinition(node: TSESTree.PropertyDefinition, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }

    decorator(node: TSESTree.Decorator, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }

    objectExpression(node: TSESTree.ObjectExpression, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }

    taggedTemplateExpression(node: TSESTree.TaggedTemplateExpression, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }

    templateLiteral(node: TSESTree.TemplateLiteral, state: WalkStateMachine, next: Next): NotHandled | void {
        return false;
    }
}

export type WalkStateMachine = {
    machineState: MachineState;
    ms: MagicString;
};

export function createVisitors() {
    let visitors: Visitors<TSESTree.Node, WalkStateMachine> = {
        ClassDeclaration(node, {state, next}) {
            if (state.machineState.classDeclaration(node, state, next) === false)
                next(state);
        },
        PropertyDefinition(node, {state, next}) {
            if (state.machineState.propertyDefinition(node, state, next) === false)
                next(state);
        },
        Decorator(node, {state, next}) {
            if (state.machineState.decorator(node, state, next) === false)
                next(state);
        },
        ObjectExpression(node, {state, next}) {
            if (state.machineState.objectExpression(node, state, next) === false)
                next(state);
        },
        TaggedTemplateExpression(node, {state, next}) {
            if (state.machineState.taggedTemplateExpression(node, state, next) === false)
                next(state);
        },
        TemplateLiteral(node, {state, next}) {
            if (state.machineState.templateLiteral(node, state, next) === false)
                next(state);
        }
    };
    return visitors;
}