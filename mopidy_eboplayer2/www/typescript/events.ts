export enum EboplayerEvents {
    volumeChanged = "eboplayer.volumeChanged",
    connectionChanged = "eboplayer.connectionChanged",
    playStateChanged = "eboplayer.playbackStateChanged",
    messageChanged = "eboplayer.messageChanged",
    currentTrackChanged = "eboplayer.currentTrackChanged",
    selectedTrackChanged = "eboplayer.selectedTrackChanged",
    activeStreamLinesChanged = "eboplayer.activeStreamLinesChanged",
    historyChanged = "eboplayer.historyChanged",
    trackListChanged = "eboplayer.trackListChanged",
    browseFilterChanged = "eboplayer.browseFilterChanged",
    currentRefsLoaded = "eboplayer.currentRefsLoaded",
    refsFiltered = "eboplayer.refsFiltered",
    longPress = "eboplayer.longPress",
    breadCrumbsChanged = "eboplayer.breadCrumbsChanged",
    playPressed = "eboplayer.playPressed",
    pausePressed = "eboplayer.pausePressed",
    stopPressed = "eboplayer.stopPressed",
    changingVolume = "eboplayer.changingVolume",
    viewChanged = "eboplayer.viewChanged",
    albumToViewChanged = "eboplayer.albumToViewChanged",
    albumClicked = "eboplayer.albumClicked",
    currentImageSet = "eboplayer.currentImageSet",
    playAlbumClicked = "eboplayer.playAlbumClicked",
    addAlbumClicked = "eboplayer.addAlbumClicked",
    browseResultDblClick = "eboplayer.browseResultDblClick",
    browseResultClick = "eboplayer.browseResultClick",
    breadCrumbClick = "eboplayer.breadCrumbClick",
    playTrackClicked = "eboplayer.playTrackClicked",
}

export class EboplayerEvent<T extends EboEventArgs> extends CustomEvent<T> {
    constructor(event: EboplayerEvents, detail?: T) {
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
    "uri": string,
    "type": string,
}