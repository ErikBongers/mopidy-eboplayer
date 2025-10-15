import {library} from "./library";
import {models, Mopidy, Options} from "../mopidy_eboplayer2/static/js/mopidy";
import {showOffline, switchContent, TRACK_ACTIONS, updatePlayIcons} from "./functionsvars";
import {SyncedProgressTimer} from "./synced_timer";
import * as controls from "./controls";
import getState, {setState, State} from "./playerState";
import {FileTrackModel, Model, StreamTrackModel} from "./model";
import {Commands} from "../scripts/commands";
import {HeaderView} from "./views/headerView";
import {Controller, getWebSocketUrl} from "./controller";
import {BigTrackView} from "./views/bigTrackView";
import {ButtonBarView} from "./views/buttonBarView";
import {EboProgressBar} from "./components/eboProgressBar";
import {HistoryView} from "./views/historyView";
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
    // controls.setPlayState(false);
    // controls.setPosition(0);
    // getState().getModel().clearActiveTrack();
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
    // if(getState().getModel().activeTrack.type == TrackType.Stream) {
    //     let trackInfo = getState().getModel().getActiveTrack();
    //     if(trackInfo.type == TrackType.Stream)
    //         updateStreamTrackView(trackInfo as StreamTrackModel);
    // }
    // else if (getState().getModel().activeTrack.type == TrackType.File) {
    //     let trackInfo = getState().getModel().getActiveTrack();
    //     if(trackInfo.type == TrackType.File)
    //         updateFileTrackView(trackInfo as FileTrackModel);
    // }
}

function updateFileTrackView (trackInfo: FileTrackModel) {
    // updatePlayIcons(trackInfo.track.uri, trackInfo.track.tlid, controls.getIconForAction(TRACK_ACTIONS.UNDEFINED));
    //
    // if (trackInfo.songlenght == Infinity) {
    //     (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'none';
    // } else {
    //     (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'block';
    // }
    //
    // getState().artistsHtml = '';
    // getState().artistsText = '';
    // let artists = trackInfo.tlTrack.track.artists;
    // if (artists) {
    //     for (let j = 0; j < artists.length; j++) {
    //         let artistName = artists[j].name;
    //         if (j !== artists.length - 1) {
    //             artistName += ', ';
    //         }
    //         getState().artistsHtml += '<a href="#" onclick="return library.showArtist(\'' + artists[j].uri + '\', getState().mopidy);">' + artistName + '</a>';
    //         getState().artistsText += artistName;
    //     }
    // }
    //
    // getState().albumHtml = '';
    // getState().albumText = '';
    // let album = trackInfo.tlTrack.track.album;
    // if (album && album.name) {
    //     getState().albumHtml = '<a href="#" onclick="return library.showAlbum(\'' + album.uri + '\', getState().mopidy);">' + album.name + '</a>';
    //     getState().albumText = album.name;
    // }
    //
    // if (trackInfo.tlTrack.track.uri) {
    //     // Add 'Show Info' icon to album image
    //     document.getElementById('trackInfoBig').append(
    //         '<a href="#" class="infoBtn" onclick="return controls.showInfoPopup(\'' + trackInfo.tlTrack.track.uri + '\', \'undefined\', getState().mopidy);">' +
    //         '<i class="fa fa-info-circle"></i></a>')
    // }
    //
    // document.getElementById('trackslider').setAttribute('min', "0");
    // document.getElementById('trackslider').setAttribute('max', getState().songlength.toString());
    // getState().syncedProgressTimer.reset().set(0, getState().songlength);
    // if (getState().play) {
    //     getState().syncedProgressTimer.start()
    // }
    //
    // resizeMb()
}
function updateStreamTrackView (trackInfo: StreamTrackModel) {
    // updatePlayIcons(trackInfo.tlTrack.track.uri, trackInfo.tlTrack.tlid, controls.getIconForAction(TRACK_ACTIONS.UNDEFINED));
    //
    // (document.getElementById('trackslider').querySelector('.ui-slider-handle') as HTMLElement).style.display = 'none';
    //
    // getState().artistsHtml = '';
    // getState().artistsText = '';
    //
    // getState().albumHtml = '';
    // getState().albumText = '';
    // if (trackInfo.tlTrack.track.uri) {
    //     // Add 'Show Info' icon to album image
    //     document.getElementById('trackInfoBig').append(
    //         '<a href="#" class="infoBtn" onclick="return controls.showInfoPopup(\'' + trackInfo.tlTrack.track.uri + '\', \'undefined\', getState().mopidy);">' +
    //         '<i class="fa fa-info-circle"></i></a>')
    // }
    // resizeMb()
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
            (document.getElementById('nowPlaying_footer') as HTMLElement).style.display = 'block';
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
            (document.getElementById('nowPlaying_footer') as HTMLElement).style.display = 'none';
    }
    return false
}

/** *********************
 * initialize software *
 ***********************/
document.addEventListener("DOMContentLoaded",function () {
    showOffline(true);

    // window.onhashchange = locationHashChanged;
    // if (location.hash.length < 2) {
    //     doSwitchContent('nowPlaying');
    // }
    let webSocketUrl = getWebSocketUrl();
    let connectOptions: Options = {
        webSocketUrl,
        autoConnect: false //important: delay connection until all bindings, listeners and dependencies are setup.
    };
    let mopidy = new Mopidy(connectOptions);
    let timer = new SyncedProgressTimer(8, mopidy);
    let model = new Model();

    let controller = new Controller(model, mopidy);

    controller.initSocketevents();

    let state = new State(mopidy, timer, model, controller);
    setState(state);

    let headerView = new HeaderView();
    let currentTrackView = new BigTrackView("nowPlayingpane");
    let buttonBarView = new ButtonBarView("buttonBar");
    let historyView = new HistoryView();
    getState().addViews(headerView, currentTrackView, buttonBarView, historyView);

    clearSelectedTrack();

    mopidy.connect();

    document.getElementById("showHistory").onclick = async () => {
        await getState().getController().fetchHistory();
    };
    document.getElementById("showBrowse").onclick = async () => {
        // let browse = await getState().commands.core.library.browse(null);
        // console_yellow("browse");
        // console.log({browse});
    };
});

export function console_yellow(msg: string) {
    console.log(`%c${msg}`, 'background-color: yellow');
}
function updateDocumentTitle (headline) {
    headline = headline || document.getElementById('contentHeadline').textContent;
    document.title = headline + ' | ' + document.body.dataset.title;
}

EboProgressBar.define(); //todo: move elsewhere? Initialize them from a static registy?