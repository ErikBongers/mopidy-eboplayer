import {EboComponent} from "./EboComponent";
import {console_yellow} from "../gui";
import {AlbumData, AlbumDataType, AlbumNone} from "../views/bigTrackViewUriAdapter";

export class EboAlbumTracksView extends EboComponent {
    get albumInfo(): AlbumData {
        return this._albumInfo;
    }

    set albumInfo(value: AlbumData) {
        this._albumInfo = value;
        this.render();
    }
    static readonly tagName=  "ebo-album-tracks-view";
    private shadow: ShadowRoot;
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "img",
    ];
    private img: string  = "images/default_cover.png";
    private styleTemplate: HTMLTemplateElement;
    private divTemplate: HTMLTemplateElement;
    private albumClickEvent: CustomEvent<unknown>;
    private _albumInfo: AlbumData;


    constructor() {
        super();
        this.albumInfo = AlbumNone;
        this.styleTemplate = document.createElement("template");
        // noinspection CssUnresolvedCustomProperty
        this.styleTemplate.innerHTML = `
            <style>
                :host { 
                    display: flex;
                } 
                h3 {
                    margin-block-start: .5em;
                    margin-block-end: .5em;
                }
                img {
                    width: 100px;
                    height: 100px;
                    object-fit: contain;
                }
                .selectable {
                    -webkit-user-select: text;
                    -moz-user-select: text;
                    -ms-user-select: text;
                    -o-user-select: text;
                    user-select: text;
                }
                #wrapper {
                    display: flex;
                    flex-direction: row;
                    height: 100%;
                    width: 100%;
                }
                .info {
                    font-size: .7em;
                }
            </style>
        `;
        this.divTemplate = document.createElement("template");
        this.divTemplate.innerHTML = `
            <div id="wrapper">
                <div id="albumInfo">
                    <img src="" id="img" alt="">
                    <div>
                        TODO: The album title and stuff.....                    
                    </div>
                </div>\
                <table id="tracksTable">
                    <tbody>
                    </tbody>                
                </table>
            </div>        
        `;
        this.shadow = this.attachShadow({mode: "open"});

        this.render();
        this.albumClickEvent = new CustomEvent("XXXalbumClick", {
            bubbles: true,
            cancelable: false,
            composed: true, //needed to 'break' out of the shadow.
            detail: "todo"
        });
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
                this[name] = newValue;
                break;
        }
        this.render();
        }

    // noinspection JSUnusedGlobalSymbols
    connectedCallback() {
    }

    render() {
        if(!this.shadow)
            return;
        this.shadow.innerHTML="";
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        this.shadow.appendChild(this.divTemplate.content.cloneNode(true));
        let img = this.shadow.getElementById("img") as HTMLImageElement;
        img.src = this.img;
        this.renderTrackList();
    }

    renderTrackList() {
        let tbody = (this.shadow.getElementById("tracksTable") as HTMLTableElement).tBodies[0];
        tbody.innerHTML  = "";
        if(this.albumInfo?.type ==  AlbumDataType.Loaded) {
            this.albumInfo.tracks.forEach(track => {
                let tr = tbody.appendChild(document.createElement("tr"));
                let td = tr.appendChild(document.createElement("td"));
                td.innerText = track.name;
            });
        }
    }

}