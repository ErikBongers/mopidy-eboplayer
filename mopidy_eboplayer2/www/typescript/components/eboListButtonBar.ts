import {EboComponent} from "./EboComponent";
import {GuiSource} from "../events";
import {AllUris} from "../modelTypes";

export type ListButtonState = "show" | "hide" | "disabled";
export type ListButtonName = "add" | "play" | "edit" | "replace" | "save" | "new_playlist";

export class EboListButtonBar extends EboComponent {
    static override readonly tagName=  "ebo-list-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = [
        "add_btn_state",
        "play_btn_state",
        "edit_btn_state",
        "replace_btn_state",
        "save_btn_state",
        "new_playlist_btn_state",
        "list_source", "uri"
    ];
    add_btn_state: ListButtonState = "hide";
    play_btn_state: ListButtonState = "hide";
    edit_btn_state: ListButtonState = "hide";
    save_btn_state: ListButtonState = "hide";
    replace_btn_state: ListButtonState = "hide";
    new_playlist_btn_state: ListButtonState = "hide";
    list_source: GuiSource;
    uri: string;
    static styleText = `
        <style>
            #buttons {
                display: flex;
                flex-direction: row;
                margin-bottom: .5em;
                button.disabled {
                    opacity: 0.2;
                }
                img {
                    height: 1.2rem;
                }
            }
        </style>
    `;
    static htmlText = `
        <div id="buttons">
            <button id="btnPlay" class="roundBorder"><i class="fa fa-play"></i></button>
            <button id="btnAdd" class="roundBorder"><i class="fa fa-plus"></i></button>
            <button id="btnReplace" class="roundBorder">Replace</button>
            <button id="btnEdit" class="roundBorder"><i class="fa fa-pencil"></i></button>
            <button id="btnSave" class="roundBorder">
                <div class="flexRow">
                    >            
                    <img id="image" src="images/icons/Playlist.svg" alt="New playlist" class="whiteIcon">
                </div>            
            </button>
            <button id="btnNewPlaylist" class="roundBorder">
                <div class="flexRow">
                    <img id="image" src="images/icons/Playlist.svg" alt="New playlist" class="whiteIcon">
                    *            
                </div>            
            </button>
        </div>                   
    `;

    constructor() {
        super(EboListButtonBar.styleText, EboListButtonBar.htmlText);
    }

    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "add_btn_state":
            case "play_btn_state":
            case "edit_btn_state":
            case "replace_btn_state":
            case "save_btn_state":
            case "new_playlist_btn_state":
                this.updateButtonStateProperty(name, newValue);
                break;
            case "list_source":
                this.list_source = newValue as GuiSource;
                break;
            case "uri":
                this[name] = newValue;
                break;
        }
        this.requestUpdate();
        }

    render(shadow:ShadowRoot) {
        this.addShadowEventListener("btnPlay", "click", (ev) => {
            if(this.play_btn_state != "show") return;
            this.dispatchEboEvent("playItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            if(this.add_btn_state != "show") return;
            this.dispatchEboEvent("addItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnReplace", "click", (ev) => {
            if(this.replace_btn_state != "show") return;
            this.dispatchEboEvent("replaceItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnEdit", "click", (ev) => {
            if(this.edit_btn_state != "show") return;
            this.dispatchEboEvent("editClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnSave", "click", (ev) => {
            if(this.save_btn_state != "show") return;
            this.dispatchEboEvent("saveClicked.eboplayer", {source: this.list_source, uri: this.uri as AllUris});
        });
        this.addShadowEventListener("btnNewPlaylist", "click", (ev) => {
            if(this.new_playlist_btn_state != "show") return;
            this.dispatchEboEvent("newPlaylistClicked.eboplayer", {source: this.list_source});
        });
        this.requestUpdate();
    }

    private updateButtonStateProperty(name: string, newValue: string) {
        this.updateStringProperty(name, newValue);
    }

    override update(shadow: ShadowRoot) {
        this.updateButtonState("btnPlay", this.play_btn_state);
        this.updateButtonState("btnAdd", this.add_btn_state);
        this.updateButtonState("btnReplace", this.replace_btn_state);
        this.updateButtonState("btnEdit", this.edit_btn_state);
        this.updateButtonState("btnSave", this.save_btn_state);
        this.updateButtonState("btnNewPlaylist", this.new_playlist_btn_state);
    }

    private updateButtonState(id: string, state: ListButtonState) {
        let btn = this.shadow.getElementById(id) as HTMLButtonElement;
        switch (state) {
            case "show": btn.style.display = ""; break;
            case "hide": btn.style.display = "none"; break;
            case "disabled":
                btn.disabled = true;
                btn.classList.add("disabled");
                break;
            default:
                break;//no state specified: ignore
        }
    }
}