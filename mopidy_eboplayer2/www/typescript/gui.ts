import {Mopidy, Options} from "../js/mopidy";
import {SyncedProgressTimer} from "./synced_timer";
import getState, {setState, State} from "./playerState";
import {Model} from "./model";
import {HeaderView} from "./views/headerView";
import {Controller} from "./controller";
import {BigTrackViewAdapter} from "./views/bigTrackViewAdapter";
import {ButtonBarView} from "./views/buttonBarView";
import {EboProgressBar} from "./components/eboProgressBar";
import {TimelineView} from "./views/timelineView";
import {EboBigTrackComp} from "./components/eboBigTrackComp";
import {BigTrackViewCurrentOrSelectedAdapter} from "./views/bigTrackViewCurrentOrSelectedAdapter";
import {EboAlbumTracksComp} from "./components/eboAlbumTracksComp";
import {EboComponent} from "./components/EboComponent";
import {MainView} from "./views/mainView";
import {EboBrowseComp} from "./components/eboBrowseComp";
import {EboButton} from "./components/eboButton";
import {getHostAndPort} from "./global";

export function getWebSocketUrl() {
    let webSocketUrl = document.body.dataset.websocketUrl;
    if (webSocketUrl.startsWith("{{"))
        webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;
    return webSocketUrl;
}

document.addEventListener("DOMContentLoaded",function () {
    Promise.all([
        fetch(`${rootDir}css/global.css`).then(res => res.text()),
        fetch(`${rootDir}vendors/font_awesome/css/font-awesome.css`).then(res => res.text()),
    ])
        .then(texts => {
            EboComponent.setGlobalCss(texts);

            customElements.define(EboProgressBar.tagName, EboProgressBar);
            customElements.define(EboBigTrackComp.tagName, EboBigTrackComp);
            customElements.define(EboAlbumTracksComp.tagName, EboAlbumTracksComp);
            customElements.define(EboBrowseComp.tagName, EboBrowseComp);
            customElements.define(EboButton.tagName, EboButton);

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
    let timer = new SyncedProgressTimer(8, mopidy);
    let model = new Model();

    let controller = new Controller(model, mopidy);

    controller.initSocketevents();

    let state = new State(mopidy, timer, model, controller);
    setState(state);

    let mainView = new MainView();
    let headerView = new HeaderView();
    let currentTrackView = new BigTrackViewCurrentOrSelectedAdapter("currentTrackBigView");
    let buttonBarView = new ButtonBarView("buttonBar");
    let historyView = new TimelineView();
    getState().addViews(mainView, headerView, currentTrackView, buttonBarView, historyView);

    mopidy.connect();

    // document.getElementById("showBrowse").onclick = async () => {
    // let browse = await getState().commands.core.library.browse(null);
    // console.log({browse});
    // };
}

export function console_yellow(msg: string) {
    console.log(`%c${msg}`, 'background-color: yellow');
}
function updateDocumentTitle (headline) {
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}

//intellij live preview hack because they don't allow to set a root folder for the built-in server:
let rootDir = document.location.pathname.replace("index.html", "");

