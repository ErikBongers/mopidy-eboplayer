import {Buffer} from "./utils";

export function generateProperty(name: string, type: string, value: string, action: string | null, forwardTo: string | null): string {
    console.log(`PROPERTY ${name}: ${type} = ${value}, action: ${action}, forwardTo: ${forwardTo}`);
    let buffer = new Buffer();
    buffer.appendLine(`        get ${name}(): ${type} {`);
    buffer.appendLine(`            return this._${name};`);
    buffer.appendLine(`        }`);
    buffer.appendLine(`        set ${name}(value: ${type}) {`);
    buffer.appendLine(`            this._${name} = value;`);
    if(forwardTo != null)
        buffer.appendLine(`            this.getShadow().getElementById(${forwardTo}).${name} = this.${name};`);
    if(action == "render")
        buffer.appendLine(`            this.requestRender();`);
    else if(action == "update")
        buffer.appendLine(`            this.requestUpdate();`);
    else if(action == null && forwardTo == null)
        buffer.appendLine(`            this.requestUpdate();`);
    buffer.appendLine(`        }`);
    return buffer.buffer;
}

export function generateAttribute(name: string, type: string, attList: Set<string>): void {
    console.log(`ATTRIBUTE ${name}`);
    attList.add(name);
}