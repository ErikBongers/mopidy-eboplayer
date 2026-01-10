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
            label {
                margin-right: 1rem;
            }
        </style>
    `;

    static htmlText = `
        <div>
            <img id="image" src="" alt="Album image">
            <div class="flexColumn">
                <div class="flexRow"><label>Artists</label> <span id="artists"></span></div>
                <div class="flexRow"><label>Composers</label> <span id="composers"></span></div>
                <div class="flexRow"><label>Genres</label> <span id="genres"></span></div>
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
            let artists = shadow.getElementById("artists") as HTMLElement;
            artists.textContent = this.albumInfo.artists.map(artist => artist.name).join(", ");
            let composers = shadow.getElementById("composers") as HTMLElement;
            composers.textContent = this.albumInfo.composers.map(artist => artist.name).join(", ");
            let genres = shadow.getElementById("genres") as HTMLElement;
            genres.textContent = this.albumInfo.genres.join(", ");
        }
    }
}

