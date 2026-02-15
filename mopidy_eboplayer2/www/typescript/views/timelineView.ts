import {View} from "./view";
import {TlId} from "../../js/mopidy";
import {HistoryLineDef, TrackUri} from "../modelTypes";
import {State} from "../playerState";

export class TimelineView extends View {
    private clickedRow: HTMLTableRowElement;

    constructor(state: State) {
        super(state);
    }

    bind() {
        this.state.getModel().addEboEventListener("historyChanged.eboplayer", () => {
            this.rebuildTimeline().then(r => {});
        });
        this.state.getModel().addEboEventListener("trackListChanged.eboplayer", () => {
            this.rebuildTimeline().then(r => {});
        });
        this.state.getModel().addEboEventListener("currentTrackChanged.eboplayer", () => {
            this.onCurrentTrackChanged();
        });
        this.state.getModel().addEboEventListener("selectedTrackChanged.eboplayer", () => {
            this.onSelectedTrackChanged();
        });
    }


    private async rebuildTimeline() {
        let history = this.state.getModel().getHistory() ?? [];
        let trackList = this.state.getModel().getTrackList() ?? [];

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

        await this.setCurrentTrack();

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("dblclick", ev => {this.onRowDoubleClicked(ev)});
            tr.addEventListener("click", ev => {this.onRowClicked(ev)});
        });
    }

    private onRowClicked(ev: MouseEvent) {
        let row = ev.currentTarget as HTMLTableRowElement;
        this.setRowsClass(row, ["clicked"]);

        this.state.getController().setSelectedTrack(row.dataset.uri as TrackUri);
    }

    private async onRowDoubleClicked(ev: MouseEvent) {
        this.clickedRow = ev.currentTarget as HTMLTableRowElement;
        if(this.clickedRow.dataset.tlid)
            await this.state.getPlayer().play(parseInt(this.clickedRow.dataset.tlid) as TlId);
        else
            await this.state.getPlayer().clearAndPlay([this.clickedRow.dataset.uri as TrackUri]);
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
        let selectedTrackUri = this.state.getModel().getSelectedTrack();
        this.setRowsClass(`tr[data-uri="${selectedTrackUri}"]`, ["selected"]);
    }

    private async setCurrentTrack() {
        let timelineTable = document.getElementById("timelineTable") as HTMLTableElement;
        let focusTrack = await this.state.getController().cache.lookupTrackCached(this.state.getModel().getCurrentTrack());
        if(!focusTrack) {
            focusTrack = await this.state.getController().cache.lookupTrackCached(this.state.getModel().getSelectedTrack());
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

    private setTrackLineContent(tr: HTMLTableRowElement, title: string, artist: string = "⚬⚬⚬", album: string = "⚬⚬⚬") {
        let artistStr = artist??"⚬⚬⚬";
        let albumStr = album??"⚬⚬⚬";
        tr.innerHTML = `
    <td>
        <h1>${title}</h1>
        <small>${artistStr} • ${albumStr}</small>
    </td>
    <td>
        <button><i class="fa fa fa-ellipsis-v"></i></button>
    </td>
            `;
    }

    private onCurrentTrackChanged() {
        this.setCurrentTrack();
    }

    private onSelectedTrackChanged() {
        this.setSelectedTrack();
    }

}
