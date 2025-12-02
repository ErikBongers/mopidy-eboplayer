import {Model} from "./model";
import {Commands} from "./commands";
import models from "../js/mopidy";
import {EboPlayerDataType} from "./views/view";
import {Controller} from "./controller";
import {getHostAndPort, numberedDictToArray, quadratic100} from "./global";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import {HistoryLine, LibraryDict} from "./modelTypes";

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

    //todo: this is a test function.
    async fetchTracksforArtist() {
        return await this.commands.core.library.search({artist: ["Sting"]}, null);
    }

    async playTracklistItem(trackList: models.TlTrack[], index: number) {
        await this.commands.core.playback.play(null, trackList[index].tlid);
    }

    async addTrackToTracklist(uri: string) {
        return await this.commands.core.tracklist.add(null, null, [uri]);
    }

    async clearTrackList() {
        await this.commands.core.tracklist.clear();
    }

    async browse(uri: string) {
        return await this.commands.core.library.browse(uri) as Ref[];
    }

    async sendVolume(value: number) {
        await this.commands.core.mixer.setVolume(Math.floor(quadratic100(value)));
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

    async fetchRequiredData(dataType: EboPlayerDataType) {
        switch (dataType) {
            case EboPlayerDataType.Volume:
                let volume = await this.commands.core.mixer.getVolume() as number;
                this.controller.setVolume(volume);
                break;
            case  EboPlayerDataType.CurrentTrack:
                let track = await this.commands.core.playback.getCurrentTlTrack() as TlTrack;
                await this.controller.setCurrentTrackAndFetchDetails(track);
                break;
            case  EboPlayerDataType.PlayState:
                let state = await this.commands.core.playback.getState() as string;
                this.controller.setPlayState(state);
                break;
            case  EboPlayerDataType.StreamLines:
                await this.fetchActiveStreamLines();
                break;
            case  EboPlayerDataType.TrackList:
                await this.fetchTracklistAndDetails();
                break;
        }
    }

    async fetchTracks(uris: string | string[]) {
        if (typeof uris == "string")
            uris = [uris];
        let dict: LibraryDict = await this.commands.core.library.lookup(uris);
        return dict;
    }

    async fetchActiveStreamLines() {
        if (!this.model.currentTrack) {
            this.model.setActiveStreamLinesHistory(undefined);
            return;
        }

        let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/activeLines`);
        url.searchParams.set("uri", this.model.currentTrack);
        let res = await fetch(url);
        let lines = await res.json();
        this.model.setActiveStreamLinesHistory(lines);
    }

    async fetchTracklistAndDetails() {
        let tracks = await this.commands.core.tracklist.getTlTracks();
        this.model.setTrackList(tracks);
    }

    async fetchAllStreamLines(uri: string) {
        let url = new URL(`http://${getHostAndPort()}/eboplayer2/stream/allLines`);
        url.searchParams.set("uri", uri);
        let res = await fetch(url);
        return await res.json() as string[];
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

        let unique = [...new Set(dedupLines)];
        let dict: LibraryDict = await this.commands.core.library.lookup(unique.map(l => l.ref.uri));
        this.model.addDictToLibraryCache(dict);

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
        return await this.commands.core.playlists.asList() as Ref[];
    }

    async fetchPlaylistItems(uri: string) {
        return await this.commands.core.playlists.getItems(uri) as Ref[];
    }
}