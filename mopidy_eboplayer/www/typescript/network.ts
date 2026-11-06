import {MopidyRepository} from "./repositories/mopidyRepository";
import {WebProxy} from "./proxies/webProxy";
import {core, Mopidy, Options} from "../js/mopidy";
import {getHostAndPort} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {MopidyOnlineRepository} from "./repositories/MopidyOnlineRepository";
import {MopidyProxy} from "./proxies/mopidyProxy";
import {Commands} from "./commands";
import MopidyEventName = core.MopidyEventName;

export interface NetworkProxy {
    mopidyRepository: MopidyRepository;
    webProxy: WebProxy;
    frontWebSocket: JsonRpcController;
    backWebSocket: JsonRpcController;
    on: (name: MopidyEventName, callback?: any) => void;
    supervise: (func: (event: string, data: any) => void) => void;
    connectWebsockets: () => void;
}

export function createConnections(connectOptions: Options): NetworkProxy {
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
    let webProxy = new WebProxy(hostAndPort);

    function connectWebsockets() {
        console.log("Trying to connect sockets...");
        mopidy.connect();
        frontWebSocket.connect();
        backWebSocket.connect();
    }

    return {mopidyRepository, webProxy, frontWebSocket, backWebSocket, on: mopidy.on, supervise: mopidy.supervise, connectWebsockets};
}

