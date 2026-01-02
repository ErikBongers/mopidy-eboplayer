// from : https://gist.github.com/RickCarlino/41b8ddd36e41e381c132bbfcd1c31f3a

export namespace JsonRpc {

    /** A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0". */
    export type Version = "2.0";

    /** Method names that begin with the word rpc followed by a period character
     * (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions
     *  and MUST NOT be used for anything else. */
    export type ReservedMethod = string;

    /** An identifier established by the Client that MUST contain a String, Number,
     *  or NULL value if included. If it is not included it is assumed to be a
     *  notification. The value SHOULD normally not be Null and Numbers SHOULD
     *  NOT contain fractional parts [2] */
    export type OptionalId = number | string | void;
    export type Id = number | string;

    export interface Request<T> {
        jsonrpc: Version;
        id: OptionalId;
        params?: T;
    }

    export interface Notification<T> extends Response<T> {
        jsonrpc: Version;
        params?: T;
    }

    export interface Response<T> {
        jsonrpc: Version;
        id: OptionalId;
    }

    export interface ResponseWithId<T> {
        jsonrpc: Version;
        id: Id;
    }

    export interface Success<T> extends ResponseWithId<T> {
        result: T;
    }

    export function isSuccess<T>(response: ResponseWithId<T>): response is Success<T> {
        return Object.hasOwnProperty.call(response, "result");
    }

    export interface Failure<T> extends ResponseWithId<T> {
        error: Error<T>;
    }

    export function isFailure<T>(response: ResponseWithId<T>): response is Failure<T> {
        return Object.hasOwnProperty.call(response, "error");
    }

    export interface Error<T> {
        /** Must be an integer */
        code: number;
        message: string;
        data?: T;
    }

//
// PRE-DEFINED ERROR CODES
//
//
    /** An error occurred on the server while parsing the JSON text. */
    const PARSE_ERROR = -32700;
    /** The JSON sent is not a valid Request object. */
    const INVALID_REQUEST = -32600;
    /** The method does not exist / is not available. */
    const METHOD_NOT_FOUND = -32601;
    /** Invalid method parameter(s). */
    const INVALID_PARAMS = -32602;
    /** Internal JSON-RPC error. */
    const INTERNAL_ERROR = -32603;

//
// TYPE GUARDS (for convinience)
//
//
    /** Determine if data is a properly formatted JSONRPC 2.0 ID. */
    export function isJsonRpcId(input: OptionalId | any): input is OptionalId {
        switch (typeof input) {
            case "string":
                return true;
            case "number":
                return input % 1 != 0;
            case "object":
                let isNull = input === null;
                if (isNull) {
                    console.warn("Use of null ID in JSONRPC 2.0 is discouraged.");
                    return true;
                } else {
                    return false;
                }
            default:
                return false;
        }
    }
}