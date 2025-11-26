import {models} from "../js/mopidy";
import {FileTrackModel, LibraryItem, NoneTrackModel, StreamTrackModel, TrackModel, TrackType} from "./model";
import {validUri} from "./functionsvars";
import getState from "./playerState";

export function quadratic100(x: number) {
    return (x * x) / 100;
}

export function inverseQuadratic100(y: number) {
    return Math.floor(Math.sqrt(y * 100));
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

export function transformTrackDataToModel(track: (models.Track | undefined)): TrackModel {
    if (!track) {
        // noinspection UnnecessaryLocalVariableJS
        let model: NoneTrackModel = {
            type: TrackType.None
        };
        return model;
    }
    if (isStream(track)) {
        // noinspection UnnecessaryLocalVariableJS
        let model: StreamTrackModel = {
            type: TrackType.Stream,
            track,
            name: track.name,
            infoLines: []
        };
        return model;
    }
    //for now, assume it's a file track
    let model: FileTrackModel = {
        type: TrackType.File,
        composer: "",
        track,
        title: track.name,
        performer: "",
        songlenght: 0
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

export function transformLibraryItem(item: LibraryItem) {
    if (item.length == 1)
        return transformTrackDataToModel(item[0]);
}