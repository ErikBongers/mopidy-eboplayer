import {Mopidy, Options} from "../js/mopidy";
import {Model} from "./model";
import {HeaderView} from "./views/headerView";
import Controller from "./controllers/controller";
import {PlayerBarView} from "./views/playerBarView";
import {EboProgressBar} from "./components/eboProgressBar";
import {TimelineView} from "./views/timelineView";
import {TimeLineDetailsView} from "./views/timeLineDetailsView";
import {EboAlbumTracksComp} from "./components/album/eboAlbumTracksComp";
import {EboComponent} from "./components/EboComponent";
import {MainView} from "./views/mainView";
import {EboBrowseComp} from "./components/browse/eboBrowseComp";
import {EboButton} from "./components/general/eboButton";
import {getHostAndPort} from "./global";
import {JsonRpcController} from "./jsonRpcController";
import {EboBigAlbumComp} from "./components/album/eboBigAlbumComp";
import {EboPlayerBar} from "./components/eboPlayerBar";
import {Views} from "./modelTypes";
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
import {EboTimeLineDetailsComp} from "./components/eboTimeLineDetailsComp";

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
            EboComponent.define(EboTimeLineDetailsComp);
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
    let radioView = new RadioView(state, document.getElementById("dialog") as EboDialog, document.getElementById("bigRadioView") as EboBigRadioComp);
    let mainView = new MainView(state, browseView, albumView, radioView);
    let headerView = new HeaderView(state);
    let timelineDetailsView = new TimeLineDetailsView(state, document.getElementById("timelineDetails") as EboTimeLineDetailsComp);
    let buttonBarView = new PlayerBarView(state, document.getElementById("buttonBar") as EboPlayerBar);
    let historyView = new TimelineView(state);
    let rememberedView = new RememberedView(state, document.getElementById("rememberedView") as EboRememberedComp);
    let genresView = new GenresView(state, document.getElementById("genresView") as EboGenresComp);

    let views = [mainView, headerView, timelineDetailsView, buttonBarView, historyView, rememberedView, genresView];
    views.forEach(v => v.bindRecursive());
    controller.initialize(views);


    mopidy.connect();
    eboWsFrontCtrl.connect();
    eboWsBackCtrl.connect();
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

