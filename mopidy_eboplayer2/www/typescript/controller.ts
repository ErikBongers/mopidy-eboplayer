import getState from "./playerState";
import {jsonParse, showLoading, validUri} from "./functionsvars";
import {library} from "./library";
// import * as controls from "./controls";
import {transformTlTrackDataToModel} from "./process_ws";
import {BrowseFilter, ConnectionState, FileTrackModel, HistoryLine, LibraryDict, LibraryItem, Model, NoneTrackModel, PlayState, StreamTitles, StreamTrackModel, TrackModel, TrackType} from "./model";
import {Commands} from "./commands";
import {models, Mopidy} from "../js/mopidy";
import {EboPlayerDataType} from "./views/view";
import {DataRequester} from "./views/dataRequester";
import TlTrack = models.TlTrack;

export class Controller extends Commands implements DataRequester{
    protected model: Model;
    private commands: Commands;
    private mopidyProxy: MopidyProxy;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model  = model;
        this.commands = new Commands(mopidy);
        this.mopidyProxy = new MopidyProxy(this, model, this.commands);
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.CurrentTrack];
    }
    getRequiredDataTypesRecursive(): EboPlayerDataType[] {
        return this.getRequiredDataTypes();
    }

    initSocketevents () {
        this.mopidy.on('state:online', async () => {
            this.model.setConnectionState(ConnectionState.Online);
            await getState().getRequiredData();
            await this.mopidyProxy.fetchHistory();
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', this.mopidyProxy.fetchPlaybackOptions);

        this.mopidy.on('event:trackPlaybackStarted', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
            // controls.setPlayState(true);
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
            // controls.setPlayState(true); //todo: pass this through the model and it's listeners.
        });

        this.mopidy.on('event:playlistsLoaded', ()  => {
            showLoading(true);
            library.getPlaylists();
        });

        this.mopidy.on('event:playlistChanged', (data) => {
            (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
            (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
            delete getState().playlists[data.playlist.uri];
            library.getPlaylists();
        });

        this.mopidy.on('event:playlistDeleted', (data) => {
            (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
            (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
            delete getState().playlists[data.uri];
            library.getPlaylists();
        });

        this.mopidy.on('event:volumeChanged', (data) => {
            this.model.setVolume(data.volume);
        });

        this.mopidy.on('event:muteChanged', (data) => {
            // controls.setMute(data.mute);
        });

        this.mopidy.on('event:playbackStateChanged', (data) => {
            getState().getController().setPlayState(data.new_state);
        });

        this.mopidy.on('event:tracklistChanged', async () => {
            await this.mopidyProxy.fetchTracklistAndDetails();
            await this.mopidyProxy.fetchCurrentTrackAndDetails();
        });

        this.mopidy.on('event:seeked', (data) => {
            // controls.setPosition(data.time_position);
            if (getState().play) {
                getState().syncedProgressTimer.start();
            }
        });

        this.mopidy.on("event:streamHistoryChanged", (data) => {
            //ignore: old version.
        });

        this.mopidy.on("event:streamHistoryChanged2", (data) => {
            let streamTitles: StreamTitles = data.data;
            this.model.setActiveStreamLinesHistory(streamTitles);
        });

        //log all events:
        this.mopidy.on((data) => {
            if(data instanceof MessageEvent) {
                try {
                    let dataObject = JSON.parse(data.data);
                    if((dataObject.event ?? "") == "stream_title_changed")
                        return;
                } catch (e) {} //not valid json.
            }
            if(typeof(data) == "object") {
                if((data.title && Object.keys(data).length) == 1)
                    return;
            }
            if(data instanceof Array) {
                if (data.length && data[0] == "event:streamTitleChanged")
                    return;
            }
            console.log(data);
        });

    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        this.model.setCurrentTrack(transformTlTrackDataToModel(data));
        await this.mopidyProxy.fetchActiveStreamLines();
        //todo: do this only when a track is started?s
        // this.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // this.core.playback.getState().then(processPlaystate, console.error)
        // this.core.mixer.getVolume().then(processVolume, console.error)
        // this.core.mixer.getMute().then(processMute, console.error)
    }

    setVolume(volume: number) {
        this.model.setVolume(volume);
    }

    setPlayState(state: string) {
        this.model.setPlayState(state as PlayState);
    }

    setTracklist(trackList: TlTrack[]) {
        this.model.setTrackList(trackList);
    }

    async getData(dataType: EboPlayerDataType) {
        switch (dataType) {
            case EboPlayerDataType.Volume:
                let volume = await this.commands.core.mixer.getVolume() as number;
                this.setVolume(volume);
                break;
            case  EboPlayerDataType.CurrentTrack:
                let track = await this.commands.core.playback.getCurrentTlTrack() as TlTrack;
                await this.setCurrentTrackAndFetchDetails(track);
                break;
            case  EboPlayerDataType.PlayState:
                let state = await this.commands.core.playback.getState() as string;
                this.setPlayState(state);
                break;
            case  EboPlayerDataType.StreamLines:
                await this.mopidyProxy.fetchActiveStreamLines();
                break;
            case  EboPlayerDataType.TrackList:
                await this.mopidyProxy.fetchTracklistAndDetails();
                break;
        }
    }



    async getTrackInfo(uri: string) {
        let track  = getState().getModel().getTrackInfo(uri);
        if(!track)
            await this.lookupCached(uri);

        return transformLibraryItem(track);
    }

    async lookupCached(uri: string) {
        let tracks = this.model.getTrackFromCache(uri);
        if(tracks)
            return tracks;

        let dict: LibraryDict = await this.commands.core.library.lookup([uri]);
        this.model.addDictToLibraryCache(dict);
        return this.model.getTrackFromCache(uri);
    }

    async playTrack(uri: string) {
        await this.commands.core.tracklist.clear();
        let tracks = await this.commands.core.tracklist.add(null, null, [uri]);
        let trackList = numberedDictToArray(tracks) as models.TlTrack[];
        this.setTracklist(trackList);
        this.commands.core.playback.play(null, trackList[0].tlid);
        await this.setCurrentTrackAndFetchDetails(trackList[0]);
    }

    setSelectedTrack(uri: string) {
        this.model.setSelectedTrack(uri);
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

    async getCurrertTrackInfo() {
        let trackUri = this.model.getCurrentTrack();
        return await this.getTrackInfo(trackUri);
    }

    async getRootDirs() {
        return await this.commands.core.library.browse(null);
    }

    async browse(uri: string) {
        return await this.commands.core.library.browse(uri);
    }

    async getTracksforArtist() {
        let tracksforArtist = await this.commands.core.library.search({artist: ["Sting"]}, null);
        return tracksforArtist;
    }

    saveBrowseFilters(browseFilters: BrowseFilter) {
        localStorage.setItem(BROWSE_FILTERS_KEY, JSON.stringify(browseFilters));
    }

    loadBrowseFilters() {
        let browseFilters = localStorage.getItem(BROWSE_FILTERS_KEY);
        if (browseFilters) {
            this.model.setBrowseFilter(jsonParse(browseFilters, this.model.getBrowseFilter()));
            return;
        }
        console.error("Could not load or parse browse filters from local storage. Using default filters.");
    }
}

export function quadratic100(x:number) { return (x*x)/100;}
export function inverseQuadratic100(y:number) { return Math.floor(Math.sqrt(y*100));}
// noinspection JSUnusedLocalSymbols
export function cubic100(x:number) { return (x*x*x)/10000;}

export function numberedDictToArray<T>(dict: Object, converter?: (object: any) => T): T[] {
    let length = dict["length"];
    let array: any[] = [];
    for(let index = 0; index < length; index++) {
        let line = dict[index.toString()];
        array.push(line);
    }
    if(!converter)
        return array;
    return array.map(converter);
}

export function getHostAndPort() {
    let hostName = document.body.dataset.hostname;
    if (!hostName.startsWith("{{"))
        return hostName;

    hostName = localStorage.getItem("eboplayer.hostName");
    if(hostName)
        return hostName;
    return document.location.host;
}

export function isStream(track: models.Track) {
    return track?.track_no == undefined;
}

export function transformLibraryItem(item: LibraryItem) {
    if(item.length == 1)
        return transformTrackDataToModel(item[0]);
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

const BROWSE_FILTERS_KEY = "browseFilters";

class MopidyProxy {
    private controller: Controller;
    private model: Model;
    private commands: Commands;

    constructor(controller: Controller, model: Model, commands: Commands) {
        this.controller = controller;
        this.model = model;
        this.commands = commands;
    }

    async fetchActiveStreamLines() {
        if(!this.model.currentTrack) {
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

    async fetchHistory()  {
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
            if(!line.ref.uri.startsWith("http:"))
                return true; //assume not a stream
            if(foundStreams.has(line.ref.uri))
                return false;
            foundStreams.add(line.ref.uri);
            return true;
        });


        let prev = {ref: {uri:""}};
        let dedupLines = filtered.filter((line) => {
            if(line.ref.uri == prev.ref.uri)
                return false;
            prev = line;
            return true;
        });

        let unique = [...new Set(dedupLines)];
        let dict: LibraryDict = await this.commands.core.library.lookup(unique.map(l => l.ref.uri));
        this.model.addDictToLibraryCache(dict);

        this.model.setHistory(dedupLines);
    }

    fetchPlaybackOptions () {
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
}