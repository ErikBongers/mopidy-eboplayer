// import * as controls from "./controls";
import getState from "./playerState";
import models from "../js/mopidy";
import TlTrack = models.TlTrack;


export const CURRENT_PLAYLIST_TABLE = '#currenttable';

// the first part of Mopidy extensions which serve radio streams
let radioExtensionsList = ['somafm', 'tunein', 'dirble', 'audioaddict']

let uriClassList = [
    ['spotify', 'fa-spotify'],
    ['spotifytunigo', 'fa-spotify'],
    ['spotifyweb', 'fa-spotify'],
    ['local', 'fa-file-sound-o'],
    ['file', 'fa-file-sound-o'],
    ['m3u', 'fa-file-sound-o'],
    ['podcast', 'fa-rss-square'],
    ['podcast+file', 'fa-rss-square'],
    ['podcast+itunes', 'fa-apple'],
    ['dirble', 'fa-microphone'],
    ['tunein', 'fa-headphones'],
    ['soundcloud', 'fa-soundcloud'],
    ['sc', 'fa-soundcloud'],
    ['gmusic', 'fa-google'],
    ['internetarchive', 'fa-university'],
    ['somafm', 'fa-flask'],
    ['youtube', 'fa-youtube'],
    ['yt', 'fa-youtube'],
    ['audioaddict', 'fa-bullhorn'],
    ['subsonic', 'fa-folder-open']
]

// TODO: It should be possible to retrieve a user-friendly name for a given Mopidy scheme dynamically by
//       calling mopidy.library.browse() on the root dir:
//       1. each backend contained in the result will have a 'name' attribute that can be shown as-is in the UI.
//       2. the URI prefix of the backend result should === mopidy.getUriSchemes(), which can be used for the mapping.
//       3. only backends that cannot be 'browsed' (e.g. youtube) should have a static mapping defined here.
let uriHumanList = [
    ['spotify', 'Spotify'],
    ['spotifytunigo', 'Spotify browse'],
    ['spotifyweb', 'Spotify browse'],
    ['local', 'Local media'],
    ['m3u', 'Local playlists'],
    ['podcast', 'Podcasts'],
    ['podcast+itunes', 'iTunes Store: Podcasts'],
    ['dirble', 'Dirble'],
    ['tunein', 'TuneIn'],
    ['soundcloud', 'SoundCloud'],
    ['gmusic', 'Google Music'],
    ['internetarchive', 'Internet Archive'],
    ['somafm', 'Soma FM'],
    ['youtube', 'YouTube'],
    ['audioaddict', 'AudioAddict'],
    ['subsonic', 'Subsonic']
]

// List of Mopidy URI schemes that should not be searched directly.
// Also blacklists 'yt' in favour of using the other 'youtube' supported scheme.
export const searchBlacklist = [
    'file',
    'http',
    'https',
    'mms',
    'rtmp',
    'rtmps',
    'rtsp',
    'yt'
]

// List of known audio file extensions
// TODO: consider querying GStreamer for supported audio formats - see:https://discuss.mopidy.com/t/supported-codecs-file-formats/473
const VALID_AUDIO_EXT = [
    'aa', 'aax',  // Audible.com
    'aac',  // Advanced Audio Coding format
    'aiff',  // Apple
    'au',  // Sun Microsystems
    'flac',  // Free Lossless Audio Codec
    'gsm',
    'iklax',
    'ivs',
    'm4a',
    'm4b',
    'm4p',
    'mp3',
    'mpc',  // Musepack
    'ogg', 'oga', 'mogg',  // Ogg-Vorbis
    'opus',  // Internet Engineering Task Force (IETF)
    'ra', 'rm',  // RealAudio
    'raw',
    'tta',  // True Audio
    'vox',
    'wav',
    'wma',  // Microsoft
    'wv',
    'webm'  // HTML5 video
]

export function renderSongLi (previousTrack, track, nextTrack, uri, tlid, target, currentIndex, listLength) {
    let tlidParameter = '';
    let onClick = '';
    let html = '';
    track.name = validateTrackName(track, currentIndex);
    // Streams
    if (track.length === -1) {
        html += '<li class="albumli"><a href="#"><h1><i class="' + getMediaClass(track) + '"></i> ' + track.name + ' [Stream]</h1></a></li>';
        return html;
    }

    if (target === CURRENT_PLAYLIST_TABLE && typeof tlid === 'number' && tlid >= 0) {  // Current queue: Show popup menu icon. onClick plays track.
        tlidParameter = '\',\'' + tlid;
        onClick = 'return controls.playQueueTrack(' + tlid + ');';
    } else {  // All other tracklist: Show default action icon. onClick performs default action
        onClick = 'return controls.playTracks(\'\', mopidy, \'' + track.uri + '\', \'' + uri + '\');';
    }

    html += '<li class="song albumli" id="' + getUniqueId(target, track.uri) + '" tlid="' + tlid + '">';
    if (isPlayable(track)) {
        // Show popup icon for audio files or 'tracks' of other scheme types
        html += '<a href="#" class="moreBtn" onclick="return popupTracks(event, \'' + uri + '\',\'' + track.uri + tlidParameter + '\');">' +
        '<i class="fa fa-play-circle-o"></i></a>';
    }
    html += '<a href="#" onclick="' + onClick + '"><h1><i class="' + getMediaClass(track) + '"></i> ' + track.name + '</h1>';

    if (listLength === 1 || (!hasSameAlbum(previousTrack, track) && !hasSameAlbum(track, nextTrack))) {
        html += renderSongLiAlbumInfo(track);
    }
    html += '</a></li>';
    return html;
}

/* Tracklist renderer for track artist and album name. */
export function renderSongLiAlbumInfo (track, target: string = undefined) {
    let html = renderSongLiTrackArtists(track);
    if (track.album && track.album.name) {
        html += ' - <em>' + track.album.name + '</em></p>';
    }
    if (typeof target !== 'undefined' && target.length > 0) {
        target = getUniqueId(target, track.uri, true);
        document.querySelector(target).querySelectorAll('a')[1].append(html);
    }
    return html;
}

/* Tracklist renderer for track artist information. */
function renderSongLiTrackArtists (track) {
    let html = ''
    if (track.artists) {
        for (let i = 0; i < track.artists.length; i++) {
            html += track.artists[i].name
            html += (i === track.artists.length - 1) ? '' : ' / '
            // Stop after 3
            if (i > 2) {
                html += '...'
                break
            }
        }
    }
    return html
}


export function hasSameAlbum (track1, track2) {
    // 'true' if album for each track exists and has the same name
    let name1 = track1 ? (track1.album ? track1.album.name : undefined) : undefined
    let name2 = track2 ? (track2.album ? track2.album.name : undefined) : undefined
    return name1 && name2 && (name1 === name2)
}

function validateTrackName (track, trackNumber) {
    // Create name if there is none
    let name = ''
    if (!track.name || track.name === '') {
        name = track.uri.split('/')
        name = decodeURI(name[name.length - 1]) || 'Track ' + String(trackNumber)
    } else {
        name = track.name
    }
    return name
}

/** ****************
 * Modal dialogs  *
 ******************/
export function showLoading (on) {
    //todo
    // if (on) {
    //     document.body.classList.add('cursor', 'progress');
    //     $.mobile.loading('show', {
    //         text: 'Loading data from ' + HOSTNAME + '. Please wait...',
    //         textVisible: true,
    //         theme: 'a'
    //     })
    // } else {
    //     $('body').css('cursor', 'default')
    //     $.mobile.loading('hide')
    // }
}

// from http://dzone.com/snippets/validate-url-regexp
export function validUri (uri: string) {
    let regexp = /^(http|https|mms|rtmp|rtmps|rtsp):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(uri);
}

export function getScheme (uri: string) {
    return uri.split(':')[0].toLowerCase();
}

function isPlayable (track) {
    if (typeof track.type === 'undefined' || track.type === 'track') {
        if (track.uri && getScheme(track.uri) === 'file') {
            let ext = track.uri.split('.').pop().toLowerCase();
            // Files must have the correct extension
            return VALID_AUDIO_EXT.includes(ext);
        }
        return true;
    }
    return false;
}

export function isStreamUri (uri) {
    return validUri(uri) || radioExtensionsList.indexOf(getScheme(uri)) >= 0
}

export function getMediaClass (track) {
    let defaultIcon = 'fa-file-sound-o'
    let type = track.type
    if (typeof type === 'undefined' || type === 'track') {
        if (!isPlayable(track)) {
            return 'fa fa-file-o'  // Unplayable file
        } else if (isStreamUri(track.uri)) {
            return 'fa fa-rss'  // Stream
        }
    } else if (type === 'directory') {
        return 'fa fa-folder-o'
    } else if (type === 'album') {
        // return 'fa fa-bullseye'  // Album
        defaultIcon = 'fa-folder-o'
    } else if (type === 'artist') {
        // return 'fa fa-user-circle-o'  // Artist
        defaultIcon = 'fa-folder-o'
    } else if (type === 'playlist') {
        // return 'fa fa-star'  // Playlist
    }
    if (track.uri) {
        let scheme = getScheme(track.uri)
        for (let i = 0; i < uriClassList.length; i++) {
            if (scheme === uriClassList[i][0]) {
                return 'fa ' + uriClassList[i][1]
            }
        }
        return 'fa ' + defaultIcon
    }
    return ''
}

/**
 * Converts a URI to a jQuery-safe identifier. jQuery identifiers need to be
 * unique per page and cannot contain special characters.
 *
 * @param {string} identifier - Identifier string to prefix to the URI. Can
 * be used to ensure that the generated ID will be unique for the page that
 * it will be included on. Also accepts jQuery identifiers starting with '#'.
 *
 * @param {string} uri - URI to encode, usually the URI of a Mopidy track.
 *
 * @param {boolean} includePrefix - Will prefix the generated identifier
 * with the '#' character if set to 'true', ready to be passed to $() or
 * jQuery().
 *
 * @return {string} - a string in the format '[#]identifier-encodedURI' that
 * is safe to use as a jQuery identifier.
 */
export function getUniqueId (identifier: string, uri: string, includePrefix: boolean = false) {
    if (identifier.charAt(0) === '#' && !includePrefix) {
        identifier = identifier.substring(1);
    } else if (identifier.charAt(0) !== '#' && includePrefix) {
        identifier = '#' + identifier
    }
    return identifier + '-' + fixedEncodeURIComponent(uri).replace(/([;&,\.\+\*\~':"\!\^#$%@\[\]\(\)=>\|])/g, '')  // eslint-disable-line no-useless-escape
}

// Strict URI encoding as per https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function fixedEncodeURIComponent (str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16)
    })
}

export function jsonParse<T>(data: string, defaultValue: T): T {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(e);
        return defaultValue;
    }
}