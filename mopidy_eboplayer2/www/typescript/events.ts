import {AllUris, TrackUri} from "./modelTypes";
import {EboDialog} from "./components/eboDialog";

export interface EboEventHandlersEventMap {
    "activeStreamLinesChanged.eboplayer"  : VoidArgs,
    "addItemListClicked.eboplayer"        : GuiSourceArgs,
    "replaceItemListClicked.eboplayer"    : GuiSourceArgs,
    "addTrackClicked.eboplayer"           : TrackUriArgs,
    "albumToViewChanged.eboplayer"        : VoidArgs,
    "breadCrumbClick.eboplayer"           : BreadcrumbArgs,
    "breadCrumbsChanged.eboplayer"        : VoidArgs,
    "modelBrowseFilterChanged.eboplayer"  : VoidArgs,
    "guiBrowseFilterChanged.eboplayer"    : VoidArgs,
    "browseResultClick.eboplayer"         : BrowseResultClickArgs,
    "browseResultDblClick.eboplayer"      : UriArgs,
    "buttonBarAlbumImgClicked.eboplayer"  : VoidArgs,
    "changingVolume.eboplayer"            : VolumeEventArgs,
    "connectionChanged.eboplayer"         : VoidArgs, //todo: never received?
    "currentImageSet.eboplayer"           : VoidArgs, //todo: never received?
    "currentRefsLoaded.eboplayer"         : VoidArgs,
    "currentTrackChanged.eboplayer"       : VoidArgs,
    "historyChanged.eboplayer"            : VoidArgs,
    "longPress.eboplayer"                 : VoidArgs,
    "messageChanged.eboplayer"            : VoidArgs,
    "pausePressed.eboplayer"              : VoidArgs,
    "playItemListClicked.eboplayer"       : GuiSourceArgs,
    "playPressed.eboplayer"               : VoidArgs,
    "playbackStateChanged.eboplayer"      : VoidArgs,
    "playTrackClicked.eboplayer"          : TrackUriArgs,
    "refsFiltered.eboplayer"              : VoidArgs,
    "selectedTrackChanged.eboplayer"      : VoidArgs,
    "stopPressed.eboplayer"               : VoidArgs,
    "trackListChanged.eboplayer"          : VoidArgs,
    "viewChanged.eboplayer"               : VoidArgs,
    "volumeChanged.eboplayer"             : VoidArgs,
    "editClicked.eboplayer"               : GuiSourceArgs,
    "saveClicked.eboplayer"               : SaveUriArgs,
    "newPlaylistClicked.eboplayer"        : GuiSourceArgs,
    "dialogOkClicked.eboplayer"           : DialogArgs,
    "genreDefsChanged.eboplayer"          : VoidArgs,
}

export default interface EboEventTarget {
    addEboEventListener<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void;

    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean;
}

export class EboplayerEvent<K extends keyof EboEventHandlersEventMap, T extends EboEventArgs> extends CustomEvent<T> {
    protected constructor(event: K, detail?: T) {
        super(event, {detail, bubbles: true, composed: true, cancelable: true});
    }
}

export function createEvent<K extends keyof EboEventHandlersEventMap>(event: K, detail?: EboEventHandlersEventMap[K]) {
    return new CustomEvent(event, {detail, bubbles: true, composed: true, cancelable: true});
}

export interface VolumeEventArgs {volume: number}
export interface GuiSourceArgs {source: GuiSource}

export interface EboEventArgs {}

export type VoidArgs = {
    [K in any] : never
}

export interface UriArgs extends EboEventArgs {
    uri: AllUris
}

export interface DialogArgs extends EboEventArgs {
    dialog: EboDialog
}

export interface TrackUriArgs extends EboEventArgs {
    uri: TrackUri
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

export type GuiSource = "albumView" | "browseView";
export interface GuiSourceArgs extends EboEventArgs {
    source: GuiSource
}

export class EboEventTargetClass extends EventTarget implements EboEventTarget {
    dispatchEboEvent<K extends keyof EboEventHandlersEventMap>(key: K, args: EboEventHandlersEventMap[K]): boolean {
        return super.dispatchEvent(createEvent(key, args));
    }

    addEboEventListener<K extends keyof EboEventHandlersEventMap>(
        type: K,
        listener: (this: EboEventTarget, ev: EboplayerEvent<K, EboEventHandlersEventMap[K]>) => any, options?: boolean | AddEventListenerOptions): void {
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
