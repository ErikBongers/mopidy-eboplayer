import {EventEmitter} from "./eventEmitter";
import {JsonRpc} from "./jsonrpc";
import isSuccess = JsonRpc.isSuccess;
import isFailure = JsonRpc.isFailure;
import {Retry} from "./util/retry";

function snakeToCamel(name: string) {
    return name.replace(/(_[a-z])/g, (match) =>
        match.toUpperCase().replace("_", "")
    );
}

type PendingRequest = {resolve: (value: unknown) => void, reject: (reason?:any) => void};

type SendType = "rpc" | "fireAndForget";

type PendingRequests = { [k: string]: PendingRequest};

export class JsonRpcController extends EventEmitter {
    private readonly pendingRequests: PendingRequests;
    private webSocket: WebSocket | null;
    private readonly webSocketUrl: string;
    private retryConnect: Retry;

    constructor(webSocketUrl: string, minDelay: number, maxDelay: number) {
        super();
        this.webSocketUrl = webSocketUrl;
        this.pendingRequests = {};
        this.webSocket = null;
        this.hookUpEvents();
        this.retryConnect = new Retry(minDelay, maxDelay, () => {this.connect();});
    }

    private hookUpEvents() {
        this.on("websocket:close", this.onWebSocketClose);
        this.on("websocket:error", this.handleWebSocketError);
        this.on("websocket:incomingMessage", this.handleMessage);
    }

    resetConnectDelay(){
        this.retryConnect.reset();
    }

    connect() {
        if (this.webSocket) {
            if (this.webSocket.readyState === WebSocket.OPEN)
                return;
            this.webSocket.close();
        }
        this.createWebSocket();
    }

    private createWebSocket() {
        this.webSocket = new WebSocket(this.webSocketUrl); //throws exception, but LATER, so, can't be captured!

        this.webSocket.onclose = (close) => {
            this.emit("websocket:close", close);
        };
        this.webSocket.onerror = (error) => {
            console.log("WebSocket ERROR: ", error);
            this.emit("websocket:error", error);
        };
        this.webSocket.onopen = () => {
            this.retryConnect.reset();
            this.emit("websocket:open");
        };
        this.webSocket.onmessage = (message) => {
            this.emit("websocket:incomingMessage", message);
        };
    }

    private onWebSocketClose(closeEvent: any) {
        Object.keys(this.pendingRequests).forEach((requestId) => {
            const {reject} = this.pendingRequests[requestId];
            delete this.pendingRequests[requestId];
            const error = new ConnectionError("WebSocket closed");
            error.closeEvent = closeEvent;
            reject(error);
        });
        this.retryConnect.retry();
    }

    private handleWebSocketError(error: any) {
        console.warn("WebSocket error:", error.stack || error);
    }

    send(message: Object, type: SendType = "rpc" ){
        switch (this.webSocket?.readyState) {
            case WebSocket.CONNECTING:
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                return Promise.reject(
                    new ConnectionError("WebSocket not connected.")
                );
            default:
                if (type === "fireAndForget") {
                    this.webSocket?.send(JSON.stringify(message));
                    return Promise.resolve();
                }
                return new Promise((resolve, reject) => {
                    const jsonRpcMessage = {
                        ...message,
                        jsonrpc: "2.0",
                        id: this._nextRequestId(),
                    };
                    this.pendingRequests[jsonRpcMessage.id] = {resolve, reject};
                    this.webSocket?.send(JSON.stringify(jsonRpcMessage));
                    this.emit("websocket:outgoingMessage", jsonRpcMessage);
                });
        }
    }

    private handleMessage(message: {data: string}) {
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

    private handleRpcResponse(responseMessage: JsonRpc.ResponseWithId<any>) {
        if (!Object.hasOwnProperty.call(this.pendingRequests, responseMessage.id)) {
            console.warn(
                "Unexpected response received. Message was:",
                responseMessage
            );
            return;
        }
        const {resolve, reject} = this.pendingRequests[responseMessage.id];
        delete this.pendingRequests[responseMessage.id];
        if (isSuccess(responseMessage)) {
            resolve(responseMessage.result);
        } else if (isFailure(responseMessage)) {
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

    private handleEvent(eventMessage: { event: string; }) {
        const data = {...eventMessage};
        // @ts-ignore
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

    constructor(message: string) {
        super(message);
        this.name = "ConnectionError";
    }
}

class ServerError extends Error {
    code: any;
    data: any;

    constructor(message: string) {
        super(message);
        this.name = "ServerError";
    }
}

class OtherError extends Error {
    data: any;

    constructor(message: string) {
        super(message);
        this.name = "OtherError";
    }
}