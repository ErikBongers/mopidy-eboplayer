import {Plugin} from 'rolldown';
import {Visitors, walk} from 'zimmerframe';
import {parse} from '@typescript-eslint/typescript-estree';
import {ExtendedNode, Program} from 'estree';
import MagicString from 'magic-string';
import {createPlaceHolders} from "./placeholders";
import {generateUpdateFunction} from "./generateUpdateFunction";
import {stringifyWithDepth} from "./utils";

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
    ms: MagicString;
};

const placeholdersPlugin = (): Plugin => {
    return {
        name: 'placeholders-plugin',
        transform(code: string, id: string) {
            if (id.includes('eboNowPlayingComp')) {
                const ms = new MagicString(code);
                const ast = parse(code, {range: true}) as Program;

                let state: WalkState = {
                    currentClass: null,
                    templateId: null,
                    templateString: null,
                    isPlaceholderTemplate: false,
                    isTemplateExpression: false,
                    currentPropertyName: null,
                    ms,
                };


                let visitors: Visitors<ExtendedNode, WalkState> = { //todo: try to get rid of any type. estree.Node or BaseNode doesn't likely work because start and end are in node.loc instead of directly in node.
                    ClassDeclaration(node, {state, next}) {
                        //todo if not an EboComponent, skip.
                        // if(node.superClass?.name === 'EboComponent') {

                        state.currentClass = {
                            name: node.id.name,
                            start: node.range![0],
                            end: node.range![1],
                        };
                        next(state); //nested classes are not possible, so just pass on the current state.
                        state.currentClass = null;
                    },
                    PropertyDefinition(node, {state, next}) {
                        if (state.currentClass == null)
                            return;
                        if(node.key.type != "Identifier")
                            return;
                        state.currentPropertyName = node.key.name;
                        state.templateId = null;
                        next(state);
                        state.templateId = null;
                    },
                    Decorator(node, {state, next}) {
                        console.log(stringifyWithDepth(node, 2, null, 2));
                    },
                    TaggedTemplateExpression(node, {state, next}) {
                        if(state.currentClass == null)
                            return;
                        if(node.tag.type != "Identifier")
                            return; //the template tag should be a plain identifier
                        if(node.tag.name != "template")
                            return;

                        state.isTemplateExpression = true;
                        state.templateId = state.currentPropertyName;
                        next(state);
                        if(state.templateString != null) {
                            let buffer = generateUpdateFunction(createPlaceHolders(state.templateString));
                            state.ms.overwrite(state.currentClass.end - 1, state.currentClass.end, buffer + "\n}");
                            console.log(buffer);
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