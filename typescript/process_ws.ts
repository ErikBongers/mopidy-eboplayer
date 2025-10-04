import * as controls from "./controls";
import {resetSong, setSongInfo, setStreamTitle, updatePlayIcons} from "./gui";
import {ALBUM_TABLE, albumTracksToTable, ARTIST_TABLE, BROWSE_TABLE, CURRENT_PLAYLIST_TABLE, getAlbum, getArtist, getMediaClass, hasSameAlbum, isFavouritesPlaylist, renderSongLi, renderSongLiAlbumInfo, renderSongLiBackButton, renderSongLiDivider, resultsToTables, scrollToTracklist, showLoading} from "./functionsvars";
import * as images from "./images";
import getState from "./playerState";

export function processCurrenttrack (data) {
    setSongInfo(data)
    getState().mopidy.playback.getStreamTitle().then(function (title) {
        setStreamTitle(title)
    }, console.error)
}

export function processVolume (data: number | null) {
    controls.setVolume(data);
}

export function processMute (data: boolean | null) {
    controls.setMute(data);
}

export function processRepeat (data) {
    controls.setRepeat(data);
}

export function processRandom (data) {
    controls.setRandom(data);
}

export function processConsume (data) {
    controls.setConsume(data);
}

export function processSingle (data) {
    controls.setSingle(data);
}

export function processCurrentposition (data) {
    controls.setPosition(parseInt(data))
}

export function processPlaystate (data) {
    if (data === 'playing') {
        controls.setPlayState(true)
    } else {
        controls.setPlayState(false)
    }
}

function processBrowseDir (resultArr: string | any[]) {
    document.querySelector(BROWSE_TABLE).innerHTML = "";
    if (getState().browseStack.length > 0) {
        renderSongLiBackButton(resultArr, BROWSE_TABLE, 'return library.getBrowseDir();');
    }
    if (!resultArr || resultArr.length === 0) {
        showLoading(false);
        return;
    }
    let uris = [];
    let ref, previousRef, nextRef;
    let uri = resultArr[0].uri;
    let length = 0 || resultArr.length;
    getState().customTracklists[BROWSE_TABLE] = [];
    let html = '';

    // Render list of tracks
    for (let i = 0, index = 0; i < resultArr.length; i++) {
        if (resultArr[i].type === 'track') {
            previousRef = ref || undefined;
            nextRef = i < resultArr.length - 1 ? resultArr[i + 1] : undefined;
            ref = resultArr[i];
            // TODO: consolidate usage of various arrays for caching URIs, Refs, and Tracks
            getState().popupData[ref.uri] = ref;
            getState().customTracklists[BROWSE_TABLE].push(ref);
            uris.push(ref.uri);

            html += renderSongLi(previousRef, ref, nextRef, BROWSE_TABLE, '', BROWSE_TABLE, index, resultArr.length);

            index++;
        } else {
            html += '<li><a href="#" onclick="return library.getBrowseDir(this.id);" id="' + resultArr[i].uri + '">' +
                    '<h1><i class="' + getMediaClass(resultArr[i]) + '"></i> ' + resultArr[i].name + '</h1></a></li>';
        }
    }

    document.querySelector(BROWSE_TABLE).append(html);
    if (getState().browseStack.length > 0) {
        window.scrollTo(0, getState().browseStack[getState().browseStack.length - 1].scrollPos || 0)  // Restore scroll position
    }

    updatePlayIcons(getState().songdata.track.uri, getState().songdata.tlid, controls.getIconForAction())

    // Look up track details and add album headers
;    if (uris.length > 0) {
        getState().mopidy.library.lookup({'uris': uris}).then(function (resultDict) {
            // Break into albums and put in tables
            let requiredImages = {};
            let track, previousTrack, nextTrack, uri;
            for (let i = 0, index = 0; i < resultArr.length; i++) {
                if (resultArr[i].type === 'track') {
                    previousTrack = track || undefined
                    if (i < resultArr.length - 1 && resultDict[resultArr[i + 1].uri]) {
                        nextTrack = resultDict[resultArr[i + 1].uri][0]
                    } else {
                        nextTrack = undefined
                    }
                    track = resultDict[resultArr[i].uri][0]
                        getState().popupData[track.uri] = track  // Need full track info in popups in order to display albums and artists.
                    if (uris.length === 1 || (previousTrack && !hasSameAlbum(previousTrack, track) && !hasSameAlbum(track, nextTrack))) {
                        renderSongLiAlbumInfo(track, BROWSE_TABLE)
                    }
                    requiredImages[track.uri] = renderSongLiDivider(previousTrack, track, nextTrack, BROWSE_TABLE)[1]
                }
            }
            showLoading(false)
            images.setImages(requiredImages, getState().mopidy, 'small')
        }, console.error)
    } else {
        showLoading(false)
    }
}

function processGetPlaylists (resultArr) {
    if ((!resultArr) || (resultArr === '')) {
        document.getElementById('playlistslist').innerHTML = "";
        return
    }
    let tmp = '';
    let favourites = '';
    let starred = '';

    for (let i = 0; i < resultArr.length; i++) {
        let li_html = '<li><a href="#" onclick="return library.showTracklist(this.id);" id="' + resultArr[i].uri + '">'
        if (isFavouritesPlaylist(resultArr[i])) {
            favourites = li_html + '&hearts; Musicbox Favourites</a></li>';
        } else {
            tmp = tmp + li_html + '<i class="' + getMediaClass(resultArr[i]) + '"></i> ' + resultArr[i].name + '</a></li>';
        }
    }
    // Prepend the user's Spotify "Starred" playlist and favourites to the results. (like Spotify official client).
    tmp = favourites + starred + tmp;
    document.getElementById('playlistslist').innerHTML = tmp;
    scrollToTracklist();
    showLoading(false);
}

/** ******************************************************
 * process results of a returned list of playlist track refs
 *********************************************************/
export function processPlaylistItems (resultDict) {
    var playlist = resultDict.playlist
    if (!playlist || playlist === '') {
        console.log('Playlist', resultDict.uri, 'is invalid')
        showLoading(false)
        return
    }
    let playlistUri = resultDict.uri;
    getState().playlists[playlistUri] = {'uri': playlistUri, 'tracks': []}
    if (playlistUri.startsWith('m3u')) {
        console.log('Playlist', playlistUri, 'requires tracks lookup');
        let trackUris = [];
        for (let i = 0; i < playlist.tracks.length; i++) {
            trackUris.push(playlist.tracks[i].uri)
        }
        return getState().mopidy.library.lookup({'uris': trackUris}).then(function (tracks) {
            for (let i = 0; i < trackUris.length; i++) {
                let track = tracks[trackUris[i]][0] || playlist.tracks[i];  // Fall back to using track Ref if lookup failed.
                getState().playlists[playlistUri].tracks.push(track);
            }
            showLoading(false);
            return getState().playlists[playlistUri].tracks;
        })
    } else {
        for (let i = 0; i < playlist.tracks.length; i++) {
            let track = playlist.tracks[i];
            getState().playlists[playlistUri].tracks.push(track);
        }
        showLoading(false);
        return getState().playlists[playlistUri].tracks;
    }
}

/** ******************************************************
 * process results of the queue, the current playlist
 *********************************************************/
function processCurrentPlaylist (resultArr) {
    getState().currentplaylist = resultArr
    resultsToTables(getState().currentplaylist, CURRENT_PLAYLIST_TABLE)
    getState().mopidy.playback.getCurrentTlTrack().then(processCurrenttrack, console.error)
    updatePlayIcons(getState().songdata.track.uri, getState().songdata.tlid, controls.getIconForAction())
    if (resultArr.length === 0) {
        // Last track in queue was deleted, reset UI.
        resetSong();
    }
}

/** ******************************************************
 * process results of an artist lookup
 *********************************************************/
function processArtistResults (resultArr) {
    if (!resultArr || (resultArr.length === 0)) {
        document.getElementById('h_artistname').textContent = 'Artist not found...';
        images.setAlbumImage('', ['artistviewimage', 'artistpopupimage'], getState().mopidy);
        showLoading(false);
        return;
    }
    getState().customTracklists[resultArr.uri] = resultArr

    resultsToTables(resultArr, ARTIST_TABLE, resultArr.uri)
    let artistname = getArtist(resultArr);
    document.getElementById('h_artistname').innerHTML = artistname;
    document.getElementById('artistpopupname').innerHTML = artistname;
    images.setArtistImage(resultArr.uri, resultArr[0].uri, '#artistviewimage, #artistpopupimage', getState().mopidy);
    showLoading(false)
}

/** ******************************************************
 * process results of an album lookup
 *********************************************************/
function processAlbumResults (resultArr) {
    if (!resultArr || (resultArr.length === 0)) {
        document.getElementById('h_albumname').textContent = 'Album not found...';
        images.setAlbumImage('', ['albumviewcover', 'coverpopupimage'], getState().mopidy);
        showLoading(false)
        return
    }
    getState().customTracklists[resultArr.uri] = resultArr;

    albumTracksToTable(resultArr, ALBUM_TABLE, resultArr.uri);
    let albumname = getAlbum(resultArr);
    let artistname = getArtist(resultArr);
    document.getElementById('h_albumname').innerHTML = albumname;
    document.getElementById('h_albumartist').innerHTML = artistname;
    document.getElementById('coverpopupalbumname').innerHTML = albumname;
    document.getElementById('coverpopupartist').innerHTML = artistname;
    images.setAlbumImage(resultArr[0].uri, ['albumviewcover', 'coverpopupimage'], getState().mopidy);
    showLoading(false);
}
