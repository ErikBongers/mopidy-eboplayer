import getState from "../playerState";
import {EboPlayerDataType, View} from "./view";
import models from "../../js/mopidy";
import {transformTrackDataToModel} from "../global";
import {EboplayerEvents, FileTrackModel, HistoryLine, StreamTrackModel, ItemType} from "../modelTypes";

export class TimelineView extends View {
    private clickedRow: HTMLTableRowElement;
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
            this.rebuildTimeline().then(r => {});
        });
        getState().getModel().addEventListener(EboplayerEvents.trackListChanged, () => {
            this.rebuildTimeline().then(r => {});
        });
        getState().getModel().addEventListener(EboplayerEvents.currentTrackChanged, () => {
            this.onCurrentTrackChanged();
        });
        getState().getModel().addEventListener(EboplayerEvents.selectedTrackChanged, () => {
            this.onSelectedTrackChanged();
        });
    }


    private async rebuildTimeline() {
        let history = getState().getModel().getHistory() ?? [];
        let trackList = getState().getModel().getTrackList() ?? [];

        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let body = timelineTable.tBodies[0];
        body.innerHTML = "";

        if(history.length > 0 && trackList.length > 0 && history[0].ref.uri == trackList[0].track.uri)
            history.shift(); //remove most recent history line if it's the first track in the playlist.

        // if we want to limit the number of history lines we can do so here.
        // history = history.slice(0, 50);

        let allLookups: Promise<void>[] = [];
        //reverse order as we want the most recent tracks to at the bottom.
        for(let i = history.length - 1; i >= 0; i-- ) {
            allLookups.push(this.insertHistoryLine(history[i], body));
        }

        for(let track of trackList) {
            allLookups.push(this.insertTrackLine(track.track.name, track.track.uri, body, [], track.tlid)); //todo: actually we already have the track info. No need for lookup.
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
        if(this.clickedRow.dataset.tlid)
            await getState().getController().play(parseInt(this.clickedRow.dataset.tlid));
        else
            await getState().getController().clearListAndPlay(this.clickedRow.dataset.uri);
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
        if(!currentTrack)
            return;
        if (currentTrack.type == ItemType.None)
            return; // don't clear the screen as this is probably temporary and will cause a flicker.
        let currentUri = currentTrack.track.uri;
        let trs = [...timelineTable.querySelectorAll(`tr[data-uri="${currentUri}"]`)];
        if(trs.length == 0)
            return;
        let tr = trs[trs.length - 1];
        if(this.clickedRow?.dataset?.uri != currentTrack.track.uri)
            tr.scrollIntoView( { block: "nearest" });
        timelineTable.querySelectorAll("tr").forEach(tr  => tr.classList.remove("current", "textGlow"));
        tr.classList.add("current", "textGlow");
    }

    private async insertHistoryLine(line: HistoryLine, body: HTMLTableSectionElement) {
        let slices = line.ref.name.split(" - ");
        let title = slices.pop();
        await this.insertTrackLine(title, line.ref.uri, body, ["historyLine"]);
    }

    private async insertTrackLine(title: string, uri: string, body: HTMLTableSectionElement, classes: string[] = [], tlid?: number) {
        let tr = document.createElement("tr");
        body.appendChild(tr);
        tr.classList.add("trackLine", ...classes);
        tr.dataset.uri = uri;
        if(tlid)
            tr.dataset.tlid = tlid.toString();
        this.setTrackLineContent(tr, title);
        body.insertAdjacentHTML('beforeend', `
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);

        //delayed update of track info.
        const track = await getState().getController().lookupTrackCached(uri);
        this.updateTrackLineFromLookup(tr, track, title);
    }

    private updateTrackLineFromLookup(tr: HTMLTableRowElement, track: (FileTrackModel | StreamTrackModel), title: string) {
        let artist =  "⚬⚬⚬";
        let album =  "⚬⚬⚬";
        switch (track.type) {
            case ItemType.File:
                title = track.title;
                artist = track.track.artists[0].name; //todo: add other names?
                album = track.track.album.name;
                break;
            case ItemType.Stream:
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
