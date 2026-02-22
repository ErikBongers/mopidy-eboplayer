import {EboComponent} from "../EboComponent";
import {ExpandedStreamModel} from "../../modelTypes";
import {searchImageOnGoogle} from "../../global";
import {addMetaDataRow} from "../album/eboAlbumDetails";

export class EboRadioDetails extends EboComponent {
    static override readonly tagName=  "ebo-radio-details";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

    get streamInfo(): ExpandedStreamModel | null {
        return this._streamInfo;
    }
    set streamInfo(value: ExpandedStreamModel | null) {
        this._streamInfo = value;
        this.requestUpdate();
    }
    private _streamInfo: ExpandedStreamModel | null = null;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            * {
                font-size: .8rem;
            }
            #header {
                margin-bottom: .5rem;
            }
            #streamName {
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
                <img id="smallImage" src="" alt="Radio image">
                <span id="streamName" class="selectable"></span>
            </div>
            <div id="tableContainer" class="flexColumn">
                <table>
                    <tbody></tbody>                
                </table>
                <div style="border-block-start: solid 1px rgba(255,255,255,.5); margin-block-start:.5rem; padding-block-start: .5rem;">
                    <div class="flexRow">
                        <button id="btnSearchImage" 
                            class="roundBorder" 
                            style="padding-inline-start: .7rem;">
                            <img src="../../../images/icons/Google_Favicon_2025.svg" 
                                alt="Search" 
                                style="height: .9rem; width: .9rem; position: relative; top: .15rem;margin-right: .1rem;">
                            Image
                        </button>
                    </div>
                    <label style="display: block; margin-block-start: .3rem; margin-block-end: .1rem;">Upload an cover image:</label>
                    <div class="flexRow">
                        <input id="imageUrl" type="text" class="flexGrow">
                        <button id="btnUploadImage" style="margin-inline-start: .3rem;"><i class="fa fa-upload"></i></button>
                    </div>
                </div>            
            </div>        
        </div>
        `;

    constructor() {
        super(EboRadioDetails.styleText, EboRadioDetails.htmlText);
    }

    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestUpdate();
    }

    override render(shadow:ShadowRoot) {
        let imageTag = shadow.getElementById("smallImage") as HTMLImageElement;
        imageTag.addEventListener("click", (ev) => {
            this.dispatchEboEvent("detailsRadioImgClicked.eboplayer", {});
        });
        let btnSearchImage = shadow.getElementById("btnSearchImage");
        btnSearchImage?.addEventListener("click", () => {
            let streamName = this.streamInfo?.stream.name;
            if(!streamName)
                return;

            searchImageOnGoogle("radio " + streamName);
        });
        let btnUploadImage = shadow.getElementById("btnUploadImage");
        btnUploadImage?.addEventListener("click", () => {
            //todo
            // this.dispatchEboEvent("uploadAlbumImageClicked.eboplayer", {"albumUri": this.streamInfo?.album.ref.uri as AlbumUri, "imageUrl": (shadow.getElementById("imageUrl") as HTMLInputElement).value.trim()})
        });
    }

    override async update(shadow: ShadowRoot) {
        if(this.streamInfo) {
            let streamName = shadow.getElementById("streamName") as HTMLElement;
            streamName.innerHTML = this.streamInfo.stream.name?? "--no name--";
            let imgTag = shadow.getElementById("smallImage") as HTMLImageElement;
            imgTag.src = this.streamInfo.bigImageUrl;

            let table = shadow.querySelector("#tableContainer > table") as HTMLTableElement;
            let body = table.tBodies[0];

            body.innerHTML = "";
            addMetaDataRow(body, "More info?:", "dunno...");
            addMetaDataRow(body, "Genre", "todo...");
            addMetaDataRow(body, "Playlists", "todo...");
        }
    }
}

