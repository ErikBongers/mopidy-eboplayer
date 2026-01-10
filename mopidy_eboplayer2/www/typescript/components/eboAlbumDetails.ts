import {EboComponent} from "./EboComponent";
import {MouseTimer} from "../MouseTimer";
import {ExpandedAlbumModel} from "../modelTypes";

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
            img {
                width: 2rem;
                height: 2rem;
                object-fit: contain;
            }
        </style>
    `;

    static htmlText = `
        <div>
            <img id="image" src="" alt="Album image">
            <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dicta doloribus ducimus earum incidunt ipsam itaque maiores, molestias, nesciunt numquam optio perspiciatis possimus, quae quas recusandae repellendus saepe tempora tenetur totam.</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dicta doloribus ducimus earum incidunt ipsam itaque maiores, molestias, nesciunt numquam optio perspiciatis possimus, quae quas recusandae repellendus saepe tempora tenetur totam.</p>
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

    render(shadow:ShadowRoot) { //todo: make override method instead of abstract (and thus required)
        let imageTag = shadow.getElementById("image") as HTMLImageElement;
        imageTag.addEventListener("click", (ev) => {
            this.dispatchEboEvent("detailsAlbumImgClicked.eboplayer", {});
        })
    }

    override update(shadow: ShadowRoot) {
        if(this.albumInfo) {
            let imgTag = shadow.getElementById("image") as HTMLImageElement;
            imgTag.src = this.albumInfo.album.imageUrl;
        }
    }
}

