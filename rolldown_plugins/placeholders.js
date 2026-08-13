import { walk } from 'zimmerframe';


function stringify(val, depth, replacer, space) {
    depth = isNaN(+depth) ? 1 : depth;
    function _build(key, val, depth, o, a) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        return !val || typeof val != 'object' ? val : (a=Array.isArray(val), JSON.stringify(val, function(k,v){ if (a || depth > 0) { if (replacer) v=replacer(k,v); if (!k) return (a=Array.isArray(v),val=v); !o && (o=a?[]:{}); o[k] = _build(k, v, a?depth:depth-1); } }), o||(a?[]:{}));
    }
    return JSON.stringify(_build('', val, depth), null, space);
}

export default function placeholdersPlugin() {
    return {
        name: 'placeholders-plugin',
        transform(code, id) {
            if (id.includes('eboNowPlayingComp')) {
                console.log(`Transforming ${id}...`);
                // Parse using Rolldown's high-speed parser
                const ast = this.parse(code, { lang: 'ts' });

                // Print safely structured JSON output
                let startPos = 70000;
                // console.log(stringify(ast, 2, null, 2));
                // findNodeType(ast, 'VariableDeclaration');

                let state = {
                    currentClass: null,
                };

                walk(ast, state,{
                    ClassDeclaration(node, {state, next}) {
                        //todo if not an EboComponent, skip.
                        // if(node.superClass?.name === 'EboComponent') {

                        console.log(stringify(node, 2, null, 2));
                        state.currentClass = {
                            name: node.id.name,
                            start: node.start,
                            end: node.end,
                        };
                        next(state); //nested classes are not possible, so just pass on the current state.
                        state.currentClass = null;
                    },
                    PropertyDefinition(node, {state, next}) {
                        if(state.currentClass == null)
                            return;
                        //Note that decorators don't work yet in browsers.
                        if(node.decorators?.length > 0 && node.decorators[0].expression.name === 'template') {
                            state.templateId = node.key.name;
                            next({...state, templateId: node.key.name});
                            state.templateId = null;
                        }
                        if(node.value.type === 'TaggedTemplateExpression' && node.value.tag.name === 'template') {
                            state.templateId = node.key.name;
                            next(state);
                            // console.log(JSON.stringify(state));
                            state.templateId = null;
                        }
                    },
                    TemplateLiteral(node, {state, next}) {
                        if(state.templateId == null)
                            return;
                        let fragments = node.quasis;
                        if(fragments.length > 1) {
                            console.log(`TODO: can't yet handle template strings with embedded variables.`);
                            console.log(JSON.stringify(fragments, null, 2));
                        }
                        let theFragment = fragments[0];
                        let templateString = theFragment.value; //todo: assuming type = "TemplateElement"
                        state.templateString = templateString.raw;
                    }

                });

                return code;
            }
            return null;
        }
    };
}
