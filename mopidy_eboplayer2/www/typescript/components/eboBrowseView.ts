import {EboComponent} from "./EboComponent";
import {AlbumData, AlbumNone} from "../views/bigTrackViewUriAdapter";
import {EboAlbumTracksView} from "./eboAlbumTracksView";

export class EboBrowseView extends EboComponent {
    static readonly tagName=  "ebo-browse-view";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [];

    static styleText= `
            <style>
                :host { 
                    display: flex;
                } 
                #wrapper {
                    display: flex;
                    flex-direction: row;
                }
                .filterButton {
                    width: 2em;
                    height: 2em;
                    object-fit: contain;
                    margin-right: .5em;
                }
            </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
            <div id="wrapper">
                <button><img src="images/icons/Album.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button><img src="images/icons/Track.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button><img src="images/icons/Radio.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button><img src="images/icons/Artist.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button><img src="images/icons/Playlist.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button><img src="images/icons/Genre.svg" alt="" class="filterButton whiteIconFilter"></button>
                <button> X </button>
            </div>        
        `;

    constructor() {
        super(EboBrowseView.styleText, EboBrowseView.htmlText);
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "name":
            case "stream_lines":
            case "extra":
            case "img":
                this[name] = newValue;
                break;
            case "enabled":
            case "show_back":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
    }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.shadow.appendChild(fragment);
        //todo: put the above in EboComponent?
    }
}