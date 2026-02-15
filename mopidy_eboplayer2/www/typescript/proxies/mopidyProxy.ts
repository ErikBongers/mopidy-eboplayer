import {Commands} from "../commands";
import models from "../../js/mopidy";
import {AllUris, MopidyHistoryLine, HistoryRef, ImageLookup, PlaylistUri, PlaybackFlags} from "../modelTypes";
import {SearchResult} from "../refs";
import TlTrack = models.TlTrack;
import Ref = models.Ref;
import Playlist = models.Playlist;

export class MopidyProxy {
    private commands: Commands;

    constructor(commands: Commands) {
        this.commands = commands;
    }

    async fetchRootDirs() {
        return this.browse(null);
    }

    async playTracklistItem(tlid: number) {
        await this.commands.core.playback.play(null, tlid);
    }

    async addTracksToTracklist(uris: AllUris[]) {
        return await this.commands.core.tracklist.add(undefined, undefined, uris);
    }

    async clearTrackList() {
        await this.commands.core.tracklist.clear();
    }

    async browse<T extends AllUris>(uri: string | null) {
        return await this.commands.core.library.browse(uri) as Ref<T>[];
    }

    async sendVolume(value: number) {
        await this.commands.core.mixer.setVolume(Math.round(value));
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

    async lookup(uris: AllUris | AllUris[]) {
        if (typeof uris == "string")
            uris = [uris];
        return await this.commands.core.library.lookup(uris);
    }

    async fetchTracklist(): Promise< TlTrack[]> {
        return await this.commands.core.tracklist.getTlTracks();
    }

    async fetchHistory() {
        let historyObject = await this.commands.core.history.getHistory() as [number, HistoryRef][];
        let historyLines = historyObject.map(line => {
            return {
                timestamp: line[0],
                ref: line[1]
            } as MopidyHistoryLine;
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
        return dedupLines;
    }

    async fetchCurrentTrack() {
        return await this.commands.core.playback.getCurrentTlTrack() as TlTrack | null;
    }

    async fetchPlayLists() {
        return await this.commands.core.playlists.asList() as Ref<PlaylistUri>[];
    }

    async fetchPlaylistItems(uri: string) {
        return await this.commands.core.playlists.getItems(uri);
    }

    async fetchImages(uris: AllUris[]) {
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

    createPlaylist(name: string) {
        return this.commands.core.playlists.create(name, "eboback");
    }

    savePlaylist(playlist: Playlist) {
        return this.commands.core.playlists.save(playlist);
    }

    setRepeat(repeat: boolean) {
        return this.commands.core.tracklist.setRepeat(repeat);
    }

    setSingle(single: boolean) {
        return this.commands.core.tracklist.setSingle(single);
    }

    async getPlaybackFlags(): Promise<PlaybackFlags> {
        let repeat = await this.commands.core.tracklist.getRepeat();
        let single = await this.commands.core.tracklist.getSingle();
        let random = await this.commands.core.tracklist.getRandom();
        let consume = await this.commands.core.tracklist.getConsume();
        return {repeat, single, random, consume};
    }
}