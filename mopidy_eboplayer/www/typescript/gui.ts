import {Mopidy, Options} from "../js/mopidy";
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
import {getHostAndPort} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {EboBigAlbumComp} from "./components/album/eboBigAlbumComp";
import {EboPlayerBar} from "./components/eboPlayerBar";
import {EboMenuButton} from "./components/general/eboMenuButton";
import {EboListButtonBar} from "./components/eboListButtonBar";
import {PlayController} from "./controllers/playController";
import {Commands} from "./commands";
import {MopidyProxy} from "./proxies/mopidyProxy";
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
import {BrowseController} from "./controllers/browseController";
import {EboTracklistComp} from "./components/eboTracklistComp";
import {MopidyRepository} from "./repositories/mopidyRepository";
import {MopidyOnlineRepository} from "./repositories/MopidyOnlineRepository";

export function getWebSocketUrl() {
    let webSocketUrl = document.body.dataset.websocketUrl ?? null;
    if (webSocketUrl?.startsWith("{{"))
        webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;

    if(webSocketUrl == "")
        return null;
    return webSocketUrl;
}


function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/serviceWorker.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
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
        .then(texts => {
            EboComponent.setGlobalCss(texts);

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

function updateDocumentTitle (headline: string) {
    // @ts-ignore
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}

function setupStuff() {
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
    let eboWsFrontCtrl = new JsonRpcController(wsFrontEndUrl, 1000, 64000);

    let wsBackEndUrl = `${protocol}${hostAndPort}/eboback/ws2/`;
    let eboWsBackCtrl = new JsonRpcController(wsBackEndUrl, 1000, 64000);

    let model = new Model();
    let mopidyRepository: MopidyRepository = new MopidyOnlineRepository(new MopidyProxy(new Commands(mopidy)));
    let player = new PlayController(model, mopidyRepository);
    let cacheHandler = new CacheHandler(model, mopidy, mopidyRepository, player);
    let controller = new Controller(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopidyRepository, player, cacheHandler);

    let state = new State(mopidy, model, controller, player, cacheHandler);

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
    controller.initialize(views);
    connectWebsockets(mopidy, eboWsFrontCtrl, eboWsBackCtrl);

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            connectWebsockets(mopidy, eboWsFrontCtrl, eboWsBackCtrl);
        }
    });
    document.addEventListener("focus", () => {
        connectWebsockets(mopidy, eboWsFrontCtrl, eboWsBackCtrl);
    });
}

function connectWebsockets(mopidy: Mopidy, eboWsFrontCtrl: JsonRpcController, eboWsBackCtrl: JsonRpcController) {
    mopidy.connect();
    eboWsFrontCtrl.connect();
    eboWsBackCtrl.connect();
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

