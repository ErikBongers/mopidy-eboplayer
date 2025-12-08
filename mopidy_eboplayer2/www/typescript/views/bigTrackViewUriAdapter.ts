import getState from "../playerState";
import {Model} from "../model";
import {EboPlayerDataType} from "./view";
import {ComponentViewAdapter} from "./componentViewAdapter";
import models from "../../js/mopidy";
import {EboBigTrackComp} from "../components/eboBigTrackComp";
import {numberedDictToArray} from "../global";
import {AlbumData, AlbumDataLoaded, AlbumDataType, AlbumNone, AlbumStreamLinesLoaded, EboplayerEvents, TrackModel, TrackType} from "../modelTypes";
import Track = models.Track;

export class BigTrackViewUriAdapter extends ComponentViewAdapter {
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
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onActiveTrackChanged();
        });
        let comp = document.getElementById(this.componentId) as EboBigTrackComp;
        comp.addEventListener("albumClick", async (e) => {
            this.onAlbumClick();
        });
    }

    setUri(uri: string) {
        this.uri = uri;
        getState().getController().getTrackInfoCached(this.uri)
            .then(async track => {
                this.track = track;
                this.albumInfo = AlbumNone;
                this.setComponentData();
                let comp = document.getElementById(this.componentId) as EboBigTrackComp;
                this.albumInfo = await getState().getController().fetchAlbumDataForTrack(track);
                comp.albumInfo = this.albumInfo;
            });
    }

    protected onStreamLinesChanged() {
        this.streamLines = "";
        let linesObject = getState().getModel().getActiveStreamLines();
        if(linesObject?.uri == this.uri)
            this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
    }

    protected onActiveTrackChanged() {
        let linesObject = getState().getModel().getActiveStreamLines();
        if(linesObject?.uri == this.uri)
            this.streamLines = linesObject.active_titles?.join("<br/>") ?? "";
        document.getElementById(this.componentId).setAttribute("stream_lines", this.streamLines);
        let comp = document.getElementById(this.componentId) as EboBigTrackComp;
        comp.activeTrackUri = getState().getModel().getCurrentTrack();
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

    private onAlbumClick() {
        //todo: remove if handled by mainView. (bubbled up)
    }
}