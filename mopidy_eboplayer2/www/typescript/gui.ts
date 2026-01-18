import {Mopidy, Options} from "../js/mopidy";
import getState, {setState, State} from "./playerState";
import {Model} from "./model";
import {HeaderView} from "./views/headerView";
import {Controller} from "./controllers/controller";
import {PlayerBarView} from "./views/playerBarView";
import {EboProgressBar} from "./components/eboProgressBar";
import {TimelineView} from "./views/timelineView";
import EboBigTrackComp from "./components/eboBigTrackComp";
import {BigTrackViewCurrentOrSelectedAdapter} from "./views/bigTrackViewCurrentOrSelectedAdapter";
import {EboAlbumTracksComp} from "./components/eboAlbumTracksComp";
import {EboComponent} from "./components/EboComponent";
import {MainView} from "./views/mainView";
import {EboBrowseComp} from "./components/eboBrowseComp";
import {EboButton} from "./components/eboButton";
import {console_yellow, getHostAndPort} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {EboBigAlbumComp} from "./components/eboBigAlbumComp";
import {EboPlayerBar} from "./components/eboButtonBarComp";
import {StreamTitles, Views} from "./modelTypes";
import {EboMenuButton} from "./components/eboMenuButton";
import {EboListButtonBar} from "./components/eboListButtonBar";
import {PlayController} from "./controllers/playController";
import {Commands} from "./commands";
import {MopidyProxy} from "./proxies/mopidyProxy";
import {EboDialog} from "./components/eboDialog";
import {EboAlbumDetails} from "./components/eboAlbumDetails";
import {EboRadioDetailsComp} from "./components/eboRadioDetailsComp";
import {EboBrowseFilterComp} from "./components/eboBrowseFilterComp";
import {EboSettingsComp} from "./components/eboSettingsComp";

export function getWebSocketUrl() {
    let webSocketUrl = document.body.dataset.websocketUrl ?? null;
    if (webSocketUrl?.startsWith("{{"))
        webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;

    if(webSocketUrl == "")
        return null;
    return webSocketUrl;
}

document.addEventListener("DOMContentLoaded",function () {
    Promise.all([
        fetch(`${rootDir}css/global.css`).then(res => res.text()),
        fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then(res => res.text()),
    ])
        .then(texts => {
            EboComponent.setGlobalCss(texts);

            EboComponent.define(EboProgressBar);
            EboComponent.define(EboBigTrackComp);
            EboComponent.define(EboAlbumTracksComp);
            EboComponent.define(EboBrowseComp);
            EboComponent.define(EboButton);
            EboComponent.define(EboBigAlbumComp);
            EboComponent.define(EboPlayerBar);
            EboComponent.define(EboMenuButton);
            EboComponent.define(EboListButtonBar);
            EboComponent.define(EboDialog);
            EboComponent.define(EboAlbumDetails);
            EboComponent.define(EboRadioDetailsComp);
            EboComponent.define(EboBrowseFilterComp);
            EboComponent.define(EboSettingsComp);

            setupStuff();
        });
});

function setupStuff() {
    let webSocketUrl = getWebSocketUrl();
    let connectOptions: Options = {
        webSocketUrl,
        autoConnect: false //important: delay connection until all bindings, listeners and dependencies are setup.
    };
    let mopidy = new Mopidy(connectOptions);
    let wsFrontEndUrl = "ws://192.168.1.111:6680/eboplayer2/ws/";
    let eboWsFrontCtrl = new JsonRpcController(wsFrontEndUrl, 1000, 64000);

    let wsBackEndUrl = "ws://192.168.1.111:6680/eboback/ws2/";
    let eboWsBackCtrl = new JsonRpcController(wsBackEndUrl, 1000, 64000);

    let model = new Model();
    let mopidyProxy = new MopidyProxy(new Commands(mopidy));
    let player = new PlayController(model, mopidyProxy)
    let controller = new Controller(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopidyProxy, player);

    controller.initSocketevents();

    let state = new State(mopidy, model, controller, player);
    setState(state);

    let mainView = new MainView(document.getElementById("dialog") as EboDialog);
    let headerView = new HeaderView();
    let currentTrackView = new BigTrackViewCurrentOrSelectedAdapter("currentTrackBigView");
    let buttonBarView = new PlayerBarView("buttonBar", mainView);
    let historyView = new TimelineView();
    getState().addViews(mainView, headerView, currentTrackView, buttonBarView, historyView);

    if(location.hash == Views.Browse)
        controller.setView(Views.Browse);
    else
        controller.setView(Views.NowPlaying);

    mopidy.connect();
    eboWsFrontCtrl.connect();
    eboWsBackCtrl.connect();
}

function updateDocumentTitle (headline: string) {
    // @ts-ignore
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

