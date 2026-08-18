import {ElementDef, Parser} from "../lib/HtmlParserTs/parser";
import {PeekingTokenizer} from "../lib/HtmlParserTs/PeekingTokenizer";
import {getText, HtmlTokenizer} from "../lib/HtmlParserTs/HtmlTokenizer";
export type PlaceHolderType = "content" | "attribute";
export interface PlaceHolder {
    placeHolderId: string;
    elementId: string; //todo: bundle per element. ElementFiller contains a list of placeholders.
    type: PlaceHolderType;
    nodeIndex: number;  //todo: make this depend on type.
    attributeName: string; //todo: make this depend on type.
    textParts: string[]; //place placeholder text in between each array item.
}

export function generateAllPlaceHolders(nodes: (ElementDef | string)[]) {
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

function testRegex() {
    let text = "Hello name and age...";
    let rx = /{(\S+)}/gm;
    let match: RegExpExecArray | null;
    while((match = rx.exec(text)) != null) {
        console.log(match[0], match[1]);
    }
}

function printTokens(text: string) {
    let tok  = new HtmlTokenizer(text);
    while (true) {
        let t = tok.next();
        if (t == null)
            break;
        let txt = getText(t);
        if (txt == ">" || txt == "/>")
            console.log(`|${txt}`);
        else
            process.stdout.write(`|${txt}`);
    }
}

// test();
// testRegex();

function test() {
    let text = "abcd";
    // let cursor = new Cursor(text);
    // let c = cursor.getUpTo("x");
    // if(c)
    //     console.log(cursor.getText(c.start, c.length));
    //
    // return;
    // text = "<div id='test' class='test2'>Hello {name} and <span>World</span></div>";
    // text = "<div id='DaAjdee' class='{DaClaz}'>Hello {DaNaym} and <span>World</span></div>";
    text = "<div>Hello <img id='daImaaz' src='{brol}'/></div>";
    console.log(text);
    // printTokens(text);
    // return;
    let parser = new Parser(new PeekingTokenizer(new HtmlTokenizer(text)));
    let elements = parser.parse();
    console.log(JSON.stringify(elements, null, 2));

    let placeholders = generateAllPlaceHolders(elements);
    console.log(JSON.stringify(placeholders, null, 2));

}

export function template(strings: TemplateStringsArray, ...values: any[]) {
    // console.log(strings, values);
    if(strings.length == 0) return "";
    if(strings.length > 1) {
        throw new Error(`A template cannot contain regular \${} placehoders.`);
    }
    return strings[0];
}

export function attribute(action: "update" | "render" | "noUpdate" = "update"){
    return function attributeDecorator(value: any, context: ClassFieldDecoratorContext) {
        //don' do nott'n...
    }
}

export type ElementId = string;
export type PropertyOptions = {
    action?: "update" | "render" | "noUpdate";
    forwardTo?: ElementId;
};

export function property(options?: PropertyOptions){
    return function attributeDecorator(value: any, context: ClassFieldDecoratorContext) {
        //don' do nott'n...
    }
}
