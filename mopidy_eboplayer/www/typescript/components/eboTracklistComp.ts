import {EboComponent} from "./EboComponent";
import models from "../../js/mopidy";
import TlTrack = models.TlTrack;
import {property, template} from "./placeholders";

export class EboTracklistComp extends EboComponent {
    static override readonly tagName=  "ebo-tracklist-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

    @property() tracklist: TlTrack[] = [];

    static styleText= `
        <style>
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = template`
        <div id="wrapper">
            <table id="tracklist">
                <tbody></tbody>
            </table>
        </div>        
        `;

    constructor() {
        super(EboTracklistComp.styleText, EboTracklistComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
    }

    override update(shadow:ShadowRoot) {
        let tBody = shadow.querySelector("tbody") as HTMLTableSectionElement;
        tBody.innerHTML = "";

        for(let track of this.tracklist) {
            this.insertTrackLine(track.track.name??"--no name--", track.track.uri, tBody, [], track.tlid);
        }
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
}
