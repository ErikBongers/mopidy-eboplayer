import {EboComponent} from "./EboComponent";
import {GuiSource} from "../events";
import {AllUris} from "../modelTypes";
import {id} from "rolldown/filter";

export type ListButtonState = "show" | "hide" | "disabled";
export type ListButtonStates = {
    add: ListButtonState;
    play: ListButtonState;
    edit: ListButtonState;
    replace: ListButtonState;
    save: ListButtonState;
    new_playlist: ListButtonState;
}
export type ListButtonName = keyof ListButtonStates;

export class EboListButtonBar extends EboComponent {
    get btn_states(): ListButtonStates {
        return this._btn_states;
    }

    set btn_states(value: ListButtonStates) {
        this._btn_states = value;
        this.requestUpdate();
    }
    static override readonly tagName=  "ebo-list-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["list_source", "uri"];
    private _btn_states: ListButtonStates = {
        add: "hide",
        play: "hide",
        edit: "hide",
        replace: "hide",
        save: "hide",
        new_playlist: "hide"
    };
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
            if(this.btn_states.play != "show") return;
            this.dispatchEboEvent("playItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnAdd", "click", (ev) => {
            if(this.btn_states.add != "show") return;
            this.dispatchEboEvent("addItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnReplace", "click", (ev) => {
            if(this.btn_states.replace != "show") return;
            this.dispatchEboEvent("replaceItemListClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnEdit", "click", (ev) => {
            if(this.btn_states.edit != "show") return;
            this.dispatchEboEvent("editClicked.eboplayer", {source: this.list_source});
        });
        this.addShadowEventListener("btnSave", "click", (ev) => {
            if(this.btn_states.save != "show") return;
            this.dispatchEboEvent("saveClicked.eboplayer", {source: this.list_source, uri: this.uri as AllUris});
        });
        this.addShadowEventListener("btnNewPlaylist", "click", (ev) => {
            if(this.btn_states.new_playlist != "show") return;
            this.dispatchEboEvent("newPlaylistClicked.eboplayer", {source: this.list_source});
        });
        this.requestUpdate();
    }

    updateButtonState(name: ListButtonName, newValue: string) {
        this.btn_states[name] = newValue as ListButtonState;
    }

    override update(shadow: ShadowRoot) {
        this.updateButtonVisibility("btnPlay", this._btn_states.play);
        this.updateButtonVisibility("btnAdd", this._btn_states.add);
        this.updateButtonVisibility("btnReplace", this._btn_states.replace);
        this.updateButtonVisibility("btnEdit", this._btn_states.edit);
        this.updateButtonVisibility("btnSave", this._btn_states.save);
        this.updateButtonVisibility("btnNewPlaylist", this._btn_states.new_playlist);
    }

    private updateButtonVisibility(id: string, state: ListButtonState) {
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