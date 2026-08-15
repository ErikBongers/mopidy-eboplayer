import {Buffer} from "./utils";

export function generateProperty(name: string, type: string, value: string, options: string): string {
    console.log(`PROPERTY ${name}: ${type} = ${value}, options: ${options}`);
    let buffer = new Buffer();
    buffer.appendLine(`        private _${name}: ${type} = ${value};`);
    buffer.appendLine(`        get ${name}(): ${type} {`);
    buffer.appendLine(`            return this._${name};`);
    buffer.appendLine(`        }`);
    buffer.appendLine(`        set ${name}(value: ${type}) {`);
    buffer.appendLine(`            this._${name} = value;`);
    buffer.appendLine(`            this.requestUpdate();`);
    buffer.appendLine(`        }`);
    return buffer.buffer;
}

export function generateAttribute(name: string, type: string, attList: Set<string>): void {
    console.log(`ATTRIBUTE ${name}`);
    attList.add(name);
}