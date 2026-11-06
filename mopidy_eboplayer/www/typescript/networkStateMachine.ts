import {NetworkProxy} from "./network";

export class NetworkStateMachine {

    constructor(private networkProxy: NetworkProxy) {
    }

    getProxy() {
        return this.networkProxy;
    }
}