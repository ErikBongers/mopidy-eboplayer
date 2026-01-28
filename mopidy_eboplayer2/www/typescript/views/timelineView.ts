import getState from "../playerState";
import {View} from "./view";
import {TlId} from "../../js/mopidy";
import {EboPlayerDataType, FileTrackModel, HistoryLineDef, StreamTrackModel, TrackModel, TrackUri} from "../modelTypes";

export class TimelineView extends View {
    private clickedRow: HTMLTableRowElement;
    bind() {
        getState().getModel().addEboEventListener("historyChanged.eboplayer", () => {
            this.rebuildTimeline().then(r => {});
        });
        getState().getModel().addEboEventListener("trackListChanged.eboplayer", () => {
            this.rebuildTimeline().then(r => {});
        });
        getState().getModel().addEboEventListener("currentTrackChanged.eboplayer", () => {
            this.onCurrentTrackChanged();
        });
        getState().getModel().addEboEventListener("selectedTrackChanged.eboplayer", () => {
            this.onSelectedTrackChanged();
        });
    }


    private async rebuildTimeline() {
        let history = getState().getModel().getHistory() ?? [];
        let trackList = getState().getModel().getTrackList() ?? [];

        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let body = timelineTable.tBodies[0];
        body.innerHTML = "";

        if(history.length > 0 && trackList.length > 0 && history[0].uri == trackList[0].track.uri)
            history.shift(); //remove most recent history line if it's the first track in the playlist.

        // if we want to limit the number of history lines we can do so here.
        // history = history.slice(0, 50);

        //reverse order as we want the most recent tracks to at the bottom.
        for(let i = history.length - 1; i >= 0; i-- ) {
            this.insertHistoryLine(history[i], body);
        }

        for(let track of trackList) {
            this.insertTrackLine(track.track.name??"--no name--", track.track.uri, body, [], track.tlid);
        }

        let uris = trackList.map(tl => tl.track.uri) as TrackUri[];
        uris = [...new Set(uris)];
        await this.lookupAllTracksAndUpdateRows(uris);

        await this.setCurrentTrack();

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev)});
            tr.addEventListener("click", ev => {this.onRowClicked(ev)});
        });
    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        this.setRowsClass(row, ["clicked"]);

        getState().getController().setSelectedTrack(row.dataset.uri as TrackUri);
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        this.clickedRow = ev.currentTarget as HTMLTableRowElement;
        if(this.clickedRow.dataset.tlid)
            await getState().getPlayer().play(parseInt(this.clickedRow.dataset.tlid) as TlId);
        else
            await getState().getPlayer().clearAndPlay([this.clickedRow.dataset.uri as TrackUri]);
    }

    private setRowsClass(rowOrSelector: HTMLTableRowElement | string, classes: string[]) {
        (document
            .getElementById("timelineTable") as HTMLTableElement)
            .querySelectorAll(`tr`)
            .forEach(tr =>
                tr.classList.remove(...classes)
            );
        if(rowOrSelector instanceof HTMLTableRowElement)
            rowOrSelector.classList.add(...classes);
        else {
            (document
                .getElementById("timelineTable") as HTMLTableElement)
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
        let focusTrack = await getState().getController().lookupTrackCached(getState().getModel().getCurrentTrack());
        if(!focusTrack) {
            focusTrack = await getState().getController().lookupTrackCached(getState().getModel().getSelectedTrack());
            if(!focusTrack)
                return;
        }
        let currentUri = focusTrack.track.uri;
        let trs = [...timelineTable.querySelectorAll(`tr[data-uri="${currentUri}"]`)];
        if(trs.length == 0)
            return;
        let tr = trs[trs.length - 1];
        if(this.clickedRow?.dataset?.uri != focusTrack.track.uri)
            tr.scrollIntoView( { block: "nearest" });
        timelineTable.querySelectorAll("tr").forEach(tr  => tr.classList.remove("current", "textGlow"));
        tr.classList.add("current", "textGlow");
    }

    private insertHistoryLine(line: HistoryLineDef, body: HTMLTableSectionElement) {
        this.insertTrackLine(line.name, line.uri, body, ["historyLine"], undefined, line.album, line.artist);
    }

    private insertTrackLine(title: string, uri: string, body: HTMLTableSectionElement, classes: string[] = [], tlid?: number, album?: string, artist?: string) {
        let tr = document.createElement("tr");
        body.appendChild(tr);
        tr.classList.add("trackLine", ...classes);
        if(!uri.startsWith("eboback"))
            tr.classList.add("italic");
        tr.dataset.uri = uri;
        if(tlid)
            tr.dataset.tlid = tlid.toString();
        this.setTrackLineContent(tr, title, artist, album);
        body.insertAdjacentHTML('beforeend', `
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);

    }

    async lookupAllTracksAndUpdateRows(uris: TrackUri[]) {
        await getState().getController().lookupAllTracks(uris);
        for (const uri of uris) {
            const track = await getState().getController().lookupTrackCached(uri);
            if(!track) continue;
            let trs = document.querySelectorAll(`tr[data-uri="${uri}"]`) as NodeListOf<HTMLTableRowElement>;
            trs.forEach(tr => this.updateTrackLineFromLookup(tr, track));
        }
    }

    private updateTrackLineFromLookup(tr: HTMLTableRowElement, track: (FileTrackModel | StreamTrackModel)) {
        let artist =  "⚬⚬⚬";
        let album =  "⚬⚬⚬";
        let title: string;
        switch (track.type) {
            case "file":
                title = track.title;
                if (track.track.artists)
                    artist = track.track.artists[0].name;
                if (track.track.album)
                    album = track.track.album.name;
                break;
            case "stream":
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
