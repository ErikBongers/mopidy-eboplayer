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


// from http://dzone.com/snippets/validate-url-regexp
export function validUri (uri: string) {
    let regexp = /^(http|https|mms|rtmp|rtmps|rtsp):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(uri);
}

export function getScheme (uri: string) {
    return uri.split(':')[0].toLowerCase();
}

export function jsonParse<T>(data: string, defaultValue: T): T {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(e);
        return defaultValue;
    }
}