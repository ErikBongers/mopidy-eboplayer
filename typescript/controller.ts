import getState from "./playerState";
import {showLoading} from "./functionsvars";
import {library} from "./library";
import * as controls from "./controls";
import {processCurrenttrack} from "./process_ws";
import {ConnectionState, EboplayerEvents, Model} from "./model";
import {Commands} from "../scripts/commands";
import {Mopidy} from "../mopidy_eboplayer2/static/js/mopidy";

export class Controller extends Commands {
    private model: Model;

    constructor(model: Model, mopidy: Mopidy) {
        super(mopidy);
        this.model = model;
    }

    initSocketevents () {
        this.mopidy.on('state:online', () => {
            this.model.setConnectionState(ConnectionState.Online);
        });

        this.mopidy.on('state:offline', () => {
            this.model.setConnectionState(ConnectionState.Offline);
        });

        this.mopidy.on('event:optionsChanged', this.fetchPlaybackOptions);

        this.mopidy.on('event:trackPlaybackStarted', (data) => {
            processCurrenttrack(data.tl_track);
            controls.setPlayState(true);
        });

        this.mopidy.on('event:trackPlaybackResumed', (data) => {
            processCurrenttrack(data.tl_track);
            controls.setPlayState(true); //todo: pass this through the model and it's listeners.
        });

        this.mopidy.on('event:playlistsLoaded', function () {
            showLoading(true);
            library.getPlaylists();
        });

        this.mopidy.on('event:playlistChanged', (data) => {
            (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
            (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
            delete getState().playlists[data.playlist.uri];
            library.getPlaylists();
        })

        this.mopidy.on('event:playlistDeleted', (data) => {
            (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
            (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
            delete getState().playlists[data.uri];
            library.getPlaylists();
        })

        this.mopidy.on('event:volumeChanged', (data) => {
            this.model.setVolume(data.volume);
        })

        //TEST
        this.model.addEventListener(EboplayerEvents.volumeChanged, () => {
            console.log("VOLUME EVENT RECEIVED");
        })


        this.mopidy.on('event:muteChanged', (data) => {
            controls.setMute(data.mute)
        })

        this.mopidy.on('event:playbackStateChanged', (data) => {
            switch (data.new_state) {
                case 'paused':
                case 'stopped':
                    controls.setPlayState(false)
                    break
                case 'playing':
                    controls.setPlayState(true)
                    break
            }
        })

        this.mopidy.on('event:tracklistChanged', function () {
            library.getCurrentPlaylist()
        })

        this.mopidy.on('event:seeked', (data) => {
            controls.setPosition(data.time_position);
            if (getState().play) {
                getState().syncedProgressTimer.start()
            }
        })

        this.mopidy.on("event:streamHistoryChanged", function() {
        });

        //log all events:
        this.mopidy.on(console.log.bind(console));

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
}

