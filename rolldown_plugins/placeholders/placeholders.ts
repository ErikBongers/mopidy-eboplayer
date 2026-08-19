import {ElementDef, Parser} from "htmlparserts/parser";
import {PeekingTokenizer} from "htmlparserts/PeekingTokenizer";
import {HtmlTokenizer} from "htmlparserts/HtmlTokenizer";

export type PlaceHolderType = "content" | "attribute";
export interface PlaceHolder {
    placeHolderText: string;
    elementId: string; //todo: bundle per element. ElementFiller contains a list of placeholders.
    type: PlaceHolderType;
    nodeIndex: number;  //todo: make this depend on type.
    attributeName: string; //todo: make this depend on type.
    textParts: string[]; //place placeholder text in between each array item.
    trueValue: string | null;
    falseValue: string | null;
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
        let placeHolder = match[1];
        let placeHolderParts = parsePlaceHolder(placeHolder);
        placeholders.push({
            placeHolderText: placeHolderParts.placeHolderText,
            elementId,
            type,
            nodeIndex,
            attributeName,
            textParts: text.split(match[0]),
            trueValue: placeHolderParts.trueValue,
            falseValue: placeHolderParts.falseValue,
        });
    }

    return placeholders;
}

interface PlaceHolderParts {
    placeHolderText: string;
    trueValue: string | null;
    falseValue: string | null;
}
function parsePlaceHolder(placeHolder: string): PlaceHolderParts {
    let parts = placeHolder.split("?");
    if (parts.length == 1) {
        return {placeHolderText: parts[0], trueValue: null, falseValue: null};
    }
    let parts2 = parts[1].split(":");
    if (parts2.length == 1) {
        return {placeHolderText: parts[0], trueValue: parts2[0], falseValue: null};
    }
    return {placeHolderText: parts[0], trueValue: parts2[0], falseValue: parts2[1]};
}
