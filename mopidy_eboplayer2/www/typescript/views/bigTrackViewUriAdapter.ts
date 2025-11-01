import getState from "../playerState";
import {EboplayerEvents, Model, TrackModel, TrackType} from "../model";
import {EboPlayerDataType} from "./view";
import {BigTrackViewAdapter} from "./bigTrackViewAdapter";
import {console_yellow} from "../gui";
import {numberedDictToArray} from "../controller";
import {models} from "../../js/mopidy";
import Track = models.Track;
import {EboBigTrackView} from "../components/eboBigTrackView";

export enum AlbumDataType {
    None,
    Loading,
    Loaded
}

interface AlbumDataNone {
    type: AlbumDataType.None;
}
interface AlbumDataLoading {
    type: AlbumDataType.Loading;
}
interface AlbumDataLoaded {
    type: AlbumDataType.Loaded;
    tracks: Track[];
    albumTrack: models.Track
}

export const AlbumNone: AlbumDataNone = {
    type: AlbumDataType.None
}

const AlbumLoading: AlbumDataLoading = {
    type: AlbumDataType.Loading
}

export type AlbumData = AlbumDataLoaded | AlbumDataNone | AlbumDataLoading;

export class BigTrackViewUriAdapter extends BigTrackViewAdapter {
    private streamLines: string;
    private track: TrackModel;
    private uri: string;
    private albumInfo: AlbumData;

    constructor(id: string) {
        super(id);
        this.streamLines = "";
        this.track = Model.NoTrack;
        this.uri = "";
        this.albumInfo = AlbumNone;
    }

    bind() {
        super.bind();
        //todo: streamlines belong to specific stream uris. Make seperate streamline files for per stream (uri).
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
        let comp = document.getElementById(this.componentId) as EboBigTrackView;
        comp.addEventListener("albumClick", async (e) => {
            console_yellow("ALBUM CLICKKK");
            let show_back = comp.getAttribute("show_back");
            comp.setAttribute("show_back",  show_back == "true" ? "false" : "true");
            console.log(e);
            if(this.albumInfo.type == AlbumDataType.None) {
                console_yellow("TODO: load extra data");
                if(this.track.type == TrackType.File) {
                    console.log(this.track.track.album.uri);
                    let album = await getState().getController().lookupCached(this.track.track.album.uri);
                    let albumTracks = numberedDictToArray<Track>(album);
                    this.albumInfo = <AlbumDataLoaded> {
                        type: AlbumDataType.Loaded,
                        tracks: albumTracks,
                        albumTrack: this.track.track
                    };
                    comp.albumInfo = this.albumInfo;
                }
            }
        });
    }

    setUri(uri: string) {
        this.uri = uri;
        getState().getController().getTrackInfo(this.uri)
            .then(track => {
                this.track = track;
                this.albumInfo = AlbumNone;
                this.setComponentData();
            });
    }

    protected onStreamLinesChanged() {
        console_yellow("STREAM");
        this.streamLines = "";
        let linesObject = getState().getModel().getActiveStreamLines();
        if(linesObject?.uri == this.uri)
            this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    protected setComponentData() {
        if(this.track.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let name = "no current track";
        let info = "";
        let position: string;
        let button: string;
        switch (this.track.type) {
            case TrackType.Stream:
                name = this.track.name;
                position = "100";
                button = "false";
                break;
            case TrackType.File:
                name = this.track.title;
                info = this.track.track.album.name;
                position = "60"; //todo: just a test
                button = "true";
                let artists = this.track.track.artists.map(a => a.name).join(", ");
                let composers = this.track.track.composers?.map(c => c.name)?.join(", ") ?? "";
                if(artists)
                    info += "<br>" + artists;
                if(composers)
                    info += "<br>" + composers;
                break;
        }
        document.getElementById(this.componentId).setAttribute("name", name);
        document.getElementById(this.componentId).setAttribute("info", info);
        document.getElementById(this.componentId).setAttribute("position", position);
        document.getElementById(this.componentId).setAttribute("button", button);
        this.onStreamLinesChanged();
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList, EboPlayerDataType.StreamLines, ...super.getRequiredDataTypes()];
    }

}