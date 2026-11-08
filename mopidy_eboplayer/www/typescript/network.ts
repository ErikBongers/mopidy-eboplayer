import {MopidyRepository} from "./repositories/mopidyRepository";
import {WebProxy} from "./proxies/webProxy";
import {core, Mopidy, Options} from "../js/mopidy";
import {getHostAndPort, getWebSocketUrl} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {MopidyOnlineRepository} from "./repositories/MopidyOnlineRepository";
import {MopidyProxy} from "./proxies/mopidyProxy";
import {Commands} from "./commands";
import MopidyEventName = core.MopidyEventName;
import {WebRepository} from "./repositories/webRepository";
import {WebOnlineRepository} from "./repositories/WebOnlineRepository";

export interface NetworkProxy {
    mopidyRepository: MopidyRepository;
    webRepository: WebRepository;
    frontWebSocket: JsonRpcController;
    backWebSocket: JsonRpcController;
    onMopidy: (name: MopidyEventName, callback?: any) => void;
    onPlayer: (event: string, callback?: any) => void;
    supervise: (func: (event: string, data: any) => void) => void;
    connectWebsockets: (resetDelay: boolean) => void;
}

export function createConnections(): NetworkProxy {
    let webSocketUrl = getWebSocketUrl(); //todo: this is probably not used. Remove it?
    let connectOptions: Options = {
        webSocketUrl,
        autoConnect: false //important: delay connection until all bindings, listeners and dependencies are setup.
    };
    let mopidy = new Mopidy(connectOptions);
    let hostAndPort = getHostAndPort();
    let protocol =
        typeof document !== "undefined" && document.location.protocol === "https:"
            ? "wss://"
            : "ws://";
    let wsFrontEndUrl = `${protocol}${hostAndPort}/eboplayer/ws/`;
    let frontWebSocket = new JsonRpcController(wsFrontEndUrl, 1000, 64000);

    let wsBackEndUrl = `${protocol}${hostAndPort}/eboback/ws2/`;
    let backWebSocket = new JsonRpcController(wsBackEndUrl, 1000, 64000);

    let mopidyRepository: MopidyRepository = new MopidyOnlineRepository(new MopidyProxy(new Commands(mopidy)));
    let webRepository = new WebOnlineRepository(new WebProxy(hostAndPort));

    function connectWebsockets(resetDelay: boolean = false) {
        console.log("Trying to connect sockets...");
        if(resetDelay) {
            mopidy.resetConnectDelay();
            frontWebSocket.resetConnectDelay();
            backWebSocket.resetConnectDelay();
        }
        mopidy.connect();
        frontWebSocket.connect();
        backWebSocket.connect();
    }

    return {
        mopidyRepository,
        webRepository,
        frontWebSocket,
        backWebSocket,
        onMopidy: (name: MopidyEventName, callback: any) => {
            mopidy.on(name, (data: any) => { //todo: type callback
                callback(data);
                mopidyRepository.on(name, data);
            });
        },
        onPlayer: (event: string, callback: any) => {
            frontWebSocket.on(event, (data: any) => {
                callback(data); //todo: type callback
                //for now, no forward!
                // webRepository.on(event, data);
            });
        },
        supervise: (func: (event: string, data: any) => void) => {
            mopidy.supervise(func);
        },
        connectWebsockets
    };
}

