import getState from "../playerState";
import {EboplayerEvents, HistoryLine, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {transformTrackDataToModel} from "../controller";
import {models} from "../../mopidy_eboplayer2/static/js/mopidy";
import Track = models.Track;

export class HistoryView extends View {
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
            this.onHistoryChangegd().then(r => {});
        });
    }


    private async onHistoryChangegd() {
        let history = getState().getModel().getHistory();
        let historyTable = document.getElementById("historyTable") as HTMLTableElement;
        let body = historyTable.tBodies[0];
        body.innerHTML = "";
        for(let line of history) {
            this.insertTrackLine(line, body);
        }

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("click", async ev => {
                await getState().getController().playTrack(tr.dataset.uri);
            })
        });
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
        getState().getController().lookupCached(line.ref.uri).then(tracks => {
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
        return [];
    }
}
