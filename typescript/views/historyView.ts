import getState from "../playerState";
import {EboplayerEvents, TrackType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {transformTrackDataToModel} from "../controller";

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
            let title = line.ref.name;
            let artist = "";
            let album = "";
            let tracks = await getState().getController().lookupCached(line.ref.uri);
            if(tracks) {
                let track = transformTrackDataToModel(tracks[0]);
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
            }

            body.insertAdjacentHTML('afterbegin', `
<tr class="trackLine" data-uri="${line.ref.uri}">
    <td>
        <h1>${title}</h1>
        <small>${artist} • ${album}</small>
    </td>
    <td>
        <button><i class="fa fa fa-ellipsis-v"></i></button>
    </td>
</tr>
<tr>
    <td colspan="2">
        <div class="progressBar"></div>
    </td>
</tr>
            `);
        }

        body.querySelectorAll("tr").forEach(tr => {
            tr.addEventListener("click", async ev => {
                await getState().getController().playTrack(tr.dataset.uri);
            })
        });
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}
