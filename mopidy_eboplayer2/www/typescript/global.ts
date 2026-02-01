import models from "../js/mopidy";
import {FileTrackModel, StreamTrackModel} from "./modelTypes";
import {RefType} from "./refs";

// Stretch a value, e.g., between (0, 100), to a new range e.g., (-5, 100)
function stretchLeft(x: number, min: number, max: number) {
    return x*(max+min)/max - min;
}

export function quadratic100(x: number) {
    x = stretchLeft(x, -5, 100);
    return (x * x) / 100;
}

export function inverseQuadratic100(y: number) {
    let x = Math.floor(Math.sqrt(y * 100));
    return stretchLeft(x, 5, 100);
}

// noinspection JSUnusedLocalSymbols
export function cubic100(x: number) {
    return (x * x * x) / 10000;
}

export function getHostAndPort() {
    let hostDefs = getHostAndPortDefs();
    return hostDefs.altHost ?? hostDefs.host;
}

export function getHostAndPortDefs() {
    let altHostName = document.body.dataset.hostname ?? null;
    if (altHostName?.startsWith("{{"))
        altHostName = null;

    if(!altHostName) {
        altHostName = localStorage.getItem("eboplayer.hostName");
    }
    return {host: document.location.host, altHost: altHostName};
}

export function isStream(track: models.Track) {
    return !track.last_modified;
}

export function console_yellow(msg: string) {
    console.log(`%c${msg}`, 'background-color: yellow');
}

export function unreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}

// Source - https://stackoverflow.com/a/51389944
// Posted by YairTawil, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-26, License - CC BY-SA 4.0

export function arrayToggle<T>(arr: Array<T>, item: T) {
    if (arr.includes(item))
        return arr.filter(i => i !== item);
    else
        return [...arr, item];
}

export function getDefaultImageUrl(refType: RefType, defaultImageUrl?: string): string {
    if (defaultImageUrl)
        return defaultImageUrl;

    switch (refType) {
        case "album": return "images/icons/Album.svg";
        case "artist": return "images/icons/Artist.svg";
        case "playlist": return "images/icons/Playlist.svg";
        case "track": return "images/icons/Album.svg";
        case "radio": return "images/icons/Radio.svg";
        case "genre": return "images/icons/Genre.svg";
        default:
            unreachable(refType);
    }
}
