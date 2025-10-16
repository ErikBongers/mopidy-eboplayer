import getState from "./playerState";
import {showLoading, validUri} from "./functionsvars";
import {library} from "./library";
import * as controls from "./controls";
import {transformTlTrackDataToModel} from "./process_ws";
import {ConnectionState, FileTrackModel, HistoryLine, LibraryDict, Model, NoneTrackModel, PlayState, StreamTrackModel, TrackModel, TrackType} from "./model";
import {Commands} from "../scripts/commands";
import {models, Mopidy} from "../mopidy_eboplayer2/static/js/mopidy";
import TlTrack = models.TlTrack;
import {EboPlayerDataType} from "./views/view";
import {DataRequester} from "./views/dataRequester";
import {console_yellow} from "./gui";

export class Controller extends Commands implements DataRequester{
    private model: Model;
    private commands: Commands;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model  = model;
        this.commands = new Commands(mopidy);
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
            await this.fetchHistory();
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', this.fetchPlaybackOptions);

        this.mopidy.on('event:trackPlaybackStarted', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
            controls.setPlayState(true);
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data) => {
            await this.setCurrentTrackAndFetchDetails(data.tl_track);
            controls.setPlayState(true); //todo: pass this through the model and it's listeners.
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
            controls.setMute(data.mute);
        });

        this.mopidy.on('event:playbackStateChanged', (data) => {
            getState().getController().setPlayState(data.new_state);
        });

        this.mopidy.on('event:tracklistChanged', async () => {
            await this.fetchTracklistAndDetails();
        });

        this.mopidy.on('event:seeked', (data) => {
            controls.setPosition(data.time_position);
            if (getState().play) {
                getState().syncedProgressTimer.start();
            }
        });

        this.mopidy.on("event:streamHistoryChanged", (data) => {
            let lines = Object.values<string>(data.data);
            this.model.setActiveStreamLinesHistory(lines);
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

    async fetchTracklistAndDetails() {
        let tracks = await this.commands.core.tracklist.getTlTracks();
        this.model.setTrackList(tracks);

        //todo: this should not be here! Split it up.
        let currentTrack = await this.commands.core.playback.getCurrentTlTrack(); //todo: likely to result in null, as the track probably hasn't been started yet. Remoove this line?
        await this.setCurrentTrackAndFetchDetails(currentTrack);
    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        this.model.setCurrentTrack(transformTlTrackDataToModel(data));
        await this.fetchActiveStreamLines();
        //todo: do this only when a track is started?s
        // this.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // this.core.playback.getState().then(processPlaystate, console.error)
        // this.core.mixer.getVolume().then(processVolume, console.error)
        // this.core.mixer.getMute().then(processMute, console.error)
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
                let volume = await this.commands.core.mixer.getVolume() as number;  //todo: make fetch functions of these switch cases.
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
                await this.fetchActiveStreamLines();
                break;
            case  EboPlayerDataType.TrackList:
                await this.fetchTracklistAndDetails();
                break;
        }
    }

    private async fetchActiveStreamLines() {
        let res = await fetch(`http://${getHostAndPort()}/eboplayer/stream/activeLines`);
        let lines = await res.json();
        this.model.setActiveStreamLinesHistory(lines);
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
        this.model.addToLibraryCache(dict);

        this.model.setHistory(dedupLines);
    }

    async lookupCached(uri: string) {
        let tracks = this.model.getTrackFromCache(uri);
        if(tracks)
            return tracks;
        let dict: LibraryDict = await this.commands.core.library.lookup([uri]);
        this.model.addToLibraryCache(dict);
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

export function getWebSocketUrl() {
    let webSocketUrl = document.body.dataset.websocketUrl;
    if (webSocketUrl.startsWith("{{"))
        webSocketUrl = `ws://${getHostAndPort()}/mopidy/ws`;
    return webSocketUrl;
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

