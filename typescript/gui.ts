import {library} from "./library";
import {models, Mopidy, Options} from "../mopidy_eboplayer2/static/js/mopidy";
import {searchBlacklist, showLoading, showOffline, switchContent, TRACK_ACTIONS, updatePlayIcons} from "./functionsvars";
import {SyncedProgressTimer} from "./synced_timer";
import {processConsume, processCurrentposition, processCurrenttrack, processMute, processPlaystate, processRandom, processRepeat, processSingle, processVolume} from "./process_ws";
import * as controls from "./controls";
import {sendVolume} from "./controls";
import getState, {setState, State} from "./playerState";
import {FileTrackModel, StreamTrackModel, TrackType} from "./model";
import {Commands} from "../scripts/commands";
import TlTrack = models.TlTrack;

/* gui interactions here
* set- functions only set/update the gui elements
* do- functions interact with the server
* show- functions do both
*/
/** ******************
 * Song Info Sreen  *
 ********************/
function clearSelectedTrack () {
    controls.setPlayState(false);
    controls.setPosition(0);
    getState().getModel().clearActiveTrack();
}

async function fetchAndShowActiveStreamLines () {
    let res = await fetch("stream/activeLines");
    let activeLines = await res.json();
    console.log(activeLines);
    let name = activeLines.join("<br>");

    //todo: track uri is not available
    // document.getElementById'odalname').innerHTML = '<a href="#" onclick="return controls.showInfoPopup(\'' + data.track.uri + '\', \'\', getState().mopidy);">' + name + '</span></a>')
    document.getElementById('modalname').innerHTML = '<a href="#" onclick="return controls.showInfoPopup(\'' + "todo: track uri?" + '\', \'\', getState().mopidy);">' + name + '</span></a>';
    document.getElementById('infoname').innerHTML = name;
}

function setStreamTitle (title: string) {
    showSongInfo(title).then();
}

function resizeMb () {
/*TODO

    if ($(window).width() < 880) {
        document.getElementById('panel').panel('close')
    } else {
        document.getElementById('panel').panel('open')
    }

    showSongInfo(songdata)

    if ($(window).width() > 960) {
        (document.getElementById('playlisttracksdiv') as HTMLElement).style.display = 'block;
        (document.getElementById('playlistslistdiv') as HTMLElement).style.display = 'block;
    }
*/
}

function onActiveTrackChanged() {
    if(getState().getModel().activeTrack.type == TrackType.Stream) {
        let trackInfo = getState().getModel().getActiveTrack();
        if(trackInfo.type == TrackType.Stream)
            updateStreamTrackView(trackInfo as StreamTrackModel);
    }
    else if (getState().getModel().activeTrack.type == TrackType.File) {
        let trackInfo = getState().getModel().getActiveTrack();
        if(trackInfo.type == TrackType.File)
            updateFileTrackView(trackInfo as FileTrackModel);
    }
}

function updateFileTrackView (trackInfo: FileTrackModel) {
    updatePlayIcons(trackInfo.tlTrack.track.uri, trackInfo.tlTrack.tlid, controls.getIconForAction(TRACK_ACTIONS.UNDEFINED));

    if (trackInfo.songlenght == Infinity) {
        (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'none';
    } else {
        (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'block';
    }

    getState().artistsHtml = '';
    getState().artistsText = '';
    let artists = trackInfo.tlTrack.track.artists;
    if (artists) {
        for (let j = 0; j < artists.length; j++) {
            let artistName = artists[j].name;
            if (j !== artists.length - 1) {
                artistName += ', ';
            }
            getState().artistsHtml += '<a href="#" onclick="return library.showArtist(\'' + artists[j].uri + '\', getState().mopidy);">' + artistName + '</a>';
            getState().artistsText += artistName;
        }
    }

    getState().albumHtml = '';
    getState().albumText = '';
    let album = trackInfo.tlTrack.track.album;
    if (album && album.name) {
        getState().albumHtml = '<a href="#" onclick="return library.showAlbum(\'' + album.uri + '\', getState().mopidy);">' + album.name + '</a>';
        getState().albumText = album.name;
    }

    if (trackInfo.tlTrack.track.uri) {
        // Add 'Show Info' icon to album image
        document.getElementById('modalinfo').append(
            '<a href="#" class="infoBtn" onclick="return controls.showInfoPopup(\'' + trackInfo.tlTrack.track.uri + '\', \'undefined\', getState().mopidy);">' +
            '<i class="fa fa-info-circle"></i></a>')
    }

    document.getElementById('trackslider').setAttribute('min', "0");
    document.getElementById('trackslider').setAttribute('max', getState().songlength.toString());
    getState().syncedProgressTimer.reset().set(0, getState().songlength);
    if (getState().play) {
        getState().syncedProgressTimer.start()
    }

    resizeMb()
}
function updateStreamTrackView (trackInfo: StreamTrackModel) {
    updatePlayIcons(trackInfo.tlTrack.track.uri, trackInfo.tlTrack.tlid, controls.getIconForAction(TRACK_ACTIONS.UNDEFINED));

    (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'none';

    getState().artistsHtml = '';
    getState().artistsText = '';

    getState().albumHtml = '';
    getState().albumText = '';
    if (trackInfo.tlTrack.track.uri) {
        // Add 'Show Info' icon to album image
        document.getElementById('modalinfo').append(
            '<a href="#" class="infoBtn" onclick="return controls.showInfoPopup(\'' + trackInfo.tlTrack.track.uri + '\', \'undefined\', getState().mopidy);">' +
            '<i class="fa fa-info-circle"></i></a>')
    }
    resizeMb()
}

/* Name:    Use stream title if we have it, else track name.
 * Detail:  If we don't know artist and it's a stream then show track name instead.
 *          If we know both artist and album show them, otherwise just show artist if we know it.
 */
async function showSongInfo (data: TlTrack | string) {

    //todo: compare with updateFileTrackView and merge?
    
    if (typeof data == 'string') {
        let res = await fetch("stream/activeLines");
        let activeLines = await res.json();
        console.log(activeLines);
        document.getElementById('infoname').innerHTML = activeLines.join("<br>");
        document.getElementById('modalname').innerHTML = '<a href="#" onclick="return controls.showInfoPopup(\'' + "todo: uri" + '\', \'\', getState().mopidy);">' + activeLines.join("<br>") + '</span></a>';
        return;
    }
    let name = data.track.name;

    document.getElementById('modalname').innerHTML = '<a href="#" onclick="return controls.showInfoPopup(\'' + data.track.uri + '\', \'\', getState().mopidy);">' + name + '</span></a>';

    if (getState().artistsHtml.length) {
        if (getState().albumHtml.length) {
            document.getElementById('modaldetail').innerHTML = getState().albumHtml + ' - ' + getState().artistsHtml;
        } else {
            document.getElementById('modaldetail').innerHTML = getState().artistsHtml;
        }
    }

    document.getElementById('infoname').innerHTML = name;
    //todo: stream?
    // if (!getState.artistsText && data.stream) {
    //     document.getElementById('infodetail').innerHTML = data.track.name;
    // } else
    if (getState().artistsText.length) {
        if (getState().albumText.length) {
            document.getElementById('infodetail').innerHTML = getState().albumText + ' - ' + getState().artistsText;
        } else {
            document.getElementById('infodetail').innerHTML = getState().artistsText;
        }
    }
}


/** ****************
 * display popups *
 ******************/
function popupTracks (listuri: string, trackuri: string, tlid: string) {
    document.querySelector('.popupTrackName').innerHTML = getState().popupData[trackuri].name;
    if (getState().popupData[trackuri].album && getState().popupData[trackuri].album.name && getState().popupData[trackuri].album.uri) {
        document.querySelector('.popupAlbumName').innerHTML = getState().popupData[trackuri].album.name;
        (document.querySelector('.popupAlbumLi') as HTMLElement).style.display = 'block';
    } else {
        (document.querySelector('.popupAlbumLi') as HTMLElement).style.display = 'none';
    }
    let child = '';

    (document.querySelector('.popupArtistsLi') as HTMLElement).style.display = 'none';
    (document.querySelector('.popupArtistsDiv') as HTMLElement).style.display = 'none';
    if (getState().popupData[trackuri].artists) {
        if (getState().popupData[trackuri].artists.length === 1 && getState().popupData[trackuri].artists[0].uri) {
            child = '<a href="#" onclick="library.showArtist(\'' + getState().popupData[trackuri].artists[0].uri + '\', getState().mopidy);">Show Artist</a>'
            document.querySelector('.popupArtistName').innerHTML = getState().popupData[trackuri].artists[0].name;
            document.querySelector('.popupArtistHref').setAttribute('onclick', 'library.showArtist(\'' + getState().popupData[trackuri].artists[0].uri + '\', getState().mopidy);');
            (document.querySelector('.popupArtistsDiv') as HTMLElement).style.display = 'none';
            (document.querySelector('.popupArtistsLi') as HTMLElement).style.display = 'block';
        } else {
            var isValidArtistURI = false
            for (var j = 0; j < getState().popupData[trackuri].artists.length; j++) {
                if (getState().popupData[trackuri].artists[j].uri) {
                    isValidArtistURI = true
                    child += '<li><a href="#" onclick="library.showArtist(\'' + getState().popupData[trackuri].artists[j].uri + '\', getState().mopidy);"><span class="popupArtistName">' + getState().popupData[trackuri].artists[j].name + '</span></a></li>'
                }
            }
            if (isValidArtistURI) {
                document.querySelector('.popupArtistsLv').innerHTML = child;
                (document.querySelector('.popupArtistsLv') as HTMLElement).style.display = 'block';
                (document.querySelector('.popupArtistsDiv') as HTMLElement).style.display = 'block';
                //  this makes the viewport of the window resize somehow
                //TODO document.querySelector('.popupArtistsLv').listview('refresh');
            }
        }
    }

    let hash = document.location.hash.split('?')
    let divid = hash[0].substring(1);
    let popupName: string;
    if (divid === 'current') {
        popupName = '#popupQueue';
    } else {
        popupName = '#popupTracks';
    }

    let popup = document.querySelector(popupName) as HTMLElement;

    // Set playlist, trackUri, and tlid of clicked item.
    if (typeof tlid !== 'undefined' && tlid !== '') {
        popup.dataset.list = listuri;
        popup.dataset.track = trackuri;
        popup.dataset.tlid = tlid;
/* todo
        popup.popup('open', {
            x: e.pageX,
            y: e.pageY
        })
*/
    } else {
        popup.dataset.list =  listuri;
        popup.dataset.track = trackuri;
/* todo
        popup.popup('open', {
            x: e.pageX,
            y: e.pageY
        })
*/
    }

/* todo
    $(popupName).one('popupafterclose', function (event, ui) {
        // Ensure that popup attributes are reset when the popup is closed.
        $(this).removeData('list').removeData('track').removeData('tlid')
    })
*/

    return false
}

function showAlbumPopup (popupId) {
    let uri = document.getElementById(popupId).dataset.track;
    library.showAlbum(getState().popupData[uri].album.uri, getState().mopidy);
}

/** ********************
 * initialize sockets *
 **********************/

function initSocketevents () {
    getState().mopidy.on('state:online', function () {
        showOffline(false);
        library.getCurrentPlaylist();
        updateStatusOfAll();
        library.getPlaylists();
        controls.getUriSchemes().then(function () {
            controls.showFavourites();
        });
        library.getBrowseDir(undefined);
        library.getSearchSchemes(searchBlacklist, getState().mopidy);
        showLoading(false);
        //todo $(window).hashchange()
    });

    getState().mopidy.on('state:offline', function () {
        clearSelectedTrack();
        showOffline(true);
    });

    getState().mopidy.on('event:optionsChanged', updateOptions);

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
        controls.setVolume(data.volume)
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
        setStreamTitle(data.title)
        controls.setPlayState(true)
    })

    // @ts-ignore
    getState().mopidy.on("event:streamHistoryChanged", function(data: any) {
        console.log("Stream history changegd:", data);
        fetchAndShowActiveStreamLines().then(() => {});
    });

    //log all events:
   getState().mopidy.on(console.log.bind(console));

}

/** ************
 * gui stuff  *
 **************/

function toggleFullscreen () {
    if (!isFullscreen()) {  // current working methods
        let docElm = document.documentElement;
        if (docElm.requestFullscreen) {
            docElm.requestFullscreen().then(() => {});
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {});
        }
    }
}

function isFullscreen () {
    return document.fullscreenElement;
}

function setHeadline (site: string) {
    site = site.trim();
    let headline = document.querySelector('.mainNav').querySelector('a[href$=' + site + ']').textContent;
    if (headline === '') {
        headline = site.charAt(0).toUpperCase() + site.slice(1)
    }
    document.getElementById('contentHeadline').innerHTML = '<a href="#home" onclick="doSwitchContent(\'home\'); return false;">' + headline + '</a>';
    return headline
}

function doSwitchContent(divid: string, uri: string = undefined) {
    switchContent(divid, uri);
}

// update tracklist options.
function updateOptions () {
    getState().commands.core.tracklist.getRepeat().then(processRepeat, console.error)
    getState().commands.core.tracklist.getRandom().then(processRandom, console.error)
    getState().commands.core.tracklist.getConsume().then(processConsume, console.error)
    getState().commands.core.tracklist.getSingle().then(processSingle, console.error)
}

// update everything as if reloaded
function updateStatusOfAll () {
    getState().commands.core.playback.getCurrentTlTrack().then(processCurrenttrack, console.error)
    getState().commands.core.playback.getTimePosition().then(processCurrentposition, console.error)
    getState().commands.core.playback.getState().then(processPlaystate, console.error)

    updateOptions()

    getState().commands.core.mixer.getVolume().then(processVolume, console.error)
    getState().commands.core.mixer.getMute().then(processMute, console.error)
}

function locationHashChanged () {
    let hash = document.location.hash.split('?');
    // remove #
    let divid = hash[0].substring(1);
    let uri = hash[1];

    let headline = setHeadline(divid);
    updateDocumentTitle(headline);

    if (window.innerWidth < 880) {
        //todo document.getElementById('panel').panel('close')
    }

    //todo
    // document.querySelector('.mainNav a').classList.remove($.mobile.activeBtnClass);
    // // i don't know why some li elements have those classes, but they do, so we need to remove them
    // document.querySelector('.mainNav li').classList.remove($.mobile.activeBtnClass);
    // document.getElementById('nav' + divid + ' a').classList.add($.mobile.activeBtnClass);  // Update navigation pane

        (document.querySelector('.pane') as HTMLElement).style.display = 'none';  // Hide all pages;
        (document.getElementById('' + divid + 'pane') as HTMLElement).style.display = 'block';  // Switch to active pane;

    if (divid === 'browse' && getState().browseStack.length > 0) {
        window.scrollTo(0, getState().browseStack[getState().browseStack.length - 1].scrollPos || 0)  // Restore scroll position - browsing library.
    } else if (typeof getState().pageScrollPos[divid] !== 'undefined') {  // Restore scroll position - pages
        window.scrollTo(0, getState().pageScrollPos[divid]);
    }

    switch (divid) {
        case 'nowPlaying':  // Show 'now playing' footer
            (document.getElementById('normalFooter') as HTMLElement).style.display = 'none';
            (document.getElementById('nowPlayingFooter') as HTMLElement).style.display = 'block';
            break
        case 'search':
            document.getElementById('searchinput').focus()
            break
        case 'artists':
            if (uri !== '') {
                if (getState().mopidy) {
                    library.showArtist(uri, getState().mopidy)
                } else {
                    showOffline(true)  // Page refreshed - wait for mopidy object to be initialized.
                }
            }
            break
        case 'albums':
            if (uri !== '') {
                if (getState().mopidy) {
                    library.showAlbum(uri, getState().mopidy)
                } else {
                    showOffline(true)  // Page refreshed - wait for mopidy object to be initialized.
                }
            }
            break
        default:  // Default footer
            (document.getElementById('normalFooter') as HTMLElement).style.display = 'block';
            (document.getElementById('nowPlayingFooter') as HTMLElement).style.display = 'none';
    }
    return false
}

/** *********************
 * initialize software *
 ***********************/
document.addEventListener("DOMContentLoaded",function () {
    showOffline(true);

    window.onhashchange = locationHashChanged;
    if (location.hash.length < 2) {
        doSwitchContent('nowPlaying');
    }

    document.getElementById('songinfo').onclick = () => doSwitchContent('nowPlaying');
    document.getElementById('albumCoverImg').onclick =  () => doSwitchContent('current');
    let slider = document.querySelector<HTMLInputElement>('#volumeslider');
    slider.onchange = (ev) => { sendVolume(parseInt((ev.target as HTMLInputElement).value)).then(); };
    slider.onmousedown = (ev) => { getState().volumeSliding = true;};
    slider.onmouseup = (ev) => { getState().volumeSliding = false; };
    // Connect to server
    let webSocketUrl = document.body.dataset.websocketUrl;
    // webSocketUrl = "ws://192.168.1.111:6680/mopidy/ws";
    let connectOptions: Options = {
        webSocketUrl
    };
    let mopidy = new Mopidy(connectOptions);
    let commands = new Commands(mopidy);
    let timer = new SyncedProgressTimer(8, mopidy, commands);
    let state = new State(mopidy, commands, timer);
    setState(state);

    // initialize events
    initSocketevents();
    clearSelectedTrack();
});

function updateDocumentTitle (headline) {
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}
