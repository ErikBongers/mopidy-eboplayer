import {Plugin} from 'rolldown';
import {walk} from 'zimmerframe';
import {parse} from '@typescript-eslint/typescript-estree';
import MagicString from 'magic-string';
import {createPlaceHolders} from "./placeholders";
import {generateUpdateFunction} from "./generateUpdateFunction";
import {generateProperty} from "./generateProperty";
import type {TSESTree} from '@typescript-eslint/types';
import {createVisitors, MachineState, Next, NotHandled, WalkStateMachine} from "./machine";
import {ClassDef, DecoratorDef, PropDef, TemplateDef} from "./types";

function getPropStringRawValue(node: TSESTree.ObjectLiteralElement, propName: string): string | null {
    if(node.type != "Property")
        return null;
    if(node.key.type != "Identifier")
        return null;
    if(node.key.name == propName) {
        if(node.value.type != "Literal")
            return null;
        return node.value.raw;
    }
    return null;
}

const placeholdersPlugin = (): Plugin => {
    return {
        name: 'placeholders-plugin',
        transform(code: string, id: string) {
            const ms = new MagicString(code);
            const ast = parse(code, {range: true});

            let state: WalkStateMachine = {
                machineState: new StartState(),
                ms,
            };

            walk(ast, state, createVisitors());

            if (ms.hasChanged()) {
                return {
                    code: ms.toString(),
                    map: ms.generateMap({
                        source: id,
                        file: id + '.map',
                        includeContent: true
                    })
                };
            }
            return null;
        }
    };
}

class StartState extends MachineState {
    override classDeclaration(node: TSESTree.ClassDeclaration, state: WalkStateMachine, next: Next) {
        if(!(node.superClass?.type == "Identifier" && node.superClass.name == 'EboComponent'))
            return;
        if(node.id) {
            let machineState = new EboComponentState({name: node.id.name, start: node.range![0], end: node.range![1]});
            next({...state, machineState});
        }
    }
}

class EboComponentState extends MachineState {
    constructor(public classDef: ClassDef) {
        super();
    }
    override propertyDefinition(node: TSESTree.PropertyDefinition, state: WalkStateMachine, next: Next) {
        if(node.key.type != "Identifier")
            return;
        let propDef: PropDef = {
            classDef: this.classDef,
            id: {name: node.key.name, start: node.key.range![0], end: node.key.range![1]},
            start: node.range![0],
            end: node.range![1],
            accessibility: node.accessibility??null,
        };
        //prop could be a decorated thing or "observedAttributes"
        if(node.key.name == "observedAttributes")
            next({...state, machineState: new ObservedAttributesState(propDef)});
        else
            next({...state, machineState: new UndeterminedPropertyState(propDef)});
    }
}

class ObservedAttributesState extends MachineState {
    constructor(public propDef: PropDef) {
        super();
    }
    //todo
}

class UndeterminedPropertyState extends MachineState {
    constructor(public propDef: PropDef) {
        super();
    }
    override decorator(node: TSESTree.Decorator, state: WalkStateMachine, next: Next) {
        if(node.expression.type != "CallExpression")
            return;
        if(node.expression.callee.type != "Identifier")
            return;
        if(node.expression.callee.name == "property") {
            let decoratorDef: DecoratorDef = {
                propDef: this.propDef,
                name: node.expression.callee.name,
                start: node.range![0],
                end: node.range![1],
                decoratorArg: null,
            }
            let propertyDecoratorState = new PropertyDecoratorState(decoratorDef);
            next({...state, machineState: propertyDecoratorState});
            propertyDecoratorState.write(state.ms);
        }
    }

    override taggedTemplateExpression(node: TSESTree.TaggedTemplateExpression, state: WalkStateMachine, next: Next) {
        if(node.tag.type != "Identifier")
            return;
        if(node.tag.name == "template") {
            let templateDef: TemplateDef = {propDef: this.propDef, id: node.tag.name};
            let templateState = new TemplateState(templateDef);
            next({...state, machineState: templateState});
            templateState.write(state.ms);
        }
    }
}

class PropertyDecoratorState extends MachineState {
    private action: string | null = null;
    private forwardTo: string | null = null;

    constructor(public decoratorDef: DecoratorDef) {
        super();
    }

    override objectExpression(node: TSESTree.ObjectExpression, state: WalkStateMachine, next: Next) {
        for(let prop of node.properties) {
            this.forwardTo = getPropStringRawValue(prop,"forwardTo");
            this.action = getPropStringRawValue(prop,"action");
        }
    }

    write(ms: MagicString) {
        ms.remove(this.decoratorDef.start, this.decoratorDef.end);
        ms.overwrite(this.decoratorDef.propDef.id.start, this.decoratorDef.propDef.id.end, "_"+this.decoratorDef.propDef.id.name);
        let buffer = generateProperty(this.decoratorDef.propDef.id.name, "string", `"VALUE!!!"`, this.action, this.forwardTo);
        ms.appendRight(this.decoratorDef.propDef.end, buffer);
    }
}


class TemplateState extends MachineState {
    templateString: string | null = null;
    constructor(public templateDef: TemplateDef) {
        super();
    }

    override templateLiteral(node: TSESTree.TemplateLiteral, state: WalkStateMachine, next: Next): NotHandled | void {
        let fragments = node.quasis;
        if (fragments.length > 1) {
            console.log(`TODO: can't yet handle template strings with embedded variables.`);
            console.log(JSON.stringify(fragments, null, 2));
        }
        let theFragment = fragments[0];
        let templateString = theFragment.value; //todo: assuming type = "TemplateElement"
        this.templateString = templateString.raw;
    }

    write(ms: MagicString) {
        if(this.templateString != null) {
            let buffer = generateUpdateFunction(this.templateDef.propDef.classDef.name, createPlaceHolders(this.templateString));
            ms.overwrite(this.templateDef.propDef.classDef.end - 1, this.templateDef.propDef.classDef.end, buffer + "\n}");
        }
    }
}

// noinspection JSUnusedGlobalSymbols
export default placeholdersPlugin;