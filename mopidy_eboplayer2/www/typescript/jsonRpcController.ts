import {EventEmitter} from "./eventEmitter";

function snakeToCamel(name: string) {
    return name.replace(/(_[a-z])/g, (match) =>
        match.toUpperCase().replace("_", "")
    );
}

export class JsonRpcController extends EventEmitter {
    private readonly _pendingRequests: {}; //this initialization gets stripped by rolldown!
    private _webSocket: WebSocket;
    private readonly webSocketUrl: string;

    constructor(webSocketUrl: string) {
        super();
        this.webSocketUrl = webSocketUrl;
        this._pendingRequests = {};
        this._webSocket = null;
        this.hookUpEvents();
        //this.connect(); //todo: connect AFTER construction!  > To allow for other events to hook up.
    }

    private hookUpEvents() {
        this.on("websocket:close", this.cleanup);
        this.on("websocket:error", this.handleWebSocketError);
        this.on("websocket:incomingMessage", this.handleMessage);
    }

    connect() {
        if (this._webSocket) {
            if (this._webSocket.readyState === WebSocket.OPEN) {
                return;
            }
            this._webSocket.close();
        }

        this._webSocket = new WebSocket(this.webSocketUrl);

        this._webSocket.onclose = (close) => {
            this.emit("websocket:close", close);
        };
        this._webSocket.onerror = (error) => {
            this.emit("websocket:error", error);
        };
        this._webSocket.onopen = () => {
            this.emit("websocket:open");
        };
        this._webSocket.onmessage = (message) => {
            this.emit("websocket:incomingMessage", message);
        };
    }

    private cleanup(closeEvent: any) {
        Object.keys(this._pendingRequests).forEach((requestId) => {
            const {reject} = this._pendingRequests[requestId];
            delete this._pendingRequests[requestId];
            const error = new ConnectionError("WebSocket closed");
            error.closeEvent = closeEvent;
            reject(error);
        });
    }

    close() {
        if (this._webSocket) {
            this._webSocket.close();
        }
    }

    private handleWebSocketError(error: any) {
        console.warn("WebSocket error:", error.stack || error);
    }

    send(message: Object) {
        switch (this._webSocket.readyState) {
            case WebSocket.CONNECTING:
                return Promise.reject(
                    new ConnectionError("WebSocket is still connecting")
                );
            case WebSocket.CLOSING:
                return Promise.reject(
                    new ConnectionError("WebSocket is closing")
                );
            case WebSocket.CLOSED:
                return Promise.reject(
                    new ConnectionError("WebSocket is closed")
                );
            default:
                return new Promise((resolve, reject) => {
                    const jsonRpcMessage = {
                        ...message,
                        jsonrpc: "2.0",
                        id: this._nextRequestId(),
                    };
                    this._pendingRequests[jsonRpcMessage.id] = {resolve, reject};
                    this._webSocket.send(JSON.stringify(jsonRpcMessage));
                    this.emit("websocket:outgoingMessage", jsonRpcMessage);
                });
        }
    }

    private handleMessage(message) {
        try {
            const data = JSON.parse(message.data);
            if (Object.hasOwnProperty.call(data, "id")) {
                this.handleRpcResponse(data);
            } else if (Object.hasOwnProperty.call(data, "event")) {
                this.handleEvent(data);
            } else {
                console.warn(
                    `Unknown message type received. Message was: ${message.data}`
                );
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                console.warn(
                    `WebSocket message parsing failed. Message was: ${message.data}`
                );
            } else {
                throw error;
            }
        }
    }

    private handleRpcResponse(responseMessage) {
        if (
            !Object.hasOwnProperty.call(this._pendingRequests, responseMessage.id)
        ) {
            console.warn(
                "Unexpected response received. Message was:",
                responseMessage
            );
            return;
        }
        const {resolve, reject} = this._pendingRequests[responseMessage.id];
        delete this._pendingRequests[responseMessage.id];
        if (Object.hasOwnProperty.call(responseMessage, "result")) {
            resolve(responseMessage.result);
        } else if (Object.hasOwnProperty.call(responseMessage, "error")) {
            const error = new ServerError(responseMessage.error.message);
            error.code = responseMessage.error.code;
            error.data = responseMessage.error.data;
            reject(error);
            console.warn("Server returned error:", responseMessage.error);
        } else {
            const error = new OtherError("Response without 'result' or 'error' received");
            error.data = {response: responseMessage};
            reject(error);
            console.warn(
                "Response without 'result' or 'error' received. Message was:",
                responseMessage
            );
        }
    }

    private handleEvent(eventMessage) {
        const data = {...eventMessage};
        delete data.event;
        const eventName = `event:${snakeToCamel(eventMessage.event)}`;
        this.emit("event", [eventName, data]);
        this.emit(eventName, data);
    }

    static idCounter = -1;

    _nextRequestId() {
        return ++JsonRpcController.idCounter;
    }
}

class ConnectionError extends Error {
    closeEvent?: any;

    constructor(message) {
        super(message);
        this.name = "ConnectionError";
    }
}

class ServerError extends Error {
    code: any;
    data: any;

    constructor(message) {
        super(message);
        this.name = "ServerError";
    }
}

class OtherError extends Error {
    data: any;

    constructor(message) {
        super(message);
        this.name = "OtherError";
    }
}