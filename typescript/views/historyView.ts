import getState from "../playerState";
import {EboplayerEvents, MessageType} from "../model";
import {EboPlayerDataType, View} from "./view";

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
<tr>
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
    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}