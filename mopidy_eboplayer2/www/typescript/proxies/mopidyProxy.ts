import {Model} from "../model";
import {Commands} from "../commands";
import models from "../../js/mopidy";
import {EboPlayerDataType} from "../views/view";
import {Controller} from "../controllers/controller";
import {numberedDictToArray, quadratic100} from "../global";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import {AllUris, HistoryLine, ImageLookup, LibraryDict, PlaylistUri} from "../modelTypes";
import {SearchResult} from "../refs";

export class MopidyProxy {
    private controller: Controller;
    private model: Model;
    private commands: Commands;

    constructor(controller: Controller, model: Model, commands: Commands) {
        this.controller = controller;
        this.model = model;
        this.commands = commands;
    }

    async fetchRootDirs() {
        return this.browse(null);
    }

    async playTracklistItem(tlid: number) {
        await this.commands.core.playback.play(null, tlid);
    }

    async addTracksToTracklist(uris: string[]) {
        return await this.commands.core.tracklist.add(null, null, uris);
    }

    async clearTrackList() {
        await this.commands.core.tracklist.clear();
    }

    async browse<T extends AllUris>(uri: string) {
        return await this.commands.core.library.browse(uri) as Ref<T>[];
    }

    async sendVolume(value: number) {
        await this.commands.core.mixer.setVolume(value);
    }

    async sendStop() {
        return this.commands.core.playback.stop();
    }

    async sendPause() {
        return this.commands.core.playback.pause();
    }

    async sendPlay() {
        return this.commands.core.playback.play();
    }

    async search(uri: string) {
        return await this.commands.core.library.search({uri}, [], true) as SearchResult[];
    }

    async lookup(uris: string | string[]) {
        if (typeof uris == "string")
            uris = [uris];
        let dict: LibraryDict = await this.commands.core.library.lookup(uris);
        return dict;
    }

    async fetchTracklistAndDetails() {
        let tracks = await this.commands.core.tracklist.getTlTracks();
        this.model.setTrackList(tracks);
    }

    async fetchHistory() {
        let historyObject: Object = await this.commands.core.history.getHistory();
        let historyLines = numberedDictToArray<HistoryLine>(historyObject, line => {
            return {
                timestamp: line["0"],
                ref: line["1"]
            };
        });


        //Make sure a stream is only listed once.
        let foundStreams = new Set<string>();
        let filtered = historyLines.filter(line => {
            if (!line.ref.uri.startsWith("http:"))
                return true; //assume not a stream
            if (foundStreams.has(line.ref.uri))
                return false;
            foundStreams.add(line.ref.uri);
            return true;
        });


        let prev = {ref: {uri: ""}};
        let dedupLines = filtered.filter((line) => {
            if (line.ref.uri == prev.ref.uri)
                return false;
            prev = line;
            return true;
        });

        this.model.setHistory(dedupLines);
    }

    fetchPlaybackOptions() {
        let promises = [
            this.commands.core.tracklist.getRepeat(),
            this.commands.core.tracklist.getRandom(),
            this.commands.core.tracklist.getConsume(),
            this.commands.core.tracklist.getSingle(),
        ];
        Promise.all(promises).then((results) => {
            this.model.setPlaybackState({
                repeat: results[0],
                random: results[1],
                consume: results[2],
                single: results[3]
            });
        })
    }

    async fetchCurrentTrackAndDetails() {
        let currentTrack = await this.commands.core.playback.getCurrentTlTrack(); //todo: likely to result in null, as the track probably hasn't been started yet. Remoove this line?
        await this.controller.setCurrentTrackAndFetchDetails(currentTrack);
    }

    async fetchPlayLists() {
        return await this.commands.core.playlists.asList() as Ref<PlaylistUri>[];
    }

    async fetchPlaylistItems(uri: string) {
        return await this.commands.core.playlists.getItems(uri) as Ref<AllUris>[];
    }

    async fetchImages(uris: string[]) {
        return await this.commands.core.library.getImages(uris) as ImageLookup;
    }

    async fetchVolume() {
        return await this.commands.core.mixer.getVolume() as number;
    }

    async fetchCurrentTlTrack() {
        return await this.commands.core.playback.getCurrentTlTrack() as TlTrack;
    }

    async fetchPlayState() {
        return await this.commands.core.playback.getState() as string;
    }
}