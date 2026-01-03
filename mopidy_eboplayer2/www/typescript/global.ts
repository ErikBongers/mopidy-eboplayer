import models from "../js/mopidy";
import {FileTrackModel, PartialStreamTrackModel} from "./modelTypes";

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
    let altHostName = document.body.dataset.hostname;
    if (altHostName.startsWith("{{"))
        altHostName = undefined;

    if(!altHostName) {
        altHostName = localStorage.getItem("eboplayer.hostName");
    }
    return {host: document.location.host, altHost: altHostName};
}

export function isStream(track: models.Track) {
    return (track?.length ?? 0) == 0;
}

export function transformTrackDataToModel(track: (models.Track)): FileTrackModel | PartialStreamTrackModel {
    if (isStream(track)) {
        // noinspection UnnecessaryLocalVariableJS
        let model: PartialStreamTrackModel = {
            type: "stream",
            track,
            name: track.name,
        };
        return model;
    }
    //for now, assume it's a file track
    let model: FileTrackModel = {
        type: "file",
        composer: "",
        track,
        title: track.name,
        performer: "",
        songlenght: 0,
    };
    if (!track.name || track.name === '') {
        let parts = track.uri.split('/');
        model.title = decodeURI(parts[parts.length - 1])
    }

/*
    if (validUri(track.name)) {
        for (let key in getState().streamUris) {
            let rs = getState().streamUris[key]
            if (rs && rs[1] === track.name) {
                model.title = (rs[0] || rs[1]);
            }
        }
    }

    if (!track.length || track.length === 0) {
        model.songlenght = getState().songlength = Infinity;
    } else {
        model.songlenght = getState().songlength = track.length;
    }
*/

    return model;
}

export function console_yellow(msg: string) {
    console.log(`%c${msg}`, 'background-color: yellow');
}

export function assertUnreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}
