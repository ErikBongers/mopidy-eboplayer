import {Plugin} from 'rolldown';
import {Visitors, walk} from 'zimmerframe';
import {parse} from '@typescript-eslint/typescript-estree';
import type {Node, Program} from 'estree';
import MagicString from 'magic-string';
import {ElementDef, Parser} from "htmlparserts/parser";
import {PeekingTokenizer} from "htmlparserts/PeekingTokenizer";
import {HtmlTokenizer} from "htmlparserts/HtmlTokenizer";
import {PlaceHolder, PlaceHolderType} from "htmlparserts";

type StringifyReplacer = (number | string)[] | null | ((key: any, value: any) => any);

function stringify(value: any, depth: number, replacer: StringifyReplacer, space: string | number) {
    function _build(_key: any, val: any, depth: number, o?: any, isArray?: any): any { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        function depthReplacer (k: any, v: any) {
            if (isArray || depth > 0) {
                if (typeof replacer == "function")
                    v = replacer(k, v);
                if (!k) {
                    isArray = Array.isArray(v);
                    return val = v;
                }
                !o && (o = isArray ? [] : {});
                o[k] = _build(k, v, isArray ? depth : depth - 1);
            }
        }

        if (!val || typeof val != 'object') {
            return val;
        } else {
            isArray = Array.isArray(val);
            JSON.stringify(val, depthReplacer);
            return o || (isArray ? [] : {});
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
    ms: MagicString;
};

function createPlaceHolders(code: string) {
    let parser = new Parser(new PeekingTokenizer(new HtmlTokenizer(code)));
    let elements = parser.parse();
    let placeholders = generateAllPlaceHolders(elements);
    console.log(JSON.stringify(placeholders, null, 2));
}

const placeholdersPlugin = (): Plugin => {
    return {
        name: 'placeholders-plugin',
        transform(code: string, id: string) {
            if (id.includes('eboNowPlayingComp')) {
                const ms = new MagicString(code);
                const ast = parse(code, {range: true}) as Program;

                // Print safely structured JSON output
                // let startPos = 70000;
                // findNodeType(ast, 'VariableDeclaration');

                let state: WalkState = {
                    currentClass: null,
                    templateId: null,
                    templateString: null,
                    isPlaceholderTemplate: false,
                    isTemplateExpression: false,
                    currentPropertyName: null,
                    ms,
                };


                let visitors: Visitors<Node, WalkState> = { //todo: try to get rid of any type. estree.Node or BaseNode doesn't likely work because start and end are in node.loc instead of directly in node.
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
                        if(state.templateString != null)
                            createPlaceHolders(state.templateString);
                        state.ms.overwrite(state.currentClass.end-1, state.currentClass.end, 'private override testPlugin() { console.log("TODO"); }\n}');
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

function generateAllPlaceHolders(nodes: (ElementDef | string)[]) {
    let placeholders: PlaceHolder[] = [];
    //recursively generate placeholders.
    for(let i = 0; i < nodes.length; i++) {
        let element = nodes[i];
        if (typeof element == "string") {
            throw new Error("Top level text can't have placeholders.");
        } else
            generatePlaceHolder(element, placeholders);

    }
    return placeholders;
}

function generatePlaceHolder(element: ElementDef, placeHolders: PlaceHolder[]): void {
    let id = element.attributes.get("id");
    // generate attribute placeholders.
    for (let [attributeName, attrValue] of element.attributes) {
        if (attrValue.includes("{")) {
            if (id == null)
                throw new Error("Element must have an id to use placeholders.");
            placeHolders.push(
                ...createTextPlaceholders(
                    attrValue,
                    "attribute",
                    id,
                    -1,
                    attributeName,
                )
            );
        }
    }
    // generate content placeholders.
    for (let [i, node] of element.nodes.entries()) {
        if (typeof node == "string") {
            placeHolders.push(
                ...createTextPlaceholders(
                    node,
                    "content",
                    id,
                    i,
                    "",
                )
            );
        } else {
            generatePlaceHolder(node, placeHolders);
        }
    }
}

function createTextPlaceholders(text: string, type: PlaceHolderType, elementId: string | undefined, nodeIndex: number, attributeName: string): PlaceHolder[] {

    if (!text.includes("{")) {
        return [];
    }
    if (elementId == null)
        throw new Error("Element must have an id to use placeholders.");

    let placeholders: PlaceHolder[] = [];
    let rx = /{(\S+)}/gm;
    let match: RegExpExecArray | null;
    while((match = rx.exec(text)) != null) {
        let name = match[1];
        placeholders.push({
            placeHolderId: match[1],
            elementId,
            type,
            nodeIndex,
            attributeName,
            textParts: text.split(match[0]),
        });
    }

    return placeholders;
}






// noinspection JSUnusedGlobalSymbols
export default placeholdersPlugin;