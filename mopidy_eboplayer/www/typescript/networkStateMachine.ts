import {NetworkProxy} from "./network";

export class NetworkStateMachine {
    private readonly networkProxy: NetworkProxy;

    constructor(networkProxy: NetworkProxy) {
        this.networkProxy = networkProxy;
        window.addEventListener('online', this.updateAppOnlineStatus);
        window.addEventListener('offline', this.updateAppOnlineStatus);
        this.networkProxy.onMopidy('state:online', this.onMopidyOnline);
        this.networkProxy.onMopidy('state:offline', this.onMopidyOffline);

        document.addEventListener("visibilitychange", () => {
            console.log(`page: ${document.visibilityState.toUpperCase()}`);
            if (document.visibilityState === "visible") {
                this.networkProxy.connectWebsockets(true);
            }
        });
        document.addEventListener("focus", () => {
            console.log("page: FOCUS");
            this.networkProxy.connectWebsockets(true);
        });


        this.updateAppOnlineStatus();
    }

    getProxy() {
        return this.networkProxy;
    }

    onMopidyOnline: (state: any) => void = () => {
        console.log('mopidy: ONLINE');
    };
    onMopidyOffline: (state: any) => void = () => {
        console.log('mopidy: OFFLINE');
    };

    updateAppOnlineStatus() {
        if (navigator.onLine) {
            console.log("App: ONLINE");
            // Initialize your Mopidy WebSocket connection here
            // Enable play controls, queue actions, etc.
        } else {
            console.log("App: OFFLINE");
            // 1. Show an "Offline Mode" banner in the UI
            // 2. Hide or disable "Play", "Next", "Pause" buttons
            // 3. Populate your UI views by reading straight from IndexedDB instead of Mopidy
        }
    }
}

