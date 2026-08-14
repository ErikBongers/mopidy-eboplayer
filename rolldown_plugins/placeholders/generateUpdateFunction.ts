import {PlaceHolder} from "htmlparserts";

class Buffer {
    buffer = "";
    appendLine(text: string) {
        this.buffer += text + "\n";
    }
}
export function generateUpdateFunction(placeholders: PlaceHolder[]) {
    let buffer = new Buffer();
    buffer.appendLine("//START OF GENERATED CODE");
    buffer.appendLine("   override testPlugin(shadow: ShadowRoot) {");
    buffer.appendLine(`       let el: HTMLElement;`);
    buffer.appendLine(`       let attDef: AttDef;`);
    buffer.appendLine(`       let value: unknown;`);
    buffer.appendLine(`       let node: ChildNode;`);
    generatePlaceHolderCode(placeholders, buffer);
    buffer.appendLine("   }");
    buffer.appendLine("//END OF GENERATED CODE");
    return buffer.buffer;
}

function generatePlaceHolderCode(placeholders: PlaceHolder[], buffer: Buffer) {
    for(let placeholder of placeholders) {
        //todo: group per att, so that updater gets called only once...or group by element and store result of updater in attDef?
        buffer.appendLine(`       el = shadow.getElementById("${placeholder.elementId}")!;`);
        buffer.appendLine(`       attDef = this.getAtt("${placeholder.placeHolderId}");`);
        buffer.appendLine(`       value = this.getAtt("${placeholder.placeHolderId}")?.value??"???";`);
        buffer.appendLine(`       if(attDef?.updater != null) {`);
        buffer.appendLine(`           value = attDef.updater(value, shadow, el);`);
        buffer.appendLine(`       }`);
        if(placeholder.type == "content") {
            buffer.appendLine(`       node = el.childNodes.item(${placeholder.nodeIndex});`);
            buffer.appendLine(`       if(node == null) {`);
            if (placeholder.nodeIndex == 0)
                buffer.appendLine(`           el.textContent = ${JSON.stringify(placeholder.textParts)}.join(value);`);
            else
                buffer.appendLine(`           console.error("Text node to set not found for element #${placeholder.elementId}, node ${placeholder.nodeIndex}, placeholder: ${placeholder.placeHolderId}");`);
            buffer.appendLine(`       } else {`);
            buffer.appendLine(`           node.nodeValue = ${JSON.stringify(placeholder.textParts)}.join(value);`);
            buffer.appendLine(`       }`);
        } else if (placeholder.type == "attribute") {
            buffer.appendLine(`       el.setAttribute("${placeholder.attributeName}", ${JSON.stringify(placeholder.textParts)}.join(value));`);
        }
    }
}
