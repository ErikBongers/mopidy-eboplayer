import {ElementDef, Parser} from "htmlparserts/parser";
import {PlaceHolder, PlaceHolderType} from "htmlparserts";
import {PeekingTokenizer} from "htmlparserts/PeekingTokenizer";
import {HtmlTokenizer} from "htmlparserts/HtmlTokenizer";

export function attribute(action: "update" | "render" | "noUpdate" = "update"){
    return function attributeDecorator(value: any, context: ClassFieldDecoratorContext) {
        //don' do nott'n...
    }
}
export function property(action: "update" | "render" | "noUpdate" = "update"){
    return function attributeDecorator(value: any, context: ClassFieldDecoratorContext) {
        //don' do nott'n...
    }
}

export function createPlaceHolders(code: string) {
    let parser = new Parser(new PeekingTokenizer(new HtmlTokenizer(code)));
    let nodes = parser.parse();
    let placeholders: PlaceHolder[] = [];
    //recursively generate placeholders.
    for(let i = 0; i < nodes.length; i++) {
        let element = nodes[i];
        if (typeof element == "string") {
            throw new Error("Top level text can't have placeholders.");
        } else
            addPlaceHolder(element, placeholders);

    }
    // console.log(JSON.stringify(placeholders, null, 2));
    return placeholders;
}

function addPlaceHolder(element: ElementDef, placeHolders: PlaceHolder[]): void {
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
            addPlaceHolder(node, placeHolders);
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
