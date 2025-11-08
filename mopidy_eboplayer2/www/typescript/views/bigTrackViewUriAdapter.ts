import getState from "../playerState";
import {EboplayerEvents, Model, TrackModel, TrackType} from "../model";
import {EboPlayerDataType} from "./view";
import {BigTrackViewAdapter} from "./bigTrackViewAdapter";
import {numberedDictToArray} from "../controller";
import {models} from "../../js/mopidy";
import {EboBigTrackView} from "../components/eboBigTrackView";
import Track = models.Track;

export enum AlbumDataType {
    None,
    Loading,
    Loaded,
    StreamLinesLoaded
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
    albumTrack: models.Track;
}

interface AlbumStreamLinesLoaded {
    type: AlbumDataType.StreamLinesLoaded;
    lines: string[][];
    albumTrack: models.Track;
}

export const AlbumNone: AlbumDataNone = {
    type: AlbumDataType.None
}

const AlbumLoading: AlbumDataLoading = {
    type: AlbumDataType.Loading
}

export type AlbumData = AlbumDataLoaded | AlbumDataNone | AlbumDataLoading | AlbumStreamLinesLoaded;

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
        getState().getModel().addEventListener(EboplayerEvents.activeStreamLinesChanged, () => {
            this.onStreamLinesChanged();
        });
        let comp = document.getElementById(this.componentId) as EboBigTrackView;
        comp.addEventListener("albumClick", async (e) => {
            let show_back = comp.getAttribute("show_back");
            comp.setAttribute("show_back",  show_back == "true" ? "false" : "true");
            console.log(e);
            await this.fetchAlbumData(comp);
        });
    }

    private async fetchAlbumData(comp: EboBigTrackView) {
        if (this.albumInfo.type == AlbumDataType.None) {
            switch (this.track.type) {
                case TrackType.File:
                    console.log(this.track.track.album.uri);
                    let album = await getState().getController().lookupCached(this.track.track.album.uri);
                    let albumTracks = numberedDictToArray<Track>(album);
                    this.albumInfo = <AlbumDataLoaded>{
                        type: AlbumDataType.Loaded,
                        tracks: albumTracks,
                        albumTrack: this.track.track
                    };
                    comp.albumInfo = this.albumInfo;
                    break;
                case TrackType.Stream:
                    let stream_lines = await getState().getController().fetchAllStreamLines(this.uri);
                    let groupLines = function (grouped: string[][], line: string){
                        if(line == "---") {
                            grouped.push([]);
                            return grouped;
                        }
                        grouped[grouped.length-1].push(line);
                        return grouped;
                    }
                    let grouped = stream_lines
                        .reduce<string[][]>(groupLines, new Array([]))
                        .filter(lineGroup => lineGroup.length);
                    this.albumInfo = <AlbumStreamLinesLoaded>{
                        type: AlbumDataType.StreamLinesLoaded,
                        lines: grouped,
                        albumTrack: this.track.track
                    };
                    comp.albumInfo = this.albumInfo;
                    break;
            }
        }
    }

    setUri(uri: string) {
        this.uri = uri;
        getState().getController().getTrackInfo(this.uri)
            .then(track => {
                this.track = track;
                this.albumInfo = AlbumNone;
                this.setComponentData();
                let comp = document.getElementById(this.componentId) as EboBigTrackView;
                if(comp.getAttribute("show_back") == "true")
                    this.fetchAlbumData(comp).then(r => {});
            });
    }

    protected onStreamLinesChanged() {
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