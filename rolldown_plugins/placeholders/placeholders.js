//#region node_modules/zimmerframe/src/walk.js
/** @import { Context, Visitor, Visitors } from './types.js' */
/**
* @template {{ type: string }} T
* @template {Record<string, any> | null} U
* @param {T} node
* @param {U} state
* @param {Visitors<T, U>} visitors
*/
function walk(node, state, visitors) {
	const universal = visitors._;
	let stopped = false;
	/** @type {Visitor<T, U, T>} _ */
	function default_visitor(_, { next, state }) {
		next(state);
	}
	/**
	* @param {T} node
	* @param {T[]} path
	* @param {U} state
	* @returns {T | undefined}
	*/
	function visit(node, path, state) {
		if (stopped) return;
		if (!node.type) return;
		/** @type {T | void} */
		let result;
		/** @type {Record<string, any>} */
		const mutations = {};
		/** @type {Context<T, U>} */
		const context = {
			path,
			state,
			next: (next_state = state) => {
				path.push(node);
				for (const key in node) {
					if (key === "type") continue;
					const child_node = node[key];
					if (child_node && typeof child_node === "object") {
						if (Array.isArray(child_node)) {
							/** @type {Record<number, T>} */
							const array_mutations = {};
							const len = child_node.length;
							let mutated = false;
							for (let i = 0; i < len; i++) {
								const node = child_node[i];
								if (node && typeof node === "object") {
									const result = visit(node, path, next_state);
									if (result) {
										array_mutations[i] = result;
										mutated = true;
									}
								}
							}
							if (mutated) mutations[key] = child_node.map((node, i) => array_mutations[i] ?? node);
						} else {
							const result = visit(child_node, path, next_state);
							if (result) mutations[key] = result;
						}
					}
				}
				path.pop();
				if (Object.keys(mutations).length > 0) return apply_mutations(node, mutations);
			},
			stop: () => {
				stopped = true;
			},
			visit: (next_node, next_state = state) => {
				path.push(node);
				const result = visit(next_node, path, next_state) ?? next_node;
				path.pop();
				return result;
			}
		};
		let visitor = visitors[node.type] ?? default_visitor;
		if (universal) {
			/** @type {T | void} */
			let inner_result;
			result = universal(node, {
				...context,
				/** @param {U} next_state */
				next: (next_state = state) => {
					state = next_state;
					inner_result = visitor(node, {
						...context,
						state: next_state
					});
					return inner_result;
				}
			});
			if (!result && inner_result) result = inner_result;
		} else result = visitor(node, context);
		if (!result) {
			if (Object.keys(mutations).length > 0) result = apply_mutations(node, mutations);
		}
		if (result) return result;
	}
	return visit(node, [], state) ?? node;
}
/**
* @template {Record<string, any>} T
* @param {T} node
* @param {Record<string, any>} mutations
* @returns {T}
*/
function apply_mutations(node, mutations) {
	/** @type {Record<string, any>} */
	const obj = {};
	const descriptors = Object.getOwnPropertyDescriptors(node);
	for (const key in descriptors) Object.defineProperty(obj, key, descriptors[key]);
	for (const key in mutations) obj[key] = mutations[key];
	return obj;
}
//#endregion
//#region placeholders.ts
function stringify(val, depth, replacer, space) {
	function _build(key, val, depth, o, a) {
		return !val || typeof val != "object" ? val : (a = Array.isArray(val), JSON.stringify(val, function(k, v) {
			if (a || depth > 0) {
				if (typeof replacer == "function") v = replacer(k, v);
				if (!k) return a = Array.isArray(v), val = v;
				!o && (o = a ? [] : {});
				o[k] = _build(k, v, a ? depth : depth - 1);
			}
		}), o || (a ? [] : {}));
	}
	return JSON.stringify(_build("", val, depth), null, space);
}
const placeholdersPlugin = () => {
	return {
		name: "placeholders-plugin",
		transform(code, id) {
			if (id.includes("eboNowPlayingComp")) {
				console.log(`Transforming ${id}...`);
				walk(this.parse(code, { lang: "ts" }), {
					currentClass: null,
					templateId: null,
					templateString: null
				}, {
					ClassDeclaration(node, { state, next }) {
						console.log(stringify(node, 2, null, 2));
						state.currentClass = {
							name: node.id.name,
							start: node.start,
							end: node.end
						};
						next(state);
						state.currentClass = null;
					},
					PropertyDefinition(node, { state, next }) {
						if (state.currentClass == null) return;
						if (node.decorators?.length > 0 && node.decorators[0].expression.name === "template") {
							state.templateId = node.key.name;
							next({
								...state,
								templateId: node.key.name
							});
							state.templateId = null;
						}
						if (node.value.type === "TaggedTemplateExpression" && node.value.tag.name === "template") {
							state.templateId = node.key.name;
							next(state);
							state.templateId = null;
						}
					},
					TemplateLiteral(node, { state, next }) {
						if (state.templateId == null) return;
						let fragments = node.quasis;
						if (fragments.length > 1) {
							console.log(`TODO: can't yet handle template strings with embedded variables.`);
							console.log(JSON.stringify(fragments, null, 2));
						}
						state.templateString = fragments[0].value.raw;
					}
				});
				return code;
			}
			return null;
		}
	};
};
//#endregion
export { placeholdersPlugin as default };

//# sourceMappingURL=placeholders.js.map