import {Options} from "../js/mopidy";
import {Model} from "./model";
import Controller from "./controllers/controller";
import {PlayerBarView} from "./views/playerBarView";
import {EboProgressBar} from "./components/eboProgressBar";
import {NowPlayingView} from "./views/nowPlayingView";
import {EboAlbumTracksComp} from "./components/album/eboAlbumTracksComp";
import {EboComponent} from "./components/EboComponent";
import {MainView} from "./views/mainView";
import {EboBrowseComp} from "./components/browse/eboBrowseComp";
import {EboButton} from "./components/general/eboButton";
import {getWebSocketUrl} from "./global";
import {EboBigAlbumComp} from "./components/album/eboBigAlbumComp";
import {EboPlayerBar} from "./components/eboPlayerBar";
import {EboMenuButton} from "./components/general/eboMenuButton";
import {EboListButtonBar} from "./components/eboListButtonBar";
import {PlayController} from "./controllers/playController";
import {EboDialog} from "./components/eboDialog";
import {EboAlbumDetails} from "./components/album/eboAlbumDetails";
import {EboRadioHistoryComp} from "./components/radio/eboRadioHistoryComp";
import {EboBrowseFilterComp} from "./components/browse/eboBrowseFilterComp";
import {EboSettingsComp} from "./components/eboSettingsComp";
import {EboListItemComp} from "./components/eboListItemComp";
import {BrowseView} from "./views/browseView";
import {AlbumView} from "./views/albumView";
import {State} from "./playerState";
import {EboRememberedComp} from "./components/eboRememberedComp";
import {RememberedView} from "./views/rememberedView";
import {CacheHandler} from "./controllers/cacheHandler";
import {EboOption} from "./components/general/eboOption";
import {EboIconDropdown} from "./components/general/eboIconDropdown";
import {EboGenresComp} from "./components/eboGenresComp";
import {GenresView} from "./views/genresView";
import {EboBigRadioComp} from "./components/radio/eboBigRadioComp";
import {RadioView} from "./views/radioView";
import {EboRadioDetails} from "./components/radio/eboRadioDetails";
import {EboNowPlayingComp} from "./components/eboNowPlayingComp";
import {EboTopBar} from "./components/eboTopBar";
import {TopBarView} from "./views/topBarView";
import {SettingsView} from "./views/settingsView";
import {View} from "./views/view";
import {EboTracklistComp} from "./components/eboTracklistComp";
import {UpdateCache} from "./messages";
import {createConnections} from "./network";
import {NetworkStateMachine} from "./networkStateMachine";

// @ts-ignore
const BUILD_VERSION = __BUILD_VERSION__; // Replaced during build step

const STORED_VERSION = 'storedVersion';

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('serviceWorker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
        let storedVersion = localStorage.getItem(STORED_VERSION)??"";
        if(storedVersion != BUILD_VERSION) {
            localStorage.setItem(STORED_VERSION, BUILD_VERSION);
            navigator.serviceWorker.ready.then((registration) => {
                // Send the version to the active service worker
                if (registration.active) {
                    let message: UpdateCache = {
                        type: "updateCache",
                        newVersion: BUILD_VERSION,
                        oldVersion: storedVersion
                    };
                    registration.active.postMessage(message);
                }
            });
        }
    }
}

setupServiceWorker();

function updateOnlineStatus() {
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

// Listen for network state changes dynamically
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Initial check when the application first loads
updateOnlineStatus();


document.addEventListener("DOMContentLoaded",function () {
    Promise.all([
        fetch(`${rootDir}css/global.css`).then(res => res.text()),
        fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then(res => res.text()),
    ])
        .then(cssTexts => {
            EboComponent.setGlobalCss(cssTexts);

            EboComponent.define(EboProgressBar);
            EboComponent.define(EboNowPlayingComp);
            EboComponent.define(EboAlbumTracksComp);
            EboComponent.define(EboBrowseComp);
            EboComponent.define(EboButton);
            EboComponent.define(EboBigAlbumComp);
            EboComponent.define(EboPlayerBar);
            EboComponent.define(EboMenuButton);
            EboComponent.define(EboListButtonBar);
            EboComponent.define(EboDialog);
            EboComponent.define(EboAlbumDetails);
            EboComponent.define(EboBrowseFilterComp);
            EboComponent.define(EboSettingsComp);
            EboComponent.define(EboListItemComp);
            EboComponent.define(EboRememberedComp);
            EboComponent.define(EboOption);
            EboComponent.define(EboIconDropdown);
            EboComponent.define(EboGenresComp);
            EboComponent.define(EboRadioDetails);
            EboComponent.define(EboRadioHistoryComp);
            EboComponent.define(EboBigRadioComp);
            EboComponent.define(EboTopBar);
            EboComponent.define(EboTracklistComp);

            setupStuff();
        });
});

function setupStuff() {
    let networkProxy = createConnections();
    let networkState = new NetworkStateMachine(networkProxy);
    let model = new Model();
    let player = new PlayController(model, networkState);
    let cacheHandler = new CacheHandler(model, networkState, player);
    let controller = new Controller(model, networkState, player, cacheHandler);

    let state = new State(model, controller, player, cacheHandler);

    let views: View [] = [
        new BrowseView(state, document.getElementById("Browse") as EboBrowseComp),
        new AlbumView(state, document.getElementById("dialog") as EboDialog, document.getElementById("Album") as EboBigAlbumComp),
        new RadioView(state, document.getElementById("dialog") as EboDialog, document.getElementById("Radio") as EboBigRadioComp),
        new TopBarView(state, document.querySelector("ebo-top-bar") as EboTopBar),
        new MainView(state),
        new NowPlayingView(state, document.getElementById("NowPlaying") as EboNowPlayingComp),
        new SettingsView(state, document.getElementById("Settings") as EboSettingsComp),
        new PlayerBarView(state, document.getElementById("buttonBar") as EboPlayerBar),
        new RememberedView(state, document.getElementById("Remembered") as EboRememberedComp),
        new GenresView(state, document.getElementById("Genres") as EboGenresComp),
    ];
    views.forEach(v => v.bindRecursive());
    networkState.getProxy().connectWebsockets();
    controller.initialize(views);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            networkState.getProxy().connectWebsockets();
        }
    });
    document.addEventListener("focus", () => {
        networkState.getProxy().connectWebsockets();
    });
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

