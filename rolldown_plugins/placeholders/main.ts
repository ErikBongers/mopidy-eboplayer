import {Plugin} from 'rolldown';
import {Visitors, walk} from 'zimmerframe';
import {parse} from '@typescript-eslint/typescript-estree';
// import {Program} from 'estree';
import MagicString from 'magic-string';
import {createPlaceHolders} from "./placeholders";
import {generateUpdateFunction} from "./generateUpdateFunction";
import {stringifyWithDepth} from "./utils";
import {generateProperty} from "./generateProperty";
import type {TSESTree} from '@typescript-eslint/types';
import {ObjectExpression} from "@oxc-project/types";

type WalkState = {
    currentClass: {
        name: string;
        start: number;
        end: number;
    } | null;
    templateId: string | null;
    templateString: string | null;
    isPlaceholderTemplate: boolean;
    isTemplateExpression: boolean;
    currentProperty: {
        id: {
            name: string;
            start: number;
            end: number;
        }
        start: number;
        end: number;
        accessibility:  "private" | "protected" | "public" | null;
    } | null;
    ms: MagicString;
    propertyDecorator: {
        action: string | null;
        forwardTo: string | null;
        start: number;
         end: number;
    } | null;
    decoratorArg: string | null;
};

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
            if (id.includes('eboNowPlayingComp')) {
                const ms = new MagicString(code);
                const ast = parse(code, {range: true});

                let state: WalkState = {
                    currentClass: null,
                    templateId: null,
                    templateString: null,
                    isPlaceholderTemplate: false,
                    isTemplateExpression: false,
                    currentProperty: null,
                    ms,
                    propertyDecorator: null,
                    decoratorArg: null,
                };


                let visitors: Visitors<TSESTree.Node, WalkState> = { //todo: try to get rid of any type. estree.Node or BaseNode doesn't likely work because start and end are in node.loc instead of directly in node.
                    ClassDeclaration(node, {state, next}) {
                        //todo if not an EboComponent, skip.
                        // if(node.superClass?.name === 'EboComponent') {

                        if(node.id) {
                            state.currentClass = {
                                name: node.id.name,
                                start: node.range![0],
                                end: node.range![1],
                            };
                            next(state); //nested clas}ses are not possible, so just pass on the current state.
                        }
                        state.currentClass = null;
                    },
                    PropertyDefinition(node, {state, next}) {
                        if (state.currentClass == null)
                            return;
                        if(node.key.type != "Identifier")
                            return;
                        console.log(stringifyWithDepth(node, 2, null, 2));
                        state.currentProperty = {
                            id: {
                                name: node.key.name,
                                start: node.key.range![0],
                                end: node.key.range![1],
                            },
                            start: node.range![0],
                            end: node.range![1],
                            accessibility: node.accessibility??null,
                        };
                        state.templateId = null;
                        next(state);
                        state.templateId = null;
                        state.currentProperty = null;
                    },
                    Decorator(node, {state, next}) {
                        if(state.currentProperty == null)
                            return;
                        console.log(stringifyWithDepth(node, 99, null, 2));
                        if(node.expression.type!= "CallExpression")
                            return;
                        if(node.expression.callee.type != "Identifier")
                            return;
                        if(node.expression.callee.name!= "property")
                            return;
                        state.propertyDecorator = { start: node.range![0], end: node.range![1],action: null, forwardTo: null };
                        next(state);
                        console.log(state.currentProperty);
                        ms.remove(state.propertyDecorator.start, state.propertyDecorator.end);
                        ms.overwrite(state.currentProperty.id.start, state.currentProperty.id.end, "_"+state.currentProperty.id.name);
                        let buffer = generateProperty(state.currentProperty.id.name, "string", `"VALUE!!!"`, state.propertyDecorator.action, state.propertyDecorator.forwardTo);
                        ms.appendRight(state.currentProperty.end, buffer);
                        console.log(buffer);
                        state.propertyDecorator = null;
                    },
                    CallExpression(node, {state, next}) {
                        if(!state.propertyDecorator)
                            return;
                        state.decoratorArg = null;
                        next(state);
                    },
                    ObjectExpression(node, {state, next}) {
                        if(!state.propertyDecorator)
                            return;

                        for(let prop of node.properties) {
                            state.propertyDecorator.forwardTo = getPropStringRawValue(prop,"forwardTo");
                            state.propertyDecorator.action = getPropStringRawValue(prop,"action");
                        }
                    },
                    Literal(node, {state, next}) {
                        if(!state.propertyDecorator)
                            return;
                        state.decoratorArg = node.value as string;
                        console.log(stringifyWithDepth(node, 99, null, 2));
                    },
                    TaggedTemplateExpression(node, {state, next}) {
                        if(state.currentProperty == null)
                            return;
                        if(state.currentClass == null)
                            return;
                        if(node.tag.type != "Identifier")
                            return; //the template tag should be a plain identifier
                        if(node.tag.name != "template")
                            return;

                        state.isTemplateExpression = true;
                        state.templateId = state.currentProperty.id.name;
                        next(state);
                        if(state.templateString != null) {
                            let buffer = generateUpdateFunction(createPlaceHolders(state.templateString));
                            state.ms.overwrite(state.currentClass.end - 1, state.currentClass.end, buffer + "\n}");
                            // console.log(buffer);
                        }
                        state.templateId = null;
                        state.isTemplateExpression = false;
                    },
                    TemplateLiteral(node, {state}) {
                        if (state.templateId == null)
                            return;
                        let fragments = node.quasis;
                        if (fragments.length > 1) {
                            console.log(`TODO: can't yet handle template strings with embedded variables.`);
                            console.log(JSON.stringify(fragments, null, 2));
                        }
                        let theFragment = fragments[0];
                        let templateString = theFragment.value; //todo: assuming type = "TemplateElement"
                        state.templateString = templateString.raw;
                    },
                    MemberExpression(node, {state, next}) {
                        if(state.currentProperty == null)
                            return;
                        console.log(stringifyWithDepth(node, 99, null, 2));
                    }
                };
                walk(ast, state, visitors);

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
            }
            return null;
        }
    };
}


// noinspection JSUnusedGlobalSymbols
export default placeholdersPlugin;