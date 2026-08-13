import { Plugin } from 'rolldown';
// import type {Program, IdentifierName} from '@oxc-project/types';
import type {Program, BaseNode} from 'estree';
import {Visitors, walk} from 'zimmerframe';


function stringify(val: any, depth: number, replacer: (number | string)[] | null | ((key: any, value: any) => any), space: string | number) {
    function _build(key: any, val: any, depth: number, o?: any, a?: any): any { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        return !val || typeof val != 'object' ? val : (a = Array.isArray(val), JSON.stringify(val, function (k, v) {
            if (a || depth > 0) {
                if (typeof replacer == "function")
                    v = replacer(k, v);
                if (!k)
                    return (a = Array.isArray(v), val = v);
                !o && (o = a ? [] : {});
                o[k] = _build(k, v, a ? depth : depth - 1);
            }
        }), o || (a ? [] : {}));
    }
    return JSON.stringify(_build('', val, depth), null, space);
}

type WalkState = {
    currentClass: {
        name: string;
        start: number;
        end: number;
    } | null;
    templateId: string | null;
    templateString: string | null;
};

const placeholdersPlugin = (): Plugin => {
    return {
        name: 'placeholders-plugin',
        transform(code: string, id: string) {
            if (id.includes('eboNowPlayingComp')) {
                console.log(`Transforming ${id}...`);
                // Parse using Rolldown's high-speed parser
                const ast = this.parse(code, {lang: 'ts'}) as Program;

                // Print safely structured JSON output
                let startPos = 70000;
                // console.log(stringify(ast, 2, null, 2));
                // findNodeType(ast, 'VariableDeclaration');

                let state: WalkState = {
                    currentClass: null,
                    templateId: null,
                    templateString: null,
                };

                let visitors: Visitors<any, WalkState> = { //todo: try to get rid of any type. estree.Node or BaseNode doesn't likely work because start and end are in node.loc instead of directly in node.
                    ClassDeclaration(node, {state, next}) {
                        //todo if not an EboComponent, skip.
                        // if(node.superClass?.name === 'EboComponent') {

                        console.log(stringify(node, 2, null, 2));
                        state.currentClass = {
                            name: node.id.name,
                            start: node.start,
                            end: node.end,
                        };
                        next(state); //nested classes are not possible, so just pass on the current state.
                        state.currentClass = null;
                    },
                    PropertyDefinition(node, {state, next}) {
                        if (state.currentClass == null)
                            return;
                        //Note that decorators don't work yet in browsers.
                        if (node.decorators?.length > 0 && node.decorators[0].expression.name === 'template') {
                            state.templateId = node.key.name;
                            next({...state, templateId: node.key.name});
                            state.templateId = null;
                        }
                        if (node.value.type === 'TaggedTemplateExpression' && node.value.tag.name === 'template') {
                            state.templateId = node.key.name;
                            next(state);
                            // console.log(JSON.stringify(state));
                            state.templateId = null;
                        }
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