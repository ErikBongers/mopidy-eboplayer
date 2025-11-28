// import * as controls from "./controls";
import getState from "./playerState";
import models from "../js/mopidy";
import TlTrack = models.TlTrack;

// interface ArtistInfo {
//     name: string;
//     uri: string;
// }
//
// interface AlbumInfo {
//     name: string;
//     uri: string;
// }
//
// interface TrackInfo {
//     name: string;
//     artists: ArtistInfo[];
//     length: number;
//     uri: string;
//     album: AlbumInfo;
// }

interface StreamInfo {
    tlid: number;
    track: TlTrack;
    stream: string;
}


// constants
export const STREAMS_PLAYLIST_NAME = '[Radio Streams]';
export const STREAMS_PLAYLIST_SCHEME = 'm3u';
export const HOSTNAME = document.body.dataset.hostname;
export const ARTIST_TABLE = '#artiststable';
export const ALBUM_TABLE = '#albumstable';
export const BROWSE_TABLE = '#browsetable';
export const PLAYLIST_TABLE = '#playlisttracks';
export const CURRENT_PLAYLIST_TABLE = '#currenttable';
export const SEARCH_ALL_TABLE = '#allresulttable';
export const SEARCH_ALBUM_TABLE = '#albumresulttable';
export const SEARCH_ARTIST_TABLE = '#artistresulttable';
export const SEARCH_TRACK_TABLE = '#trackresulttable';

const URI_SCHEME = 'mbw';

export enum TRACK_ACTIONS {
    UNDEFINED = -1,
    PLAY_NOW = 0,
    PLAY_NEXT = 1,
    ADD_THIS_BOTTOM = 2,
    ADD_ALL_BOTTOM = 3,
    PLAY_ALL = 4,
    DYNAMIC = 5,
    INSERT_AT_INDEX = 6,
}

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

function scrollToTop () {
    //todo
    // $('body,html').animate({
    //     scrollTop: 0
    // }, 250)
}

export function scrollToTracklist () {
    //todo
    // let divtop = $('#playlisttracksdiv').offset().top - 120
    // $('body,html').animate({
    //     scrollTop: divtop
    // }, 250)
}

// A hack to find the name of the first artist of a playlist. this is not yet returned by mopidy
// does not work wel with multiple artists of course
export function getArtist (pl) {
    for (let i = 0; i < pl.length; i++) {
        for (let j = 0; j < pl[i].artists.length; j++) {
            if (pl[i].artists[j].name !== '') {
                return pl[i].artists[j].name
            }
        }
    }
}

// A hack to find the first album of a playlist. this is not yet returned by mopidy
export function getAlbum (pl) {
    for (let i = 0; i < pl.length; i++) {
        if (pl[i].album.name !== '') {
            return pl[i].album.name
        }
    }
}

export function artistsToString (artists, max = 3) {
    let result = '';
    if (artists && artists.length > 0) {
        for (let i = 0; i < artists.length && i < max; i++) {
            if (artists[i].name) {
                if (i > 0) {
                    result += ', ';
                }
                result += artists[i].name;
            }
        }
    }
    return result;
}

/** ******************************************************
 * break up results and put them in album tables
 *********************************************************/
export function albumTracksToTable (pl, target, uri) {
    let track, previousTrack, nextTrack;
    let html = '';
    document.querySelector(target).innerHTML = "";
    document.querySelector(target).attr('data', uri);
    for (let i = 0; i < pl.length; i++) {
        previousTrack = track || undefined;
        nextTrack = i < pl.length - 1 ? pl[i + 1] : undefined;
        track = pl[i];
        getState().popupData[track.uri] = track;
        html += renderSongLi(previousTrack, track, nextTrack, uri, '', target, i, pl.length);
    }
    document.querySelector(target).append(html);
    // updatePlayIcons(getState().songdata.track.uri, getState().songdata.tlid, controls.getIconForAction());
}

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

/* Tracklist renderer to insert dividers between albums. */
export function renderSongLiDivider (previousTrack, track, nextTrack, target) {
    // let html = ''
    // let imageID
    // // Render differently if part of an album.
    // if (!hasSameAlbum(previousTrack, track) && hasSameAlbum(track, nextTrack)) {
    //     // Large divider with album cover.
    //     let showAlbum = '';
    //     if (typeof track.album.uri !== 'undefined') {
    //         showAlbum = 'onclick="return library.showAlbum(\'' + track.album.uri + '\', mopidy);"'
    //     }
    //     html +=
    //         '<li class="albumdivider"><a href="#" ' + showAlbum + '>' +
    //         '<img id="' + getUniqueId(target + '-cover', track.uri) + '" class="artistcover" width="30" height="30"/>' +
    //         '<h1>' + track.album.name + '</h1><p>' +
    //         renderSongLiTrackArtists(track) + '</p></a></li>'
    //     // The element ID to populate with an album cover.
    //     imageID = getUniqueId(target + '-cover', track.uri, true)
    // } else if (previousTrack && !hasSameAlbum(previousTrack, track)) {
    //     // Small divider
    //     html += '<li class="smalldivider"> &nbsp;</li>'
    // }
    // if (html.length > 0 && typeof target !== 'undefined' && target.length > 0) {
    //     target = getUniqueId(target, track.uri, true)
    //     document.querySelector(target).before(html);
    // }
    // return [html, imageID];
}

export function renderSongLiBackButton (results, target, onClick, optional = undefined) {
    if (onClick && onClick.length > 0) {
        if (!results || results.length === 0) {
            document.querySelector(target).innerHTML= "";
            document.querySelector(target).append(
                '<li class="song albumli"><a href="#" onclick="' + onClick + '"><h1><i></i>No tracks found...</h1></a></li>'
            );
        }
        let opt = '';
        if (optional) {
            opt = ' backnav-optional';
        }
        document.querySelector(target).prepend(
            '<li class="backnav' + opt + '"><a href="#" onclick="' + onClick + '"><h1><i class="fa fa-arrow-circle-left"></i> Back</h1></a></li>'
        );
    }
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

export function resultsToTables (results, target: string, uri: string = undefined, onClickBack = undefined, backIsOptional = undefined) {
    // document.querySelector(target).innerHTML = "";
    // renderSongLiBackButton(results, target, onClickBack, backIsOptional)
    // if (!results || results.length === 0) {
    //     return;
    // }
    // document.querySelector(target).setAttribute('data', uri);
    //
    // let track, previousTrack, nextTrack, tlid;
    // let html = '';
    // let requiredImages = {};
    //
    // // Break into albums and put in tables
    // for (let i = 0; i < results.length; i++) {
    //     previousTrack = track || undefined;
    //     nextTrack = i < results.length - 1 ? results[i + 1] : undefined;
    //     track = results[i];
    //     if (track) {
    //         if ('tlid' in track) {
    //             // Get track information from TlTrack instance
    //             tlid = track.tlid;
    //             track = track.track;
    //             nextTrack = nextTrack ? nextTrack.track : undefined;
    //         }
    //         getState().popupData[track.uri] = track;
    //         let divider = renderSongLiDivider(previousTrack, track, nextTrack, target);
    //         html += divider[0] + renderSongLi(previousTrack, track, nextTrack, uri, tlid, target, i, results.length);
    //         requiredImages[track.uri] = divider[1];
    //     }
    // }
    // document.querySelector(target).append(html);
    // updatePlayIcons(getState().songdata.track.uri, getState().songdata.tlid, controls.getIconForAction())
    // images.setImages(requiredImages, getState().mopidy, 'small');
}

function getUris (tracks) {
    let results = []
    for (let i = 0; i < tracks.length; i++) {
        results.push(tracks[i].uri)
    }
    return results
}

export function getTracksFromUri (uri, full_track_data) {
    let returnTracksOrUris = function (tracks) {
        return full_track_data ? tracks : getUris(tracks)
    }
    if (getState().customTracklists[uri]) {
        return returnTracksOrUris(getState().customTracklists[uri])
    } else if (getState().playlists[uri] && getState().playlists[uri].tracks) {
        return returnTracksOrUris(getState().playlists[uri].tracks)
    }
    return []
}

// convert time to human readable format
function timeFromSeconds (length) {
    let d = Number(length);
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);
    return ((h > 0 ? h + ':' : '') + (m > 0 ? (h > 0 && m < 10 ? '0' : '') + m + ':' : '0:') + (s < 10 ? '0' : '') + s);
}

/** ***** Toast ***/
function toast (message, delay, textOnly) {
    //todo
    // let textOnl = textOnly || false;
    // message = message || 'Loading...'
    // delay = delay || 1000
    // $.mobile.loading('show', {
    //     text: message,
    //     textVisible: true,
    //     theme: 'a',
    //     textonly: textOnl
    // })
    // if (delay > 0) {
    //     setTimeout(function () {
    //         $.mobile.loading('hide')
    //     }, delay)
    // }
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

function validServiceUri (str: string) {
    return validUri(str) || isServiceUri(str);
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

function getMediaHuman (uri) {
    let scheme = getScheme(uri)
    for (let i = 0; i < uriHumanList.length; i++) {
        if (scheme.toLowerCase() === uriHumanList[i][0].toLowerCase()) {
            return uriHumanList[i][1]
        }
    }
    return ''
}

function isServiceUri (uri) {
    let scheme = getScheme(uri)
    let i = 0
    for (i = 0; i < uriClassList.length; i++) {
        if (scheme === uriClassList[i][0]) {
            return true
        }
    }
    for (i = 0; i < radioExtensionsList.length; i++) {
        if (scheme === radioExtensionsList[i]) {
            return true
        }
    }
    return false
}

export function isFavouritesPlaylist (playlist) {
    return (playlist.name === STREAMS_PLAYLIST_NAME &&
            getScheme(playlist.uri) === STREAMS_PLAYLIST_SCHEME)
}

// Returns a string where {x} in template is replaced by tokens[x].
function stringFromTemplate (template, tokens) {
    return template.replace(/{[^}]+}/g, function (match) {
        return tokens[match.slice(1, -1)]
    })
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

export function updatePlayIcons(uri: string, tlid: number, popupMenuIcon) {
    // Update styles of listviews
    let listviews = [PLAYLIST_TABLE, SEARCH_TRACK_TABLE, ARTIST_TABLE, ALBUM_TABLE, BROWSE_TABLE];
    let target = CURRENT_PLAYLIST_TABLE.substring(1);
    if (uri && typeof tlid === 'number' && tlid >= 0) {
        document.querySelector(CURRENT_PLAYLIST_TABLE).querySelectorAll('li.song.albumli').forEach((el) => {
            let eachTlid = parseInt(el.getAttribute('tlid'));
            if (this.id === getUniqueId(target, uri) && eachTlid === tlid) {
                if (!el.classList.contains('currenttrack')) {
                    el.classList.add('currenttrack');
                }
            } else if (el.classList.contains('currenttrack')) {
                el.classList.remove('currenttrack');
            }
        })
    }

    let popupElement;

    for (let i = 0; i < listviews.length; i++) {
        target = listviews[i].substring(1)
        document.querySelector(listviews[i]).querySelectorAll('li.song.albumli').forEach((el) => {
            if (uri) {
                if (this.id === getUniqueId(target, uri)) {
                    el.classList.add('currenttrack2');
                } else {
                    el.classList.remove('currenttrack2');
                }
            }
            if (popupMenuIcon) {
                popupElement = el.querySelector('a.moreBtn').querySelectorAll('i').item(0);
                if (!popupElement.hasClass(popupMenuIcon)) {
                    popupElement.removeClass()
                    popupElement.addClass(popupMenuIcon)
                }
            }
        })
    }
}

export function switchContent(divid: string, uri: string = undefined) {
    let hash = divid;
    if (uri) {
        hash += '?' + uri
    }
    location.hash = '#' + hash
}

export function jsonParse<T>(data: string, defaultValue: T) {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(e);
        return defaultValue;
    }
}