import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";
import {console_yellow} from "../gui";
import {numberedDictToArray} from "../controller";
import {models} from "../../mopidy_eboplayer2/static/js/mopidy";

export class HistoryView extends View {
    bind() {
        getState().getModel().addEventListener(EboplayerEvents.historyChanged, () => {
            this.onHistoryChangegd();
        });
    }


    private onHistoryChangegd() {
        let history = getState().getModel().getHistory();
        let historyTable = document.getElementById("historyTable") as HTMLTableElement;
        let body = historyTable.tBodies[0];
        body.innerHTML = "";
        for(let line of history) {
            body.insertAdjacentHTML('afterbegin', `
<tr data-uri="${line.ref.uri}">
    <td>${line.ref.name}</td>
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
                await getState().commands.core.tracklist.clear();
                let tracks = await getState().commands.core.tracklist.add(null, null, [tr.dataset.uri]);
                let trackList = numberedDictToArray(tracks) as models.TlTrack[];
                getState().getController().setTracklist(trackList);
                getState().commands.core.playback.play(null, trackList[0].tlid);
                await getState().getController().setCurrentTrackAndFetchDetails(trackList[0]);
            })
        });
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}