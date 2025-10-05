import * as fs from "node:fs";

let inputFile = "P:\\mopidy\\mopidy-eboplayer\\scripts\\commands.json";
let outputFileName = "P:\\mopidy\\mopidy-eboplayer\\scripts\\moduleTestFile.ts";
let outFile: fs.WriteStream;

let includeComments = false;

main();

interface FuncDef {
    module: string;
    name: string;
    key: string;
    description: string;
}

function main() {
    process.argv.forEach(function (val, index, array) {
        // console.log(index + ': ' + val);
    });

    let obj = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    // console.log(obj);

    let modules = new Map<string, Set<FuncDef>>();

    for(let key in obj.result) {
        let funcDefJson = obj.result[key];
        let parts = key.split(".");
        parts.shift(); //first item is always core.
        let moduleName = "";
        if(parts.length == 2)
            moduleName = parts.shift();

        let moduleSet = modules.get(moduleName);
        if(!moduleSet) {
            moduleSet = new Set<FuncDef>;
            modules.set(moduleName, moduleSet);
        }

        let functionName = parts.shift();
        functionName = snakeToCamel(functionName);

        let funcDef = {
            module: moduleName,
            name: functionName,
            key,
            description: funcDefJson.description
        };

        moduleSet.add(funcDef);

    }

    outFile = fs.createWriteStream(outputFileName);

    writeLine("class Commands {", 0);
    writeLine("    cor = {", 0);

    modules.forEach((funcDefs, modName) => {
        writeModule(modName, funcDefs, 8);
    });

    writeLine("    }", 0);
    writeLine("}", 0);
    outFile.close();
}

function writeModule(modName: string, funcDefs: Set<FuncDef>, indent: number) {
    if (modName)
        writeLine(`${modName}: {`, indent);

    funcDefs.forEach(funcDef => {
        writeFunction(funcDef, indent+(modName? 4: 0));
    });

    if (modName)
        writeLine(`},`, indent);
}

function writeComments(funcDef: FuncDef, indent: number) {
    let dscrLines = funcDef.description.split("\n");
    dscrLines.forEach((line) => {
        writeLine(`//${line}`, indent);
    });
}

function writeFunction(funcDef: FuncDef, indent: number) {
    if(includeComments)
        writeComments(funcDef, indent);
    writeLine(`${funcDef.name}() {`, indent);
    writeLine(`    let key = "${funcDef.key}";`, indent);
    writeLine("},", indent);
}

function snakeToCamel(name: string) {
    return name.replace(/(_[a-z])/g, (match) =>
        match.toUpperCase().replace("_", "")
    );
}

function writeLine(line: string, indent: number) {
    let indentString = ' '.repeat(indent);
    outFile.write(`${indentString}${line}\n`);
}