import {EboComponent} from "./EboComponent";
import {AlbumUri, ArtistUri, ExpandedAlbumModel} from "../modelTypes";
import {console_yellow, searchImageOnGoogle} from "../global";

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
                <div style="border-block-start: solid 1px rgba(255,255,255,.5); margin-block-start:.5rem; padding-block-start: .5rem;">
                    <div class="flexRow">
                        <button id="btnUpdateAlbumData" class="roundBorder iconButton"><i class="fa fa-refresh"></i></button>
                        <button id="btnSearchImage" 
                            class="roundBorder" 
                            style="padding-inline-start: .7rem;">
                            <img src="images/icons/Google_Favicon_2025.svg" 
                                alt="Search" 
                                style="height: .9rem; width: .9rem; position: relative; top: .15rem;margin-right: .1rem;">
                            Image
                        </button>
                    </div>
                    <label style="display: block; margin-block-start: .3rem; margin-block-end: .1rem;">Upload an album image:</label>
                    <div class="flexRow">
                        <input id="imageUrl" type="text" class="flexGrow">
                        <button id="btnUploadImage" style="margin-inline-start: .3rem;"><i class="fa fa-upload"></i></button>
                    </div>
                </div>            
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

            searchImageOnGoogle(albumName);
        });
        let btnUploadImage = shadow.getElementById("btnUploadImage");
        btnUploadImage?.addEventListener("click", () => {
            this.dispatchEboEvent("uploadAlbumImageClicked.eboplayer", {"albumUri": this.albumInfo?.album.ref.uri as AlbumUri, "imageUrl": (shadow.getElementById("imageUrl") as HTMLInputElement).value.trim()})
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

            let {artists, composers, genreDefs} = await this.albumInfo.getAllDetails();
            console_yellow(`Artists: ${artists.map(artist => artist.name).join(",")}`);
            //do the `await`s first before clearing and filling, to avoid data races! (double lines)
            body.innerHTML = "";
            this.addMetaDataRow(body, "Year:", this.albumInfo.album.albumInfo?.date?? "--no date--");
            this.addMetaDataRow(body, "Artists:", artists.map(artist => {
                console_yellow(`Adding button for artist: ${artist.name}`)
                return ` 
                    <button class="linkButton" data-uri="${artist.uri}">${artist.name}</button>
                `
            }).join(" "));
            this.addMetaDataRow(body, "Composers:", composers.map(artist => artist.name).join(","));
            let genresHtml = "";
            genreDefs.forEach(def => {
                let defHtml = "";
                if(def.replacement)
                    defHtml += `<span class="replaced">${def.ref.name}</span> &gt; ${def.replacement}`;
                else
                    defHtml += def.ref.name;
                genresHtml += defHtml;
            });
            genresHtml += `<i id="btnEditGenre" class="fa fa-pencil miniEdit"></i>`;
            this.addMetaDataRow(body, "Genre", genresHtml);
            this.addMetaDataRow(body, "Playlists", "todo...");
            body.querySelectorAll(".linkButton").forEach((link: HTMLElement) => {
                link.addEventListener("click", (ev) => {
                    this.dispatchEboEvent("browseToArtist.eboplayer", {"name": (ev.target as HTMLElement).textContent, "type": "artist", "uri": link.dataset.uri as ArtistUri});
                });
            });
            let genreEdit = shadow.querySelector("#btnEditGenre") as HTMLElement;
            genreEdit.addEventListener("click", (ev) => {
                this.dispatchEboEvent("albumGenreEditRequested.eboplayer", {"uri": this.albumInfo?.album?.ref.uri as AlbumUri});
            });
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

