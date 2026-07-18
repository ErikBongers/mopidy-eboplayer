import {AlbumUri, AllUris, Goto, Pages, PlaybackUserOptions, RememberId, StreamUri, TrackUri} from "./modelTypes";
import {EboDialog} from "./components/eboDialog";
import {DisplayMode} from "./components/eboListItemComp";
import {RefType} from "./refs";
import {ScanStatus} from "./model";

export interface EboModelEventHandlersEventMap {
    "streamLinesHistoryChanged.eboplayer"       : UriArgs,
    "currentRadioChanged.eboplayer"             : VoidArgs,
    "favoritesChanged.eboplayer"                : VoidArgs,
    "scanStatusChanged.eboplayer"               : ScanStatusArgs,
    "remembersChanged.eboplayer"                : VoidArgs,
    "albumToViewChanged.eboplayer"              : VoidArgs,
    "currentRefsLoaded.eboplayer"               : VoidArgs,
    "trackListChanged.eboplayer"                : VoidArgs,
    "viewChanged.eboplayer"                     : VoidArgs,
    "messageChanged.eboplayer"                  : VoidArgs,
    "tempMessageChanged.eboplayer"              : VoidArgs,
    "scanFinished.eboplayer"                    : VoidArgs,
    "volumeAdjustChanged.eboplayer"             : VolumeAdjustArgs,
    "programTitleChanged.eboplayer"             : VoidArgs,
    "genreReplacementsChanged.eboplayer"        : VoidArgs,
    "breadCrumbsChanged.eboplayer"              : VoidArgs,
    "refsFiltered.eboplayer"                    : VoidArgs,
    "connectionChanged.eboplayer"               : VoidArgs,
    "modelBrowseFilterChanged.eboplayer"        : VoidArgs,
    "currentTrackChanged.eboplayer"             : VoidArgs,
    "selectedTrackChanged.eboplayer"            : VoidArgs,
    "volumeChanged.eboplayer"                   : VoidArgs,
    "playbackModeChanged.eboplayer"             : VoidArgs,
    "playbackStateChanged.eboplayer"            : VoidArgs,
    "activeStreamLinesChanged.eboplayer"        : VoidArgs,
    "historyChanged.eboplayer"                  : VoidArgs,
    "genreDefsChanged.eboplayer"                : VoidArgs,
}

export interface EboEventHandlersEventMap {
    "addItemListClicked.eboplayer"              : GuiSourceArgs,
    "genreSelected.eboplayer"                   : StringArgs,
    "addTrackClicked.eboplayer"                 : TrackUriArgs,
    "bigTimelineImageClicked.eboplayer"         : VoidArgs,
    "bigTrackAlbumSmallImgClicked.eboplayer"    : VoidArgs,
    "breadCrumbClick.eboplayer"                 : BreadcrumbArgs,
    "browseResultClick.eboplayer"               : BrowseResultClickArgs,
    "browseResultDblClick.eboplayer"            : UriArgs,
    "browseToArtist.eboplayer"                  : RefArgs,
    "buttonBarAlbumImgClicked.eboplayer"        : VoidArgs,
    "changingVolume.eboplayer"                  : VolumeEventArgs,
    "deleteRemember.eboplayer"                  : RemeberIdArgs,
    "albumGenreEditRequested.eboplayer"         : UriArgs,
    "albumVolumeAdjustDown.eboplayer"           : UriArgs,
    "albumVolumeAdjustUp.eboplayer"             : UriArgs,
    "favoriteToggle.eboplayer"                  : UriArgs,
    "detailsAlbumImgClicked.eboplayer"          : VoidArgs,
    "detailsRadioImgClicked.eboplayer"          : VoidArgs,
    "dialogOkClicked.eboplayer"                 : DialogArgs,
    "displayModeChanged.eboplayer"              : DisplayModeArgs,
    "editClicked.eboplayer"                     : GuiSourceArgs,
    "guiBrowseFilterChanged.eboplayer"          : VoidArgs,
    "hideBrowseInfoButton.eboplayer"            : VoidArgs,
    "longPress.eboplayer"                       : VoidArgs,
    "newPlaylistClicked.eboplayer"              : GuiSourceArgs,
    "optionSelected.eboplayer"                  : OptionArgs,
    "pausePressed.eboplayer"                    : VoidArgs,
    "playItemClicked.eboplayer"                 : GuiSourceArgs,
    "playPressed.eboplayer"                     : VoidArgs,
    "playTrackClicked.eboplayer"                : TrackUriArgs,
    "pressedChange.eboplayer"                   : PressedArgs,
    "rememberStreamLines.eboplayer"             : StreamLinesArgs,
    "rememberedRequested.eboplayer"             : VoidArgs,
    "mopidyConfigRequested.eboplayer"           : VoidArgs,
    "getMixers.eboplayer"                       : VoidArgs,
    "mopidyConfigAddExclExt.eboplayer"          : ExtArgs,
    "replaceItemListClicked.eboplayer"          : GuiSourceArgs,
    "saveToPlaylistClicked.eboplayer"           : SaveUriArgs,
    "scanRequested.eboplayer"                   : VoidArgs,
    "stopPressed.eboplayer"                     : VoidArgs,
    "trackClicked.eboplayer"                    : UriArgs,
    "updateAlbumData.eboplayer"                 : UriArgs,
    "uploadAlbumImageClicked.eboplayer"         : AlbumImageUrlArgs,
    "gotoPage.eboplayer"                        : GotoArgs,
    "whatsNewRequested.eboplayer"               : VoidArgs,
}

export interface EboEventTarget {
    on<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void;

    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean;
}

export interface EboModelEventTarget {
    on<K extends keyof EboModelEventHandlersEventMap>(
        type: K,
        listener: (this: EboModelEventTarget, ev: EboplayerModelEvent<K, EboModelEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void;

    dispatchEboEvent<K extends keyof EboModelEventHandlersEventMap>(key: K, args: EboModelEventHandlersEventMap[K]): boolean;
}

export class EboplayerEvent<K extends keyof EboEventHandlersEventMap, T extends EboEventArgs> extends CustomEvent<T> {
    protected constructor(event: K, detail?: T) {
        super(event, {detail, bubbles: true, composed: true, cancelable: true});
    }
}

export class EboplayerModelEvent<K extends keyof EboModelEventHandlersEventMap, T extends EboEventArgs> extends CustomEvent<T> {
    protected constructor(event: K, detail?: T) {
        super(event, {detail, bubbles: true, composed: true, cancelable: true});
    }
}

export function createEvent<K extends keyof EboEventHandlersEventMap>(event: K, detail?: EboEventHandlersEventMap[K]) {
    return new CustomEvent(event, {detail, bubbles: true, composed: true, cancelable: true});
}

export function createModelEvent<K extends keyof EboModelEventHandlersEventMap>(event: K, detail?: EboModelEventHandlersEventMap[K]) {
    return new CustomEvent(event, {detail, bubbles: true, composed: true, cancelable: true});
}

export interface VolumeEventArgs {volume: number}
export interface GuiSourceArgs {source: GuiSource}

export interface EboEventArgs {}

export type VoidArgs = {
    [K in any] : never
}

export interface StreamLinesArgs extends EboEventArgs {
    streamUri: StreamUri,
    lines: string[]
}

export interface GotoArgs extends EboEventArgs {
    page: Goto
}

export interface RemeberIdArgs extends EboEventArgs {
    id: RememberId
}

export interface OptionArgs extends EboEventArgs {
    selected: PlaybackUserOptions | null
}

export interface UriArgs extends EboEventArgs {
    uri: AllUris
}

export interface ExtArgs extends EboEventArgs {
    extension: string
}

export interface VolumeAdjustArgs extends EboEventArgs {
    uri: AllUris,
    volumeAdjust: number
}

export interface RefArgs extends EboEventArgs {
    name: string;
    type: RefType;
    uri: AllUris;
}

export interface AlbumImageUrlArgs extends EboEventArgs {
    albumUri: AlbumUri;
    imageUrl: string;
}

export interface PressedArgs extends EboEventArgs {
    pressed: boolean
}

export interface StringArgs extends EboEventArgs {
    text: string
}

export interface ScanStatusArgs extends EboEventArgs {
    status: ScanStatus[]
}

export interface DialogArgs extends EboEventArgs {
    dialog: EboDialog
}

export interface TrackUriArgs extends EboEventArgs {
    uri: TrackUri
}

export interface DisplayModeArgs extends EboEventArgs {
    mode: DisplayMode
}

export interface SaveUriArgs extends EboEventArgs {
    source: GuiSource,
    uri: AllUris
}

export interface BreadcrumbArgs extends EboEventArgs {
    breadcrumbId: number
}
export interface BrowseResultArgs extends EboEventArgs {
    label: string,
    uri: AllUris,
    type: string,
}

export interface BrowseResultClickArgs extends EboEventArgs {
    label: string,
    uri: AllUris,
    type: string,
}

export type GuiSource = "albumView" | "browseView" | "radioView";
export interface GuiSourceArgs extends EboEventArgs {
    source: GuiSource
}

export class EboEventTargetClass extends EventTarget implements EboEventTarget {
    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean {
        return super.dispatchEvent(createEvent(key, args));
    }

    on<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
        // @ts-ignore
        super.addEventListener(type, listener, options);
    }
}

export class EboModelEventTargetClass extends EventTarget implements EboModelEventTarget {
    dispatchEboEvent<K extends keyof EboModelEventHandlersEventMap>(key: K, args: EboModelEventHandlersEventMap[K]): boolean {
        return super.dispatchEvent(createModelEvent(key, args));
    }

    on<K extends keyof EboModelEventHandlersEventMap>(
        type: K,
        listener: (this: EboModelEventTarget, ev: EboplayerModelEvent<K, EboModelEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
        // @ts-ignore
        super.addEventListener(type, listener, options);
    }
}

export function addEboEventListener<K extends keyof EboEventHandlersEventMap>(
    target: HTMLElement,
    type: K,
    listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
    // @ts-ignore
    target.addEventListener(type, listener, options);
}
