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
import {App} from "./app";
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
import {createOnlineNetworkProxy, NetworkProxyPointer} from "./network";
import {PwaEventId, PwaStateId, PwaStateMachine} from "./stateMachine/PwaStateMachine";
import {StateMap} from "./stateMachine/StateMachine";
import {InitialState} from "./stateMachine/InitialState";
import {NoServerState} from "./stateMachine/NoServerState";
import {OnlineState} from "./stateMachine/OnlineState";
import {NoNetworkState} from "./stateMachine/NoNetworkState";

// @ts-ignore
const BUILD_VERSION = __BUILD_VERSION__; // Replaced during build step

const STORED_VERSION = 'storedVersion';

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('serviceWorker.js')
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

function registerWebComponents() {
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
}

function createViews(state: App) {
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
    return views;
}

let networkState: PwaStateMachine;

function onDocAndCssLoaded(cssTexts: [string, string]) {
    EboComponent.setGlobalCss(cssTexts);
    registerWebComponents();
    let model = new Model();
    let onlineNetworkProxy = createOnlineNetworkProxy();
    let networkProxyPointer: NetworkProxyPointer = {
        networkProxy: onlineNetworkProxy,
    };
    let player = new PlayController(model, networkProxyPointer);
    let controller = new Controller(model, networkProxyPointer, player, new CacheHandler(model, networkProxyPointer, player));
    let app = new App(model, controller, player, networkProxyPointer, onlineNetworkProxy);
    createViews(app);
    networkState = new PwaStateMachine(app, getStateMap(app));
    networkState.showLog = true;
    networkState.on("onAppInitialized");
}

function getStateMap(app: App) {
    let dummyState = new InitialState(app);
    let states: StateMap<PwaStateId, PwaEventId> = {
        NOT_INITIALIZED: new InitialState(app),
        ONLINE: new OnlineState(app),
        NO_NETWORK: new NoNetworkState(app),
        NO_SERVER: new NoServerState(app),
    };
    return states;
}

function main (){
    setupServiceWorker();
    document.addEventListener("DOMContentLoaded", function () {
        Promise.all([
            fetch(`${rootDir}css/global.css`).then(res => res.text()),
            fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then(res => res.text()),
        ])
            .then(cssTexts => {
                onDocAndCssLoaded(cssTexts);
            });
    });
//intellij live preview hack because they don't allow to set a root folder for the built-in server:
    let rootDir = document.location.pathname.replace("index.html", "");

}

main();