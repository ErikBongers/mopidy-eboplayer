import {NetworkProxy} from "./network";

export class NetworkStateMachine {

    constructor(private networkProxy: NetworkProxy) {
        window.addEventListener('online', this.updateOnlineStatus);
        window.addEventListener('offline', this.updateOnlineStatus);
        this.updateOnlineStatus();
    }

    getProxy() {
        return this.networkProxy;
    }

    updateOnlineStatus() {
        if (navigator.onLine) {
            console.log("App is online. Attempting WebSocket connection to Mopidy...");
            // Initialize your Mopidy WebSocket connection here
            // Enable play controls, queue actions, etc.
        } else {
            console.log("App is offline. Switching UI to read-only mode...");
            // 1. Show an "Offline Mode" banner in the UI
            // 2. Hide or disable "Play", "Next", "Pause" buttons
            // 3. Populate your UI views by reading straight from IndexedDB instead of Mopidy
        }
    }
}

