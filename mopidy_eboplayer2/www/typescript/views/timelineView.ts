import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import models from "../../js/mopidy";
import {console_yellow} from "../gui";
import {transformTrackDataToModel} from "../global";
import {EboplayerEvents, HistoryLine, TrackType} from "../modelTypes";

export class TimelineView extends View {
    private clickedRow: HTMLTableRowElement;
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
            this.onHistoryChangegd().then(r => {});
        });
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
            this.onSelectedTrackChanged();
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

        Promise.all(allLookups).then(()=> {
            this.setCurrentTrack();
        });

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev)});
            tr.addEventListener("click", ev => {this.onRowClicked(ev)});
        });
    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        this.setRowsClass(row, ["clicked"]);

        getState().getController().setSelectedTrack(row.dataset.uri);
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        this.clickedRow = ev.currentTarget as HTMLTableRowElement;
        await getState().getController().playTrack(this.clickedRow.dataset.uri);
    }

    private setRowsClass(rowOrSelector: HTMLTableRowElement | string, classes: string[]) {
        document
            .getElementById("timelineTable")
            .querySelectorAll(`tr`)
            .forEach(tr =>
                tr.classList.remove(...classes)
            );
        if(rowOrSelector instanceof HTMLTableRowElement)
            rowOrSelector.classList.add(...classes);
        else {
            document
                .getElementById("timelineTable")
                .querySelectorAll(rowOrSelector)
                .forEach(tr =>
                    tr.classList.add(...classes)
                );
        }
    }

    private setSelectedTrack() {
        let selectedTrackUri = getState().getModel().getSelectedTrack();
        this.setRowsClass(`tr[data-uri="${selectedTrackUri}"]`, ["selected"]);
    }

    private async setCurrentTrack() {
        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let currentTrack = await getState().getController().getCurrertTrackInfoCached();
        if (currentTrack.type == TrackType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let currentUri = currentTrack.track.uri;
        let tr = timelineTable.querySelector(`tr[data-uri="${currentUri}"]`);
        if(!tr)
            return;
        if(this.clickedRow?.dataset?.uri != currentTrack.track.uri)
            tr.scrollIntoView( { block: "nearest" });
        timelineTable.querySelectorAll("tr").forEach(tr  => tr.classList.remove("current", "textGlow"));
        tr.classList.add("current", "textGlow");
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
        this.setCurrentTrack();
    }

    private onSelectedTrackChanged() {
        this.setSelectedTrack();
    }

}
