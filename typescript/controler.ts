import getState from "./playerState";
import {showLoading, showOffline} from "./functionsvars";
import {library} from "./library";
import * as controls from "./controls";
import {processCurrentposition, processCurrenttrack, processPlaystate} from "./process_ws";
import {ConnectionState, EboplayerEvents} from "./model";

export function initSocketevents () {
    getState().mopidy.on('state:online', function () {
        getState().getModel().setConnectionState(ConnectionState.Online);
    });

    getState().mopidy.on('state:offline', function () {
        getState().getModel().setConnectionState(ConnectionState.Offline);
    });

    getState().mopidy.on('event:optionsChanged', fetchPlaybackOptions);

    getState().mopidy.on('event:trackPlaybackStarted', function (data) {
        processCurrenttrack(data.tl_track);
        controls.setPlayState(true);
    });

    getState().mopidy.on('event:trackPlaybackResumed', function (data) {
        processCurrenttrack(data.tl_track);
        controls.setPlayState(true); //todo: pass this through the model and it's listeners.
    });

    getState().mopidy.on('event:playlistsLoaded', function () {
        showLoading(true);
        library.getPlaylists();
    });

    getState().mopidy.on('event:playlistChanged', function (data) {
        (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
        (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
        delete getState().playlists[data.playlist.uri];
        library.getPlaylists();
    })

    getState().mopidy.on('event:playlistDeleted', function (data) {
        (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'none';
        (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block';
        delete getState().playlists[data.uri];
        library.getPlaylists();
    })

    getState().mopidy.on('event:volumeChanged', function (data) {
        controls.setVolume(data.volume);
        getState().getModel().setVolume(data.volume);
    })

    //TEST
    getState().getModel().addEventListener(EboplayerEvents.volumeChanged, evt => {
        console.log("VOLUME EVENT RECEIVED");
    })


    getState().mopidy.on('event:muteChanged', function (data) {
        controls.setMute(data.mute)
    })

    getState().mopidy.on('event:playbackStateChanged', function (data) {
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

    getState().mopidy.on('event:tracklistChanged', function () {
        library.getCurrentPlaylist()
    })

    getState().mopidy.on('event:seeked', function (data) {
        controls.setPosition(data.time_position);
        if (getState().play) {
            getState().syncedProgressTimer.start()
        }
    })

    getState().mopidy.on('event:streamTitleChanged', function (data) {
        // The stream title is separate from the current track.
        controls.setPlayState(true)
    })

    getState().mopidy.on("event:streamHistoryChanged", function(data: any) {
    });

    //log all events:
    getState().mopidy.on(console.log.bind(console));

}

function fetchPlaybackOptions () {
    let promises = [
        getState().commands.core.tracklist.getRepeat(),
        getState().commands.core.tracklist.getRandom(),
        getState().commands.core.tracklist.getConsume(),
        getState().commands.core.tracklist.getSingle(),
    ];
    Promise.all(promises).then((results) => {
        getState().getModel().setPlaybackState({
            repeat: results[0],
            random: results[1],
            consume: results[2],
            single: results[3]
        });
    })
}
