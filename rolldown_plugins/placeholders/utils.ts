export type StringifyReplacer = (number | string)[] | null | ((key: any, value: any) => any);

// noinspection JSUnusedGlobalSymbols
export function stringifyWithDepth(value: any, depth: number, replacer: StringifyReplacer, space: string | number) {
    function _build(_key: any, val: any, depth: number, o?: any, isArray?: any): any { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        function depthReplacer(k: any, v: any) {
            if (isArray || depth > 0) {
                if (typeof replacer == "function")
                    v = replacer(k, v);
                if (!k) {
                    isArray = Array.isArray(v);
                    return val = v;
                }
                !o && (o = isArray ? [] : {});
                o[k] = _build(k, v, isArray ? depth : depth - 1);
            }
        }

        if (!val || typeof val != 'object') {
            return val;
        } else {
            isArray = Array.isArray(val);
            JSON.stringify(val, depthReplacer);
            return o || (isArray ? [] : {});
        }
    }

    return JSON.stringify(_build('', value, depth), null, space);
}