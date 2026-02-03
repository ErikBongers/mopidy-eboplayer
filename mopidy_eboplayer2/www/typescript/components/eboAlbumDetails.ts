import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {AlbumUri, ExpandedAlbumModel} from "../modelTypes";

export class EboAlbumDetails extends EboComponent {
    get albumInfo(): ExpandedAlbumModel | null {
        return this._albumInfo;
    }

    set albumInfo(value: ExpandedAlbumModel | null) {
        this._albumInfo = value;
        this.requestUpdate();
    }
    static override readonly tagName=  "ebo-album-details";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];
    private _albumInfo: ExpandedAlbumModel | null = null;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            * {
                font-size: .8rem;
            }
            #header {
                margin-bottom: .5rem;
            }
            #albumName {
                font-size: 1rem;
            }
            img {
                width: 2.1rem;
                height: 2.1rem;
                object-fit: contain;
                margin-right: .5rem;
            }
            label {
                margin-right: 1rem;
            }
            .replaced {
                opacity: .5;
                text-decoration: line-through;
            }
        </style>
    `;

    static htmlText = `
        <div>
            <div id="header" class="flexRow">
                <img id="bigImage" src="" alt="Album image">
                <span id="albumName" class="selectable"></span>
            </div>
            <div id="tableContainer" class="flexColumn">
                <table>
                    <tbody></tbody>                
                </table>
                <button id="btnUpdateAlbumData" class="roundBorder">Update album data</button>
                <button id="btnSearchImage" class="roundBorder">Search image</button>
            </div>        
        </div>
        `;

    constructor() {
        super(EboAlbumDetails.styleText, EboAlbumDetails.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        // switch (name) {
        //     case "img":
        //         this[name] = newValue;
        //         break;
        //     case "pressed":
        //     case "disabled":
        //         this.updateBoolProperty(name, newValue);
        //         break;
        // }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        let imageTag = shadow.getElementById("bigImage") as HTMLImageElement;
        imageTag.addEventListener("click", (ev) => {
            this.dispatchEboEvent("detailsAlbumImgClicked.eboplayer", {});
        });
        let btnUpdateAlbumData = shadow.getElementById("btnUpdateAlbumData");
        btnUpdateAlbumData?.addEventListener("click", () => {
            this.dispatchEboEvent("updateAlbumData.eboplayer", {"uri": (this._albumInfo?.album?.ref.uri??"--nu album uri--") as AlbumUri});
        });
        let btnSearchImage = shadow.getElementById("btnSearchImage");
        btnSearchImage?.addEventListener("click", () => {
            let albumName = this.albumInfo?.album?.albumInfo?.name;
            if(!albumName)
                return;

            window.open("https://www.google.com/search?tbm=isch&q="+albumName.replaceAll(" ", "+"), '_blank')?.focus();
        });
    }

    override async update(shadow: ShadowRoot) {
        if(this.albumInfo) {
            let albumName = shadow.getElementById("albumName") as HTMLElement;
            albumName.innerHTML = this.albumInfo.album?.albumInfo?.name?? "--no name--";
            let imgTag = shadow.getElementById("bigImage") as HTMLImageElement;
            imgTag.src = this.albumInfo.bigImageUrl;

            let table = shadow.querySelector("#tableContainer > table") as HTMLTableElement;
            let body = table.tBodies[0];
            body.innerHTML = "";
            this.addMetaDataRow(body, "Year:", this.albumInfo.album.albumInfo?.date?? "--no date--");
            this.addMetaDataRow(body, "Artists:", (await this.albumInfo.getArtists()).map(artist => artist.name).join(", "));
            this.addMetaDataRow(body, "Composers:", (await this.albumInfo.getComposers()).map(artist => artist.name).join(","))
            let genreDefs = await this.albumInfo.getGenres();
            let genresHtml = "";
            genreDefs.forEach(def => {
                let defHtml = "";
                if(def.replacement)
                    defHtml += `<span class="replaced">${def.ref.name}</span> &gt; ${def.replacement}`;
                genresHtml += defHtml;
            });
            this.addMetaDataRow(body, "Genres", genresHtml);
            this.addMetaDataRow(body, "Playlists", "todo...");
        }
    }

    private addMetaDataRow(body: HTMLTableSectionElement, colText1: string, colText2: string) {
        let tr = body.appendChild(document.createElement("tr"));
        let td1 = tr.appendChild(document.createElement("td"));
        td1.innerHTML = colText1;
        let td2 = tr.appendChild(document.createElement("td"));
        td2.innerHTML = colText2;
        td2.classList.add("selectable");
    }
}

