import * as fs from "node:fs";

//ARGUMENTS
let inputFile = String.raw`D:\Documents\Programming\mopidy\mopidy-eboplayer2\configFiles\musicGenres.md`;
let outputFileName = String.raw`D:\Documents\Programming\mopidy\mopidy-eboplayer2\scripts\genres.sql`;

class Writer {
    private outFile: fs.WriteStream;

    constructor(outFile: fs.WriteStream) {
        this.outFile = outFile;
    }

    indent: number = 0;
    write(text: string, indent?: number) {
        let indentString = indent ? ' '.repeat(indent) : '';
        this.outFile.write(`${indentString}${text}`);
    }

    writeLine(line: string, indent: number) {
        this.write(`${line}\n`, indent);
    }
}

main();

interface LineDef {
    indent: number,
    name: string
}

function main() {
    let text = fs.readFileSync(inputFile, 'utf8');
    let lines = text.split("\n").map(line => line.replace("\r", ""));

    let writer = new Writer(fs.createWriteStream(outputFileName));
    let parentStack: LineDef[] = [];
    let indent: number = 0;
    let level = 0;
    let prevLine: LineDef | null = null;
    lines
        .filter(line => line.trim().length > 0)
        .forEach(line => {
            let parsedLine = parseLine(line);
            let parent: LineDef | null = null;
            if(parsedLine.indent > indent) {
                if(prevLine)
                    parentStack.push(prevLine);
                indent = parsedLine.indent;
                level++;
            } else {
                while (parsedLine.indent < indent) {
                    let newLevel = parentStack.pop();
                    if(!newLevel)
                        break;
                    indent = newLevel.indent;
                    level--;
                }
            }
            if(parentStack.length)
                parent = parentStack[parentStack.length - 1];
            if(parent)
                writer.writeLine(`${level}:${parsedLine.indent}: "${parent.name}" > "${parsedLine.name}"`, 0);
            else
                writer.writeLine(`${level}:${parsedLine.indent}: "${parsedLine.name}" > null`, 0);

            prevLine = parsedLine;
        });
}

function parseLine(line: string): LineDef {
    if(line.startsWith("# "))
        return {indent: 1, name: line.substring(2)};
    if(line.startsWith("## "))
        return {indent: 2, name: line.substring(3)};
    if(line.startsWith("### "))
        return {indent: 3, name: line.substring(4)};
    if(line.startsWith("#### "))
        return {indent: 4, name: line.substring(5)};
    let leadingSpaces = line.search(/\S/);
    return {indent: leadingSpaces+100, name: line.substring(leadingSpaces)};
}