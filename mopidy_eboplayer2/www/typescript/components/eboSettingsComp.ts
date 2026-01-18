import {EboComponent} from "./EboComponent";
import {AllUris, BreadCrumbBrowseFilter, BreadCrumbHome, BreadCrumbRef, BrowseFilter, FilterBreadCrumb, GenreDef} from "../modelTypes";
import {EmptySearchResults, RefType, SearchResult, SearchResults} from "../refs";
import {GuiSource} from "../events";
import {console_yellow, unreachable} from "../global";
import {EboListButtonBar, ListButtonState_AllHidden, ListButtonStates} from "./eboListButtonBar";
import {EboBrowseFilterComp} from "./eboBrowseFilterComp";
import {EboButton} from "./eboButton";
import getState from "../playerState";

export class EboSettingsComp extends EboComponent {
    static override readonly tagName=  "ebo-settings-view";
    get scanStatus(): string {
        return this._scanStatus;
    }
    set scanStatus(value: string) {
        this._scanStatus = value;
        this.update(this.shadow);//force!
    }
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes: string[] = [];

    private _scanStatus: string;

    static styleText= `
        <style>
            :host { 
                display: flex;
            } 
            #wrapper {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
            }
        </style>
        `;

    // noinspection HtmlUnknownTarget
    static htmlText = `
        <div id="wrapper">
        <ebo-button id="scanBtn" class="roundBorder">Rescan media folder</ebo-button>
        <p id="scanStatus"></p>
        </div>        
        `;

    constructor() {
        super(EboSettingsComp.styleText, EboSettingsComp.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        this.requestRender();
        }

    render(shadow:ShadowRoot) {
        let scanBtn = shadow.getElementById("scanBtn") as EboButton;
        scanBtn.addEventListener("click", async (ev) => {
            getState().getController().startScan().then(() => {});
            console_yellow("Just started....");
        });
    }

    override update(shadow:ShadowRoot) {
        let scanStatus = shadow.getElementById("scanStatus") as HTMLElement;
        scanStatus.innerText = this.scanStatus;
    }
}
