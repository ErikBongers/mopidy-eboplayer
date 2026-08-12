import { walk } from 'zimmerframe';

export default function placeholdersPlugin() {
    return {
        name: 'placeholders-plugin',
        transform(code, id) {
            if (id.includes('eboNowPlayingComp')) {
                console.log(`Transforming ${id}...`);
                // Parse using Rolldown's high-speed parser
                const ast = this.parse(code, { lang: 'ts' });

                // Print safely structured JSON output
                let startPos = 20000;
                console.log(JSON.stringify(ast, null, 2).substring(startPos, startPos + 10000) + '...');
                // findNodeType(ast, 'VariableDeclaration');

                let state = {
                    currentClass: null,
                };

                walk(ast, state,{
                    ClassDeclaration(node, {state, next}) {
                        // if(node.superClass?.name === 'EboComponent') {
                            console.log(node.id.name);
                            state.currentClass = node.id.name;
                            next(state); //nested classes are not possible, so just pass on the current state.
                        // }
                    }

                });

                return code;
            }
            return null;
        }
    };
}
