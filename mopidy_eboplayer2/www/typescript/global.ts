import models from "../js/mopidy";
import {validUri} from "./functionsvars";
import getState from "./playerState";
import {FileTrackModel, LibraryItem, NoneTrackModel, StreamTrackModel, TrackModel, ItemType} from "./modelTypes";

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

export function numberedDictToArray<T>(dict: Object, converter?: (object: any) => T): T[] {
    let length = dict["length"];
    let array: any[] = [];
    for (let index = 0; index < length; index++) {
        let line = dict[index.toString()];
        array.push(line);
    }
    if (!converter)
        return array;
    return array.map(converter);
}

export function getHostAndPort() {
    let hostName = document.body.dataset.hostname;
    if (!hostName.startsWith("{{"))
        return hostName;

    hostName = localStorage.getItem("eboplayer.hostName");
    if (hostName)
        return hostName;
    return document.location.host;
}

export function isStream(track: models.Track) {
    return track?.track_no == undefined;
}

export function transformTrackDataToModel(track: (models.Track)): FileTrackModel | StreamTrackModel {
    if (isStream(track)) {
        // noinspection UnnecessaryLocalVariableJS
        let model: StreamTrackModel = {
            type: ItemType.Stream,
            track,
            name: track.name,
            infoLines: [],
            imageUri: undefined
        };
        return model;
    }
    //for now, assume it's a file track
    let model: FileTrackModel = {
        type: ItemType.File,
        composer: "",
        track,
        title: track.name,
        performer: "",
        songlenght: 0,
        imageUri: undefined
    };
    if (!track.name || track.name === '') {
        let parts = track.uri.split('/');
        model.title = decodeURI(parts[parts.length - 1])
    }

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

    //todo: fetch the image, set it in the model and the model should send an event: eboplayer:imageLoaded with the id of the track
    // images.fetchAlbumImage(track.uri, ['infocover', 'albumCoverImg'], getState().mopidy);

    return model;
}

export function console_yellow(msg: string) {
    console.log(`%c${msg}`, 'background-color: yellow');
}