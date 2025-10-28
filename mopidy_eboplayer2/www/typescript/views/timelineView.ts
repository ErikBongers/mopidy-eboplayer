import getState from "../playerState";
import {EboplayerEvents, HistoryLine, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {transformTrackDataToModel} from "../controller";
import {models} from "../../js/mopidy";

export class TimelineView extends View {
    private clickedRow: HTMLTableRowElement;
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
            this.onHistoryChangegd().then(r => {});
        });
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChanged();
        });
    }


    private async onHistoryChangegd() {
        let history = getState().getModel().getHistory();
        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let body = timelineTable.tBodies[0];
        body.innerHTML = "";

        let allLookups: Promise<void>[] = [];
        for(let line of history) {
            allLookups.push(this.insertTrackLine(line, body));
        }

        // noinspection ES6MissingAwait
        getState().getController().fetchCurrentTrackAndDetails();

        Promise.all(allLookups).then(()=> {
            this.setActiveTrack();
        });

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("click", ev => {this.onRowDoubleClicked(ev)});
            tr.addEventListener("dblclick", ev => {this.onRowClicked(ev)});
        });
    }

    private onRowClicked(ev: MouseEvent) {
        this.clickedRow = ev.currentTarget as HTMLTableRowElement;
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        this.clickedRow = ev.currentTarget as HTMLTableRowElement;
        await getState().getController().playTrack(this.clickedRow.dataset.uri);
    }

    private setActiveTrack() {
        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let currentTrack = getState().getModel().getCurrentTrack();
        if (currentTrack.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        /*if (currentTrack.type != TrackType.None)*/ {
            let currentUri = currentTrack.track.uri;
            let tr = timelineTable.querySelector(`tr[data-uri="${currentUri}"]`);
            if(!tr)
                return;
            if(this.clickedRow?.dataset?.uri != currentTrack.track.uri)
                tr.scrollIntoView( { block: "nearest" });
            timelineTable.querySelectorAll("tr").forEach(tr  => tr.classList.remove("active", "textGlow"));
            tr.classList.add("active", "textGlow");
        }
    }

    private insertTrackLine(line: HistoryLine, body: HTMLTableSectionElement) {
        let slices = line.ref.name.split(" - ");
        let title = slices.pop();

        let tr = document.createElement("tr");
        body.insertAdjacentElement('afterbegin', tr);
        tr.classList.add("trackLine");
        tr.dataset.uri = line.ref.uri;
        this.setTrackLineContent(tr, title);
        body.insertAdjacentHTML('afterbegin', `
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);

        //delayed update of track info.
        return getState().getController().lookupCached(line.ref.uri).then(tracks => {
            this.updateTrackLineFromLookup(tr, tracks, title);
        });
    }

    private updateTrackLineFromLookup(tr: HTMLTableRowElement, tracks: models.Track[], title: string) {
        let track = transformTrackDataToModel(tracks[0]);
        let artist =  "⚬⚬⚬";
        let album =  "⚬⚬⚬";
        switch (track.type) {
            case TrackType.File:
                title = track.title;
                artist = track.track.artists[0].name; //todo: add other names?
                album = track.track.album.name;
                break;
            case TrackType.Stream:
                title = track.name;
                break;
        }
        this.setTrackLineContent(tr, title, artist, album);
    }

    private setTrackLineContent(tr: HTMLTableRowElement, title: string, artist: string = "⚬⚬⚬", album: string = "⚬⚬⚬") {
        tr.innerHTML = `
    <td>
        <h1>${title}</h1>
        <small>${artist} • ${album}</small>
    </td>
    <td>
        <button><i class="fa fa fa-ellipsis-v"></i></button>
    </td>
            `;
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [EboPlayerDataType.TrackList];
    }

    private onCurrentTrackChanged() {
        this.setActiveTrack();
    }

}
