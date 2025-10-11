import getState from "./playerState";
import {showLoading} from "./functionsvars";
import {library} from "./library";
import * as controls from "./controls";
import {processCurrentposition, processMute, processPlaystate, processVolume, transformTrackDataToModel} from "./process_ws";
import {ConnectionState, EboplayerEvents, Model, PlayState} from "./model";
import {Commands} from "../scripts/commands";
import {models, Mopidy} from "../mopidy_eboplayer2/static/js/mopidy";
import {EboPlayerDataType} from "./views/view";
import TlTrack = models.TlTrack;

export class Controller extends Commands {
    private model: Model;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model  = model;
    }

    initSocketevents () {
        this.mopidy.on('state:online', () => {
            this.model.setConnectionState(ConnectionState.Online);
            getState().getRequiredData().then(r => {});
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', this.fetchPlaybackOptions);

        this.mopidy.on('event:trackPlaybackStarted', async (data) => {
            await this.processCurrentTrackAndFetchDetails(data.tl_track);
            controls.setPlayState(true);
        });

        this.mopidy.on('event:trackPlaybackResumed', async (data) => {
            await this.processCurrentTrackAndFetchDetails(data.tl_track);
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

        //TEST
        this.model.addEventListener(EboplayerEvents.volumeChanged, () => {
            console.log("VOLUME EVENT RECEIVED");
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

        this.mopidy.on("event:streamHistoryChanged", () => {
        });

        //log all events:
        this.mopidy.on(console.log.bind(console));

    }

    async fetchTracklistAndDetails() {
        let tracks = await getState().commands.core.tracklist.getTlTracks();
        //todo: model.setTracklist()
        let currentTrack = await getState().commands.core.playback.getCurrentTlTrack(); //todo: likely to result in null, as the track probably hasn't been started yet. Remoove this line?
        await this.processCurrentTrackAndFetchDetails(currentTrack);
    }

    async processCurrentTrackAndFetchDetails(data: (TlTrack | null)) {
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

    async getData(dataType: EboPlayerDataType) {
        switch (dataType) {
            case EboPlayerDataType.Volume:
                let volume = await getState().commands.core.mixer.getVolume() as number;
                this.setVolume(volume);
                break;
            case  EboPlayerDataType.CurrentTrack:
                let track = await getState().commands.core.playback.getCurrentTlTrack() as TlTrack;
                await this.processCurrentTrackAndFetchDetails(track);
                break;
            case  EboPlayerDataType.PlayState:
                let state = await getState().commands.core.playback.getState() as string;
                this.setPlayState(state);
                break;
        }
    }
}

