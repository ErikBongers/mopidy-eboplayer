import {AlbumUri, AllUris, PlaybackUserOptions, RememberId, TrackUri} from "./modelTypes";
import {EboDialog} from "./components/eboDialog";
import {DisplayMode} from "./components/eboListItemComp";
import {RefType} from "./refs";

export interface EboEventHandlersEventMap {
    "activeStreamLinesChanged.eboplayer"        : VoidArgs,
    "addItemListClicked.eboplayer"              : GuiSourceArgs,
    "genreSelected.eboplayer"                   : StringArgs,
    "addTrackClicked.eboplayer"                 : TrackUriArgs,
    "albumToViewChanged.eboplayer"              : VoidArgs,
    "bigTimelineImageClicked.eboplayer"         : VoidArgs,
    "bigTrackAlbumSmallImgClicked.eboplayer"    : VoidArgs,
    "breadCrumbClick.eboplayer"                 : BreadcrumbArgs,
    "breadCrumbsChanged.eboplayer"              : VoidArgs,
    "browseResultClick.eboplayer"               : BrowseResultClickArgs,
    "browseResultDblClick.eboplayer"            : UriArgs,
    "browseToArtist.eboplayer"                  : RefArgs,
    "buttonBarAlbumImgClicked.eboplayer"        : VoidArgs,
    "changingVolume.eboplayer"                  : VolumeEventArgs,
    "connectionChanged.eboplayer"               : VoidArgs, //todo: never received?
    "currentImageSet.eboplayer"                 : VoidArgs, //todo: never received?
    "currentRefsLoaded.eboplayer"               : VoidArgs,
    "currentTrackChanged.eboplayer"             : VoidArgs,
    "deleteRemember.eboplayer"                  : RemeberIdArgs,
    "genreDefsChanged.eboplayer"                : VoidArgs,
    "favoritesChanged.eboplayer"                : VoidArgs,
    "albumGenreEditRequested.eboplayer"         : UriArgs,
    "currentRadioChanged.eboplayer"             : VoidArgs,
    "favoriteToggle.eboplayer"                  : UriArgs,
    "detailsAlbumImgClicked.eboplayer"          : VoidArgs,
    "detailsRadioImgClicked.eboplayer"          : VoidArgs,
    "dialogOkClicked.eboplayer"                 : DialogArgs,
    "displayModeChanged.eboplayer"              : DisplayModeArgs,
    "editClicked.eboplayer"                     : GuiSourceArgs,
    "genreReplacementsChanged.eboplayer"        : VoidArgs,
    "guiBrowseFilterChanged.eboplayer"          : VoidArgs,
    "historyChanged.eboplayer"                  : VoidArgs,
    "streamLinesHistoryChanged.eboplayer"       : VoidArgs,
    "longPress.eboplayer"                       : VoidArgs,
    "messageChanged.eboplayer"                  : VoidArgs,
    "modelBrowseFilterChanged.eboplayer"        : VoidArgs,
    "newPlaylistClicked.eboplayer"              : GuiSourceArgs,
    "optionSelected.eboplayer"                  : OptionArgs,
    "pausePressed.eboplayer"                    : VoidArgs,
    "playItemListClicked.eboplayer"             : GuiSourceArgs,
    "playPressed.eboplayer"                     : VoidArgs,
    "playTrackClicked.eboplayer"                : TrackUriArgs,
    "playbackModeChanged.eboplayer"             : VoidArgs,
    "playbackStateChanged.eboplayer"            : VoidArgs,
    "pressedChange.eboplayer"                   : PressedArgs,
    "programTitleChanged.eboplayer"             : VoidArgs,
    "refsFiltered.eboplayer"                    : VoidArgs,
    "rememberStreamLines.eboplayer"             : StreamLinesArgs,
    "rememberedRequested.eboplayer"             : VoidArgs,
    "remembersChanged.eboplayer"                : VoidArgs,
    "replaceItemListClicked.eboplayer"          : GuiSourceArgs,
    "saveClicked.eboplayer"                     : SaveUriArgs,
    "scanFinished.eboplayer"                    : VoidArgs,
    "scanRequested.eboplayer"                   : VoidArgs,
    "scanStatusChanged.eboplayer"               : StringArgs,
    "selectedTrackChanged.eboplayer"            : VoidArgs,
    "stopPressed.eboplayer"                     : VoidArgs,
    "trackClicked.eboplayer"                    : UriArgs,
    "trackListChanged.eboplayer"                : VoidArgs,
    "updateAlbumData.eboplayer"                 : UriArgs,
    "uploadAlbumImageClicked.eboplayer"         : AlbumImageUrlArgs,
    "viewChanged.eboplayer"                     : VoidArgs,
    "volumeChanged.eboplayer"                   : VoidArgs,
    "whatsNewRequested.eboplayer"               : VoidArgs,
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

export interface StreamLinesArgs extends EboEventArgs {
    lines: string[]
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

export interface RefArgs extends EboEventArgs {
    name: string; //todo: use pre-existing type instead of these 3 fields?
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
