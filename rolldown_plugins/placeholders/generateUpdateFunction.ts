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
    buffer.appendLine(`       let value: unknown;`);
    buffer.appendLine(`       let node: ChildNode;`);
    generatePlaceHolderCode(placeholders, buffer);
    buffer.appendLine("   }");
    buffer.appendLine("//END OF GENERATED CODE");
    return buffer.buffer;
}

function generatePlaceHolderCode(placeholders: PlaceHolder[], buffer: Buffer) {
    for(let placeholder of placeholders) {
        buffer.appendLine(`       el = shadow.getElementById("${placeholder.elementId}")!;`);
        buffer.appendLine(`       value = this.getAtt("${placeholder.placeHolderId}")?.value;`);
        if(placeholder.type == "content") {
            buffer.appendLine(`       node = el.childNodes.item(${placeholder.nodeIndex});`);
            buffer.appendLine(`       if(node == null) {`);
            if (placeholder.nodeIndex == 0)
                buffer.appendLine(`           el.textContent = ${JSON.stringify(placeholder.textParts)}.join(\`{{\${value}}}\`);`);
            else
                buffer.appendLine(`           console.error("Text node to set not found for element #${placeholder.elementId}, node ${placeholder.nodeIndex}, placeholder: ${placeholder.placeHolderId}");`);
            buffer.appendLine(`       } else {`);
            buffer.appendLine(`           node.nodeValue = ${JSON.stringify(placeholder.textParts)}.join(\`{{\${value}}}\`);`);
            buffer.appendLine(`       }`);
        }
    }
}
