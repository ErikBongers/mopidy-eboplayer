import {Buffer} from "./utils";
import {PlaceHolder} from "./placeholders";

export function generateUpdateFunction(className: string, placeholders: PlaceHolder[]) {
    let buffer = new Buffer();
    buffer.appendLine("//START OF GENERATED CODE");
    buffer.appendLine("   override updatePlaceholders(shadow: ShadowRoot) {");
    buffer.appendLine(`       let el: HTMLElement;`);
    buffer.appendLine(`       let value: unknown;`);
    buffer.appendLine(`       let updater: Updater | null;`);
    buffer.appendLine(`       let node: ChildNode;`);
    buffer.appendLine(`       if(${className}["updaters"] == null) ${className}["updaters"] = {};`);
    generatePlaceHolderCode(className, placeholders, buffer);
    buffer.appendLine("   }");
    buffer.appendLine("//END OF GENERATED CODE");
    return buffer.buffer;
}

function generatePlaceHolderCode(className: string, placeholders: PlaceHolder[], buffer: Buffer) {
    for(let placeholder of placeholders) {
        //todo: group per att, so that updater gets called only once...or group by element and store result of updater in attDef?
        buffer.appendLine(`       el = shadow.getElementById("${placeholder.elementId}")!;`);
        buffer.appendLine(`       value = this.getAttribute("${placeholder.placeHolderText}")??"";`);
        buffer.appendLine(`       updater = ${className}.updaters["${placeholder.placeHolderText}"];`);
        buffer.appendLine(`       if(updater != null) {`);
        buffer.appendLine(`           value = updater(value, shadow, el);`);
        buffer.appendLine(`       }`);
        if(placeholder.trueValue) {
            buffer.appendLine(`       if(value == "true")`);
            buffer.appendLine(`           value = "${placeholder.trueValue}";`);
            buffer.appendLine(`       else`);
            buffer.appendLine(`           value = "${placeholder.falseValue??""}"??value;`);
        }
        if(placeholder.type == "content") {
            buffer.appendLine(`       node = el.childNodes.item(${placeholder.nodeIndex});`);
            buffer.appendLine(`       if(node == null) {`);
            if (placeholder.nodeIndex == 0)
                buffer.appendLine(`           el.textContent = ${JSON.stringify(placeholder.textParts)}.join(value);`);
            else
                buffer.appendLine(`           console.error("Text node to set not found for element #${placeholder.elementId}, node ${placeholder.nodeIndex}, placeholder: ${placeholder.placeHolderText}");`);
            buffer.appendLine(`       } else {`);
            buffer.appendLine(`           node.nodeValue = ${JSON.stringify(placeholder.textParts)}.join(value);`);
            buffer.appendLine(`       }`);
        } else if (placeholder.type == "attribute") {
            buffer.appendLine(`       el.setAttribute("${placeholder.attributeName}", ${JSON.stringify(placeholder.textParts)}.join(value));`);
        }
    }
}
