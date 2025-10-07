import {artistsToString, CURRENT_PLAYLIST_TABLE, getScheme, getTracksFromUri, isStreamUri, STREAMS_PLAYLIST_NAME, STREAMS_PLAYLIST_SCHEME, TRACK_ACTIONS} from "./functionsvars";
import {updatePlayIcons} from "./functionsvars";
import {library} from "./library";
import {processCurrentposition} from "./process_ws";
import getState from "./playerState";
import {models, Mopidy} from "../mopidy_eboplayer2/static/js/mopidy";
import Track = models.Track;

/**
 * 'onClick' handler for tracks that are rendered in a list.
 *
 * Adds tracks to current tracklist and starts playback if necessary.
 *
 * @param {string} action - The action to perform. Valid actions are:
 *                              PLAY_NOW: add the track at the current queue position and
 *                                        start playback immediately.
 *                              PLAY_NEXT: insert track after the reference track, if 'index'
 *                                         is provided, or after the current track otherwise.
 *                              ADD_THIS_BOTTOM: add track to bottom of tracklist.
 *                              ADD_ALL_BOTTOM: add all tracks in in the list to bottom of
 *                                              tracklist.
 *                              PLAY_ALL: clear tracklist and start playback of the track
 *                                        with URI provided in 'trackUri'.
 * @param {object} mopidy - The Mopidy.js object that should be used to communicate with the
 *                          Mopidy server.
 * @param {string} trackUri - (Optional) The URI of the specific track that the action should
 *                            be performed on. If no URI is provided then the 'data' attribute
 *                            of the popup DIV is assumed to contain the track URI.
 * @param {string} playlistUri - (Optional) The URI of the playlist containing the tracks
 *                               to be played. If no URI is provided then the 'list' attribute
 *                               of the popup DIV is assumed to contain the playlist URI.
 * @param {string} index - (Optional) The tracklist index of the reference track that the
 *                         action should be performed on. Defaults to the index of the currently
 *                         playing track.
 */

export function playTracks(action: TRACK_ACTIONS, mopidy: Mopidy, trackUri: string, playlistUri: string, index: number = null) {
    //todo toast('Updating queue...');

    trackUri = trackUri ||
        (document.querySelector('#popupTracks') as HTMLElement).dataset.track ||
        (document.querySelector('#popupQueue') as HTMLElement).dataset.track;
    playlistUri = playlistUri ||
        (document.querySelector('#popupTracks') as HTMLElement).dataset.list ||
        (document.querySelector('#popupQueue') as HTMLElement).dataset.list;

    action = getAction(action);

    if (action === TRACK_ACTIONS.PLAY_ALL) {
        getState().commands.core.tracklist.clear();
    }

    let trackUris = _getTrackURIsForAction(action, trackUri, playlistUri);
    // Add the tracks and start playback if necessary.
    switch (action) {
        case TRACK_ACTIONS.PLAY_NOW:
        case TRACK_ACTIONS.PLAY_NEXT:
            getState().commands.core.tracklist.index().then(function (currentIndex) {
                if (currentIndex === null && action === TRACK_ACTIONS.PLAY_NEXT) {
                    // Tracklist is empty, start playing new tracks immediately.
                    action = TRACK_ACTIONS.PLAY_NOW;
                }
                _addTrackAtIndex(action, mopidy, trackUris, currentIndex);
            });
            break;
        case TRACK_ACTIONS.INSERT_AT_INDEX:
            _addTrackAtIndex(action, mopidy, trackUris, index);
            break;
        case TRACK_ACTIONS.ADD_THIS_BOTTOM:

        case TRACK_ACTIONS.ADD_ALL_BOTTOM:
        case TRACK_ACTIONS.PLAY_ALL:
            getState().commands.core.tracklist.add(undefined, -1, trackUris).then(function () {
                if (action === TRACK_ACTIONS.PLAY_ALL) {  // Start playback of selected track immediately.
                    getState().commands.core.tracklist.filter({criteria: {uri: [trackUri]}}).then(function (tlTracks) {
                        getState().commands.core.playback.stop().then(function () {
                            getState().commands.core.playback.play(null, tlTracks[0].tlid);
                        });
                    });
                }
            });
            break;
        default:
            throw new Error('Unexpected tracklist action identifier: ' + action)
    }

    if (action !== TRACK_ACTIONS.INSERT_AT_INDEX) {  // TODO: Add support for 'INSERT_AT_INDEX' to allow user to insert tracks in any playlist.
        if (window[document.body.dataset.onTrackClick] === TRACK_ACTIONS.DYNAMIC) {
            // Save last 'action' - will become default for future 'onClick' events
            let previousAction =  TRACK_ACTIONS.ADD_ALL_BOTTOM; //todo $.cookie('onTrackClick');
            if (typeof previousAction === 'undefined' || action !== previousAction) {
                //todo $.cookie('onTrackClick', action, {expires: 365})
                updatePlayIcons('', -1, getIconForAction(action));
            }
        }
    }

    // document.querySelector('#popupTracks').popup('close')
    // document.querySelector('#popupQueue').popup('close')
}

/* Getter function for 'action' variable. Also checks config settings and cookies if required. */
export function getAction(action: TRACK_ACTIONS) {
    if (action == TRACK_ACTIONS.UNDEFINED) {  // Action parameter not provided, use defaults
        action = window[document.body.dataset.onTrackClick] as TRACK_ACTIONS;
    }
    if (action === TRACK_ACTIONS.DYNAMIC) {  // Re-use last action stored in cookie.
        //todo action = $.cookie('onTrackClick') as TRACK_ACTIONS;
        // @ts-ignore
        if (action == TRACK_ACTIONS.UNDEFINED) {
            action = TRACK_ACTIONS.PLAY_ALL;  // Backwards-compatible default value.
        }
    }
    return action;
}

/* Retrieves the Font Awesome character for the given action. */
export function getIconForAction(action: TRACK_ACTIONS = TRACK_ACTIONS.UNDEFINED) {
    action = getAction(action);

    switch (action) {
        case TRACK_ACTIONS.PLAY_ALL:
            return 'fa fa-play-circle'
        case TRACK_ACTIONS.PLAY_NOW:
            return 'fa fa-play-circle-o'
        case TRACK_ACTIONS.INSERT_AT_INDEX:
            return 'fa fa-long-arrow-left'
        case TRACK_ACTIONS.PLAY_NEXT:
            return 'fa fa-level-down'
        case TRACK_ACTIONS.ADD_THIS_BOTTOM:
            return 'fa fa-plus-square-o'
        case TRACK_ACTIONS.ADD_ALL_BOTTOM:
            return 'fa fa-plus-square'
    }
}

/* Retrieves the relevant track URIs for the given action. */
export function _getTrackURIsForAction(action: TRACK_ACTIONS, trackUri: string, playlistUri: string): string[] {
    let trackUris: string[] = [];
    // Fill 'trackUris', by determining which tracks should be added.
    switch (action) {
        case TRACK_ACTIONS.PLAY_NOW:
        case TRACK_ACTIONS.PLAY_NEXT:
        case TRACK_ACTIONS.INSERT_AT_INDEX:
        case TRACK_ACTIONS.ADD_THIS_BOTTOM:
            // Process single track
            trackUris.push(trackUri)
            break
        case TRACK_ACTIONS.PLAY_ALL:
        case TRACK_ACTIONS.ADD_ALL_BOTTOM:
            // Process all tracks in playlist
            trackUris = getTracksFromUri(playlistUri, false);
            break
    }
    return trackUris;
}

export function _addTrackAtIndex(action: TRACK_ACTIONS, mopidy: Mopidy, trackUris: string[], index: number = null) {
    let pos = index;
    if (pos === null) {
        pos = 0;
    } else {
        pos += 1;
    }

    getState().commands.core.tracklist.add(undefined, pos, trackUris).then(function (tlTracks) {
        if (action === TRACK_ACTIONS.PLAY_NOW) {  // Start playback immediately.
            getState().commands.core.playback.stop().then(function () {
                getState().commands.core.playback.play(null, tlTracks[0].tlid)
            })
        }
    })
}

/** ******************************************************
 * play an uri from the queue
 *********************************************************/

/** *
 * Plays a Track from a Playlist.
 * @param tlid
 * @returns {boolean}
 */
export function playQueueTrack(tlid) {
    // Stop directly, for user feedback

    getState().commands.core.playback.stop();
    // toast('Loading...')

    tlid = tlid || (document.querySelector('#popupQueue') as HTMLElement).dataset.tlid;
    getState().commands.core.playback.play(null, parseInt(tlid));
    // document.querySelector('#popupQueue').popup('close')
}

/** *********************************
 *  remove a track from the queue  *
 ***********************************/
export function removeTrack(tlid, mopidy) {
    // toast('Deleting...')

    tlid = tlid || (document.querySelector('#popupQueue') as HTMLElement).dataset.tlid;
    //todo: figure out how to pass the criteria in a type-safe way: getState().commands.core.tracklist.remove({criteria: {'tlid': [parseInt(tlid)]}});
    // document.querySelector('#popupQueue').popup('close')
}

export function clearQueue() {
    getState().commands.core.tracklist.clear();
    return false;
}

export function checkDefaultButtonClick(key, parentElement: HTMLElement) {
    // Click the default button on parentElement when the user presses the enter key.
    if (key === 13) {
        (parentElement.querySelector('button' + '[data-default-btn="true"]') as HTMLElement).click();
    }
    return true;
}

export function showAddTrackPopup(tlid) {
    // todo
    // (document.querySelector('#addTrackInput') as HTMLInputElement).value = "";
    // document.querySelector('#select-add').innerHTML = "";
    // tlid = tlid || (document.querySelector('#popupQueue') as HTMLElement).dataset.tlid;
    // if (typeof tlid !== 'undefined' && tlid !== '') {
    //     // Store the tlid of the track after which we want to perform the insert
    //     (document.querySelector('#popupAddTrack') as HTMLElement).dataset.tlid = (document.querySelector('#popupQueue') as HTMLElement).dataset.tlid;
    //     document.querySelector('#popupAddTrack').one('popupafterclose', function (event, ui) {
    //         // Ensure that popup attributes are reset when the popup is closed.
    //         $(this).removeData('tlid')
    //     })
    //     let trackName = popupData[document.querySelector('#popupQueue').data('track')].name
    //     document.querySelector('#select-add').append('<option value="6" selected="selected">Add Track Below \'' + trackName + '\'</option>')
    // }
    // if (typeof songdata.track.uri !== 'undefined' && songdata.track.uri !== '') {
    //     document.querySelector('#getPlayingBtn').button('enable')
    // } else {
    //     document.querySelector('#getPlayingBtn').button('disable')
    // }
    //
    // document.querySelector('#select-add').append('<option value="1">Play Added Track Next</option>') // PLAY_NEXT
    // document.querySelector('#select-add').append('<option value="2">Add Track to Bottom of Queue</option>') // ADD_THIS_BOTTOM
    // document.querySelector('#select-add').trigger('change')
    //
    // document.querySelector('#popupQueue').popup('close')
    // document.querySelector('#popupAddTrack').popup('open')
}

export function addTrack(trackUri: string, mopidy: Mopidy) {
    let selection = parseInt((document.querySelector('#select-add') as HTMLInputElement).value);

    if (selection === TRACK_ACTIONS.ADD_THIS_BOTTOM) {
        addTrackToBottom(trackUri, mopidy);
    } else if (selection === TRACK_ACTIONS.PLAY_NEXT) {
        insertTrack(trackUri, mopidy);
    } else if (selection === TRACK_ACTIONS.INSERT_AT_INDEX) {
        let tlid = (document.querySelector('#popupAddTrack') as HTMLElement).dataset.tlid;
        insertTrack(trackUri, mopidy, tlid);
    }
}

export function insertTrack(trackUri: string, mopidy: Mopidy, tlid: string = undefined) {
    if (typeof tlid !== 'undefined' && tlid !== '') {
        getState().commands.core.tracklist.index(null, parseInt(tlid)).then(function (index) {
            playTracks(TRACK_ACTIONS.INSERT_AT_INDEX, mopidy, trackUri, CURRENT_PLAYLIST_TABLE, index)
        })
    } else {
        // No tlid provided, insert after current track.
        playTracks(TRACK_ACTIONS.PLAY_NEXT, mopidy, trackUri, CURRENT_PLAYLIST_TABLE)
    }
    // document.querySelector('#popupAddTrack').popup('close')
    return false;
}

export function addTrackToBottom(trackUri, mopidy) {
    if (typeof trackUri === 'undefined' || trackUri === '') {
        throw new Error('No track URI provided to add.')
    }

    playTracks(TRACK_ACTIONS.ADD_THIS_BOTTOM, mopidy, trackUri, CURRENT_PLAYLIST_TABLE);
    // document.querySelector('#popupAddTrack').popup('close')
    return false;
}

export function showSavePopup() {
    getState().commands.core.tracklist.getTracks().then(function (tracks) {
        if (tracks.length > 0) {
            (document.querySelector('#saveinput') as HTMLInputElement).value = '';
            // document.querySelector('#popupSave').popup('open')
        }
    })
}

export function saveQueue() {
    getState().commands.core.tracklist.getTracks().then(function (tracks) {
        let playlistName = (document.querySelector('#saveinput') as HTMLInputElement).value.trim();
        if (playlistName !== null && playlistName !== '') {
            getPlaylistByName(playlistName, 'm3u', false).then(function (exists) {
                if (exists) {
                    // document.querySelector('#popupSave').popup('close')
                    // document.querySelector('#popupOverwrite').popup('open')
                    (document.querySelector('#overwriteConfirmBtn') as HTMLElement).click = () => {
                        initSave(playlistName, tracks);
                    };
                } else {
                    initSave(playlistName, tracks)
                }
            });
        }
    });
    return false;
}

export function initSave(playlistName: string, tracks) {
    // document.querySelector('#popupOverwrite').popup('close')
    // document.querySelector('#popupSave').popup('close')
    (document.querySelector('#saveinput') as HTMLInputElement).value = '';
    // toast('Saving...')
    getState().commands.core.playlists.create(playlistName, 'm3u')
        .then(function (playlist) {
            playlist.tracks.push(...tracks);
            // playlist.tracks = tracks;
            getState().commands.core.playlists.save(playlist).then();
            });
}

export function showInfoPopup(uri, popupId, mopidy) {
    // showLoading(true)
    // let trackUri = uri || $(popupId).data('track')
    // if (popupId && popupId.length > 0) {
    //     $(popupId).popup('close')
    // }
    // document.querySelector('#popupShowInfo tbody').empty()
    //
    // commands.core.library.lookup({'uris': [trackUri]}).then(function (resultDict) {
    //     let uri = Object.keys(resultDict)[0]
    //     let track = resultDict[uri][0]
    //     let html = ''
    //     let rowTemplate = '<tr><td class="label">{label}:</td><td id="{label}-cell">{text}</td></tr>'
    //     let row = {'label': '', 'text': ''}
    //
    //     row.label = 'Name'
    //     if (track.name) {
    //         row.text = track.name
    //     } else {
    //         row.text = '(Not available)'
    //     }
    //     html += stringFromTemplate(rowTemplate, row)
    //
    //     row.label = 'Album'
    //     if (track.album && track.album.name) {
    //         row.text = track.album.name
    //     } else {
    //         row.text = '(Not available)'
    //     }
    //     html += stringFromTemplate(rowTemplate, row)
    //
    //     let artists = artistsToString(track.artists)
    //     // Fallback to album artists.
    //     if (artists.length === 0 && track.album && track.album.artists) {
    //         artists = artistsToString(track.album.artists)
    //     }
    //
    //     if (artists.length > 0) {
    //         row.label = 'Artist'
    //         if (track.artists && track.artists.length > 1 || track.album && track.album.artists && track.album.artists.length > 1) {
    //             row.label += 's'
    //         }
    //         row.text = artists
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     let composers = artistsToString(track.composers)
    //     if (composers.length > 0) {
    //         row.label = 'Composer'
    //         if (track.composers.length > 1) {
    //             row.label += 's'
    //         }
    //         row.text = composers
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     let performers = artistsToString(track.performers)
    //     if (performers.length > 0) {
    //         row.label = 'Performer'
    //         if (track.performers.length > 1) {
    //             row.label += 's'
    //         }
    //         row.text = performers
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.genre) {
    //         row = {'label': 'Genre', 'text': track.genre}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.track_no) {
    //         row = {'label': 'Track #', 'text': track.track_no}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.disc_no) {
    //         row = {'label': 'Disc #', 'text': track.disc_no}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.date) {
    //         row = {'label': 'Date', 'text': new Date(track.date).toLocaleString()}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.length) {
    //         row = {'label': 'Length', 'text': timeFromSeconds(track.length / 1000)}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.bitrate) {
    //         row = {'label': 'Bitrate', 'text': track.bitrate}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.comment) {
    //         row = {'label': 'Comment', 'text': track.comment}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.musicbrainz_id) {
    //         row = {'label': 'MusicBrainz ID', 'text': track.musicbrainz_id}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     if (track.last_modified) {
    //         row = {'label': 'Modified', 'text': track.last_modified}
    //         html += stringFromTemplate(rowTemplate, row)
    //     }
    //
    //     rowTemplate = '<tr><td class="label label-center">{label}:</td><td><input type="text" id="uri-input" value="{text}"></input></td></tr>'
    //     row = {'label': 'URI', 'text': uri}
    //     html += stringFromTemplate(rowTemplate, row)
    //
    //     document.querySelector('#popupShowInfo tbody').append(html)
    //
    //     showLoading(false)
    //     document.querySelector('#popupShowInfo').popup('open')
    //     if (!isMobile) {
    //         // Set focus and select URI text on desktop systems (don't want the keyboard to pop up automatically on mobile devices)
    //         document.querySelector('#popupShowInfo #uri-input').focus()
    //         document.querySelector('#popupShowInfo #uri-input').select()
    //     }
    // }, console.error)
    return false
}

export function refreshPlaylists() {
    getState().commands.core.playlists.refresh().then(function () {
        getState().playlists = {};
        (document.querySelector('#playlisttracksdiv') as HTMLElement).style.display = 'none';
        (document.querySelector('#playlistslistdiv') as HTMLElement).style.display = 'block';
    })
    return false;
}

export function refreshLibrary() {
    let uri = (document.querySelector('#refreshLibraryBtn') as HTMLElement).dataset.url;
    getState().commands.core.library.refresh(uri).then(function () {
        library.getBrowseDir(uri);
    })
    return false;
}

/** ***********
 *  Buttons  *
 *************/

export function doShuffle() {
    getState().commands.core.playback.stop();
    getState().commands.core.tracklist.shuffle();
    getState().commands.core.playback.play();
}

/* Toggle state of play button */
export function setPlayState(nwplay) {
    if (nwplay) {
        document.querySelector('#btplayNowPlaying >i').classList.remove('fa-play');
        document.querySelector('#btplayNowPlaying >i').classList.add('fa-pause');
        document.querySelector('#btplayNowPlaying').setAttribute('title', 'Pause');
        (document.querySelector('#btplay >i') as HTMLElement).classList.remove('fa-play');
        (document.querySelector('#btplay >i') as HTMLElement).classList.add('fa-pause');
        document.querySelector('#btplay').setAttribute('title', 'Pause');
        getState().commands.core.playback.getTimePosition().then(processCurrentposition, console.error)
        getState().syncedProgressTimer.start();
    } else {
        document.querySelector('#btplayNowPlaying >i').classList.remove('fa-pause');
        document.querySelector('#btplayNowPlaying >i').classList.add('fa-play');
        document.querySelector('#btplayNowPlaying').setAttribute('title', 'Play');
        document.querySelector('#btplay >i').classList.remove('fa-pause');
        document.querySelector('#btplay >i').classList.add('fa-play');
        document.querySelector('#btplay').setAttribute('title', 'Play');
        getState().syncedProgressTimer.stop();
    }
    getState().play = nwplay;
}

// play or pause
export function doPlay() {
    // toast('Please wait...', 250)
    if (!getState().play) {
        getState().commands.core.playback.play();
    } else {
        if (isStreamUri(getState().songdata?.track?.uri)) {
            getState().commands.core.playback.stop();
        } else {
            getState().commands.core.playback.pause();
        }
    }
    setPlayState(!getState().play);
}

export function doPrevious() {
    // toast('Playing previous track...')
    getState().commands.core.playback.previous();
}

export function doNext() {
    // toast('Playing next track...')
    getState().commands.core.playback.next();
}

export function backbt() {
    history.back();
    return false;
}

/** ***********
 *  Options  *
 *************/
export function setTracklistOption(name: string, new_value: boolean) {
    if (!new_value) {
        document.querySelector('#' + name + 'bt').setAttribute('style', 'color:#2489ce');
    } else {
        document.querySelector('#' + name + 'bt').setAttribute('style', 'color:#66DD33');
    }
    return new_value;
}

export function setRepeat(nwrepeat: boolean) {
    if (getState().repeat !== nwrepeat) {
        getState().repeat = setTracklistOption('repeat', nwrepeat);
    }
}

export function setRandom(nwrandom: boolean) {
    if (getState().random !== nwrandom) {
        getState().random = setTracklistOption('random', nwrandom);
    }
}

export function setConsume(nwconsume: boolean) {
    if (getState().consume !== nwconsume) {
        getState().consume = setTracklistOption('consume', nwconsume);
    }
}

export function setSingle(nwsingle: boolean) {
    if (getState().single !== nwsingle) {
        getState().single = setTracklistOption('single', nwsingle);
    }
}

export function doRandom() {
    getState().commands.core.tracklist.setRandom(!getState().random).then();
}

export function doRepeat() {
    getState().commands.core.tracklist.setRepeat(!getState().repeat).then();
}

export function doConsume() {
    getState().commands.core.tracklist.setConsume(!getState().consume).then();
}

export function doSingle() {
    getState().commands.core.tracklist.setSingle(!getState().single).then();
}

/** *********************************************
 * Track Slider                                *
 * Use a timer to prevent looping of commands  *
 ***********************************************/
export function doSeekPos(value) {
    if (!getState().positionChanging) {
        getState().positionChanging = value; //todo: number or boolean
        getState().commands.core.playback.seek(Math.round(value)).then(function () {
            getState().positionChanging = null;
        })
    }
}

export function setPosition(pos) {
    if (!getState().positionChanging && (document.querySelector('#trackslider') as HTMLInputElement).value !== pos) {
        getState().syncedProgressTimer.set(pos);
    }
}

/** *********************************************
 * Volume slider                               *
 * Use a timer to prevent looping of commands  *
 ***********************************************/

export function setVolume(value: number) {
    if (getState().volumeChanging
        || getState().volumeSliding)
        return;
    let slider = document.querySelector<HTMLInputElement>('#volumeslider');
    if(slider.value != value.toString()) {
        slider.value = value.toString();
    }
}

//todo separate the controls gui setters from the send functions?
function quadratic100(x:number) { return (x*x)/100;}
function cubic100(x:number) { return (x*x*x)/10000;}
export async function sendVolume(value: number) {
    if (!getState().volumeChanging) {
        getState().volumeChanging = true;
        await getState().commands.core.mixer.setVolume(Math.floor(quadratic100(value)));
        setTimeout(() => getState().volumeChanging = false, 100); //don't allow re-sending volume within 0.1 second.
    }
}

export function setMute(nwmute) {
    // if (mute !== nwmute) {
    //     mute = nwmute
    //     if (mute) {
    //         document.querySelector('#mutebt').attr('class', 'fa fa-volume-off')
    //     } else {
    //         document.querySelector('#mutebt').attr('class', 'fa fa-volume-up')
    //     }
    // }
}

export function doMute() {
    getState().commands.core.mixer.setMute(!getState().mute);
}

/** **********
 *  Stream  *
 ************/
export function streamPressed(key) {
    if (key === 13) {
        playStreamUri();
        return false;
    }
    return true;
}

export function playStreamUri(uri: string = undefined) {
    // value of name is based on the passing of an uri as a parameter or not
    let nwuri = uri || (document.querySelector('#streamuriinput') as HTMLInputElement).value.trim();
    let service = (document.querySelector('#selectstreamservice') as HTMLInputElement).value;
    if (!uri && service) {
        nwuri = service + ':' + nwuri
    }
    // toast('Playing...')
    // stop directly, for user feedback
    getState().commands.core.playback.stop()
    // hide ios/android keyboard
    // document.activeElement.blur()
    clearQueue();
    document.querySelector('input').blur()
    getState().commands.core.tracklist.add(undefined, null, [nwuri]);
    getState().commands.core.playback.play();
    return false;
}

export function getCurrentlyPlaying(uriInput, nameInput) {
    (document.querySelector('#' + uriInput) as HTMLInputElement).value = getState().songdata.track.uri;
    let name = getState().songdata.track.name
    if (getState().songdata.track.artists) {
        let artistStr = artistsToString(getState().songdata.track.artists);
        if (artistStr) {
            name = artistStr + ' - ' + name;
        }
    }
    (document.querySelector('#' + nameInput) as HTMLInputElement).value = name;
    return true;
}

export function getUriSchemes() {
    getState().uriSchemes = {};
    return getState().commands.core.getUriSchemes().then(function (schemes) {
        for (let i = 0; i < schemes.length; i++) {
            getState().uriSchemes[schemes[i].toLowerCase()] = true;
        }
    })
}

export async function getPlaylistByName(name, scheme, create: boolean) {
    let uri_scheme = scheme || '';
    let uri = '';
    if (uri_scheme && !getState().uriSchemes[uri_scheme]) {
        //todo return Mopidy.when(false)
        throw new Error("Dunno...");
    }
    let plists = await getState().commands.core.playlists.asList().catch(console.error.bind(console));
    for (let i = 0; i < plists.length; i++) {
        if ((plists[i].name === name) && (uri_scheme === '' || getScheme(plists[i].uri) === uri_scheme)) {
            return plists[i];
        }
    }
    if (create) {
        let pList = await getState().commands.core.playlists.create(name, uri_scheme);
        console.log("Created playlist '%s'", pList.name);
        return pList;
        }
    throw new Error("Can't find playist "+ name);
    // return Mopidy.when(false)
}

export function getPlaylistFull(uri) {
    return getState().commands.core.playlists.lookup(uri).then(function (pl) {
        getState().playlists[uri] = pl;
        return pl;
    })
}

export function getFavourites() {
    return getPlaylistByName(
        STREAMS_PLAYLIST_NAME,
        STREAMS_PLAYLIST_SCHEME,
        true
    ).then(function (playlist) {
        if (playlist) {
            return getPlaylistFull(playlist.uri);
        }
        // return Mopidy.when(false)
        return;
    })
}

export function addToFavourites(newTracks: Track[]) {
    getFavourites().catch(console.error.bind(console)).then(function (favourites) {
        if (favourites) {
            if (favourites.tracks) {
                favourites.tracks.push(...newTracks);
            } else {
                favourites.tracks.length = 0;
                favourites.tracks.push(...newTracks);
            }
            getState().commands.core.playlists.save(favourites).then(function (s) {
                showFavourites();
            })
        }
    })
}

export function addFavourite(uri, name) {
    uri = uri || (document.querySelector('#streamuriinput') as  HTMLInputElement).value.trim();
    name = name || (document.querySelector('#streamnameinput') as HTMLInputElement).value.trim();
    getState().commands.core.library.lookup([uri]).then(function (results) {
        let newTracks = results[uri];
        if (newTracks.length === 1) {
            // TODO: Supporting adding an entire playlist?
            if (name) {
                // @ts-ignore todo: name is read-only. Is there a clean way to do this?
                newTracks[0].name = name // User overrides name.
            }
            addToFavourites(newTracks);
        } else {
            if (newTracks.length === 0) {
                console.log('No tracks to add');
            } else {
                console.log('Too many tracks (%d) to add', newTracks.length);
            }
        }
    })
}

export function showDeleteStreamPopup(index) {
    getFavourites().then(function (favourites) {
        if (favourites && favourites.tracks && index < favourites.tracks.length) {
            let name = favourites.tracks[index].name
            document.querySelector('.popupStreamName').innerHTML = favourites.tracks[index].name;
            (document.querySelector('#popupConfirmDelete') as HTMLElement).dataset.index =  index;
            // document.querySelector('#popupConfirmDelete').popup('open')
        }
    })
}

export function deleteFavourite(index) {
    index = index || (document.querySelector('#popupConfirmDelete') as HTMLElement).dataset.index;
    getFavourites().then(function (favourites) {
        if (favourites && favourites.tracks && index < favourites.tracks.length) {
            favourites.tracks.splice(index, 1)
            getState().commands.core.playlists.save(favourites).then(function () {
                showFavourites();
            });
            // document.querySelector('#popupConfirmDelete').popup('close')
        }
    })
}

export function showFavourites() {
    document.querySelector('#streamuristable').innerHTML = "";
    getFavourites().then(function (favourites) {
        if (!favourites) {
            return;
        }
        let tmp = '';

        // $.cookie.json = true
        // if ($.cookie('streamUris')) {
        //     tmp = '<button class="btn" style="padding: 5px; width: 100%" type="button" onclick="return upgradeStreamUrisToFavourites();">Convert StreamUris</button>'
        // }
        if (favourites.tracks) {
            let child = ''
            for (let i = 0; i < favourites.tracks.length; i++) {
                child =
                    '<li><span class="ui-icon ui-icon-delete ui-icon-shadow" style="float:right; margin: .5em; margin-top: .8em;">' +
                    '<a href="#" onclick="return showDeleteStreamPopup(' + i + ');">&nbsp;</a></span>' +
                    '<i class="fa fa-rss" style="float: left; padding: .5em; padding-top: 1em;"></i>' +
                    ' <a style="margin-left: 20px" href="#" onclick="return playStreamUri(\'' + favourites.tracks[i].uri + '\');">'
                child += '<h1>' + favourites.tracks[i].name + '</h1></a></li>'
                tmp += child
            }
        } else {
            tmp = '<span style="display:table; margin:0 auto;">Your saved favourite streams/tracks will be shown here</span>'
        }
        document.querySelector('#streamuristable').innerHTML = tmp;
    })
}

// TODO: Remove this upgrade path in next major release.
export function upgradeStreamUrisToFavourites() {
    // toast('Converting streamUris...')
    // $.cookie.json = true
    // let streamUris = $.cookie('streamUris') // Read the cookie.
    // if (streamUris) {
    //     let uris = [] // Prepare a list of uris to lookup.
    //     for (let key in streamUris) {
    //         let rs = streamUris[key]
    //         if (rs) {
    //             uris.push(rs[1])
    //         }
    //     }
    //     commands.core.library.lookup({'uris': uris}).then(function (results) {
    //         let tracks = [] // Prepare a list of tracks to add.
    //         for (let key in streamUris) {
    //             let rs = streamUris[key]
    //             if (rs) {
    //                 let track = results[rs[1]][0]
    //                 if (track) {
    //                     track.name = rs[0] || track.name // Use custom name if provided.
    //                     tracks.push(track)
    //                 } else {
    //                     console.log('Skipping unplayable streamUri ' + rs[1])
    //                 }
    //             }
    //         }
    //         addToFavourites(tracks)
    //         $.cookie('streamUris', null) // Delete the cookie now we're done.
    //         console.log(tracks.length + ' streamUris added to favourites')
    //     })
    // } else {
    //     console.log('No streamUris cookie found')
    // }
}
