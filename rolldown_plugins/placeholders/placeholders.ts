import {Plugin} from 'rolldown';
import {Visitors, walk} from 'zimmerframe';
import {parse} from '@typescript-eslint/typescript-estree';
import type {Node, Program} from 'estree';

type StringifyReplacer = (number | string)[] | null | ((key: any, value: any) => any);

function stringify(value: any, depth: number, replacer: StringifyReplacer, space: string | number) {
    function _build(key: any, val: any, depth: number, o?: any, a?: any): any { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        function depthReplacer (k: any, v: any) {
            if (a || depth > 0) {
                if (typeof replacer == "function")
                    v = replacer(k, v);
                if (!k) {
                    a = Array.isArray(v);
                    return val = v;
                }
                !o && (o = a ? [] : {});
                o[k] = _build(k, v, a ? depth : depth - 1);
            }
        }

        if (!val || typeof val != 'object') {
            return val;
        } else {
            a = Array.isArray(val);
            JSON.stringify(val, depthReplacer);
            return o || (a ? [] : {});
        }
    }
    return JSON.stringify(_build('', value, depth), null, space);
}

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
    currentPropertyName: string | null;
};

const placeholdersPlugin = (): Plugin => {
    return {
        name: 'placeholders-plugin',
        transform(code: string, id: string) {
            if (id.includes('eboNowPlayingComp')) {
                console.log(`Transforming ${id}...`);
                // Parse using Rolldown's high-speed parser
                const ast = parse(code, {range: true}) as Program;

                // Print safely structured JSON output
                let startPos = 70000;
                // console.log(stringify(ast, 2, null, 2));
                // findNodeType(ast, 'VariableDeclaration');

                let state: WalkState = {
                    currentClass: null,
                    templateId: null,
                    templateString: null,
                    isPlaceholderTemplate: false,
                    isTemplateExpression: false,
                    currentPropertyName: null,
                };


                let visitors: Visitors<Node, WalkState> = { //todo: try to get rid of any type. estree.Node or BaseNode doesn't likely work because start and end are in node.loc instead of directly in node.
                    ClassDeclaration(node, {state, next}) {
                        //todo if not an EboComponent, skip.
                        // if(node.superClass?.name === 'EboComponent') {

                        state.currentClass = {
                            name: node.id.name,
                            start: node.range![0],
                            end: node.range![0],
                        };
                        next(state); //nested classes are not possible, so just pass on the current state.
                        state.currentClass = null;
                    },
                    PropertyDefinition(node, {state, next}) {
                        if (state.currentClass == null)
                            return;
                        console.log(stringify(node, 2, null, 2));
                        if(node.key.type != "Identifier")
                            return;
                        state.currentPropertyName = node.key.name;
                        state.templateId = null;
                        next(state);
                        // console.log(JSON.stringify(state));
                        state.templateId = null;
                    },
                    TaggedTemplateExpression(node, {state, next}) {
                        if(node.tag.type != "Identifier")
                            return; //the template tag should be a plain identifier
                        if(node.tag.name != "template")
                            return;

                        state.isTemplateExpression = true;
                        state.templateId = state.currentPropertyName;
                        next(state);
                        //todo: handle template...
                        console.log(JSON.stringify(state));
                        state.templateId = null;
                        state.isTemplateExpression = false;
                    },
                    TemplateLiteral(node, {state, next}) {
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
                    }
                };
                walk(ast, state, visitors);

                return code;
            }
            return null;
        }
    };
}

export default placeholdersPlugin;