import {AllUris} from "./modelTypes";

export enum EboplayerEvents {
    activeStreamLinesChanged =      "eboplayer.activeStreamLinesChanged",
    addItemListClicked =            "eboplayer.addItemListClicked",
    addTrackClicked =               "eboplayer.addTrackClicked",
    albumToViewChanged =            "eboplayer.albumToViewChanged",
    breadCrumbClick =               "eboplayer.breadCrumbClick",
    breadCrumbsChanged =            "eboplayer.breadCrumbsChanged",
    browseFilterChanged =           "eboplayer.browseFilterChanged",
    browseResultClick =             "eboplayer.browseResultClick",
    browseResultDblClick =          "eboplayer.browseResultDblClick",
    buttonBarAlbumImgClicked =      "eboplayer.buttonBarAlbumImgClicked",
    changingVolume =                "eboplayer.changingVolume",
    connectionChanged =             "eboplayer.connectionChanged",
    currentImageSet =               "eboplayer.currentImageSet",
    currentRefsLoaded =             "eboplayer.currentRefsLoaded",
    currentTrackChanged =           "eboplayer.currentTrackChanged",
    historyChanged =                "eboplayer.historyChanged",
    longPress =                     "eboplayer.longPress",
    messageChanged =                "eboplayer.messageChanged",
    pausePressed =                  "eboplayer.pausePressed",
    playItemListClicked =           "eboplayer.playItemListClicked",
    playPressed =                   "eboplayer.playPressed",
    playStateChanged =              "eboplayer.playbackStateChanged",
    playTrackClicked =              "eboplayer.playTrackClicked",
    refsFiltered =                  "eboplayer.refsFiltered",
    selectedTrackChanged =          "eboplayer.selectedTrackChanged",
    stopPressed =                   "eboplayer.stopPressed",
    trackListChanged =              "eboplayer.trackListChanged",
    viewChanged =                   "eboplayer.viewChanged",
    volumeChanged =                 "eboplayer.volumeChanged",
}

//todo typescript can map events to args via a global map: https://dev.to/stuffbreaker/creating-strongly-typed-events-for-web-components-1jem

export class EboplayerEvent<T extends EboEventArgs> extends CustomEvent<T> {
    constructor(event: EboplayerEvents, detail?: T) { //todo: make detail mandatory! (but allow undefined or null.
        super(event, {detail, bubbles: true, composed: true, cancelable: true});
    }
}

export interface EboEventArgs {}
export interface UriArgs extends EboEventArgs {
    "uri": string
}
export interface BreadcrumbArgs extends EboEventArgs {
    "breadcrumbId": number
}
export interface BrowseResultArgs extends EboEventArgs {
    "label": string,
    "uri": AllUris,
    "type": string,
}

export type GuiSource = "albumView" | "browseView";
export interface GuiSourceArgs extends EboEventArgs {
    "source": GuiSource
}
