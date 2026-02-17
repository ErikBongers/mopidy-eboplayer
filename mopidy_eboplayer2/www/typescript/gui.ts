import {Mopidy, Options} from "../js/mopidy";
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
import {getHostAndPort} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {EboBigAlbumComp} from "./components/eboBigAlbumComp";
import {EboPlayerBar} from "./components/eboPlayerBar";
import {Views} from "./modelTypes";
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
import {EboListItemComp} from "./components/eboListItemComp";
import {BrowseView} from "./views/browseView";
import {AlbumView} from "./views/albumView";
import {State} from "./playerState";
import {EboRememberedComp} from "./components/eboRememberedComp";
import {RememberedView} from "./views/rememberedView";
import {CacheHandler} from "./controllers/cacheHandler";
import {EboOption} from "./components/eboOption";
import {EboIconDropdown} from "./components/eboIconDropdown";
import {EboGenresComp} from "./components/eboGenresComp";
import {GenresView} from "./views/genresView";

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
            EboComponent.define(EboListItemComp);
            EboComponent.define(EboRememberedComp);
            EboComponent.define(EboOption);
            EboComponent.define(EboIconDropdown);
            EboComponent.define(EboGenresComp);

            setupStuff();
        });
});

function updateDocumentTitle (headline: string) {
    // @ts-ignore
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}

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
    let player = new PlayController(model, mopidyProxy);
    let cacheHandler = new CacheHandler(model, mopidy, mopidyProxy, player);
    let controller = new Controller(model, mopidy, eboWsFrontCtrl, eboWsBackCtrl, mopidyProxy, player, cacheHandler);

    let state = new State(mopidy, model, controller, player, cacheHandler);

    let browseView = new BrowseView(state, document.getElementById("browseView") as EboBrowseComp);
    let albumView = new AlbumView(state, document.getElementById("dialog") as EboDialog, document.getElementById("bigAlbumView") as EboBigAlbumComp);
    let mainView = new MainView(state, browseView, albumView);
    let headerView = new HeaderView(state);
    let currentTrackView = new BigTrackViewCurrentOrSelectedAdapter(state,"currentTrackBigView");
    let buttonBarView = new PlayerBarView(state, document.getElementById("buttonBar") as EboPlayerBar);
    let historyView = new TimelineView(state);
    let rememberedView = new RememberedView(state, document.getElementById("rememberedView") as EboRememberedComp);
    let genresView = new GenresView(state, document.getElementById("genresView") as EboGenresComp);

    let views = [mainView, headerView, currentTrackView, buttonBarView, historyView, rememberedView, genresView];
    views.forEach(v => v.bindRecursive());
    controller.initialize(views);

    if(location.hash == Views.Album)
        controller.setView(Views.NowPlaying);
    else
        controller.setView((location.hash!="" ? location.hash : Views.NowPlaying) as Views);

    mopidy.connect();
    eboWsFrontCtrl.connect();
    eboWsBackCtrl.connect();
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

