import getState from "./playerState";
import {showLoading} from "./functionsvars";
import {library} from "./library";
import * as controls from "./controls";
import {transformTrackDataToModel} from "./process_ws";
import {ConnectionState, HistoryLine, Model, PlayState, TrackType} from "./model";
import {Commands} from "../scripts/commands";
import {models, Mopidy} from "../mopidy_eboplayer2/static/js/mopidy";
import {EboPlayerDataType} from "./views/view";
import {DataRequester} from "./views/dataRequester";
import TlTrack = models.TlTrack;

export class Controller extends Commands implements DataRequester{
    private model: Model;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model  = model;
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
            if(this.model.getCurrentTrack().type == TrackType.None) {
                let history = await getState().commands.core.history.getHistory();
                console.log("%cHistory:", "background-color: yellow");
                console.log(history);
            } //else: current track will be handled elsewhere.
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
        let tracks = await getState().commands.core.tracklist.getTlTracks();
        //todo: model.setTracklist()
        let currentTrack = await getState().commands.core.playback.getCurrentTlTrack(); //todo: likely to result in null, as the track probably hasn't been started yet. Remoove this line?
        await this.setCurrentTrackAndFetchDetails(currentTrack);
    }

    async setCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
        this.model.setCurrentTrack(transformTrackDataToModel(data));
        //todo: do this only when a track is started?s
        // getState().commands.core.playback.getTimePosition().then(processCurrentposition, console.error)
        // getState().commands.core.playback.getState().then(processPlaystate, console.error)
        // getState().commands.core.mixer.getVolume().then(processVolume, console.error)
        // getState().commands.core.mixer.getMute().then(processMute, console.error)
        // let title = await getState().commands.core.playback.getStreamTitle(); //todo: set title in model,....but do we need to do this here?
    }

    fetchPlaybackOptions () {
        let promises = [
            getState().commands.core.tracklist.getRepeat(),
            getState().commands.core.tracklist.getRandom(),
            getState().commands.core.tracklist.getConsume(),
            getState().commands.core.tracklist.getSingle(),
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
                let volume = await getState().commands.core.mixer.getVolume() as number;
                this.setVolume(volume);
                break;
            case  EboPlayerDataType.CurrentTrack:
                let track = await getState().commands.core.playback.getCurrentTlTrack() as TlTrack;
                await this.setCurrentTrackAndFetchDetails(track);
                break;
            case  EboPlayerDataType.PlayState:
                let state = await getState().commands.core.playback.getState() as string;
                this.setPlayState(state);
                break;
            case  EboPlayerDataType.StreamLines:
                let res = await fetch("http://192.168.1.111:6680/eboplayer/stream/activeLines"); //todo: hardcoded url
                let lines = await res.json();
                this.model.setActiveStreamLinesHistory(lines);
                break;
        }
    }

    async getHistory()  {
        let historyObject: Object = await getState().commands.core.history.getHistory();
        let length = historyObject["length"];
        let history: HistoryLine[] = [];
        let historyLines = numberedDictToArray<HistoryLine>(historyObject, line => {
            return {
                timestamp: line["0"],
                ref: line["1"]
            };
        });
        this.model.setHistory(historyLines);
    }
}

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
