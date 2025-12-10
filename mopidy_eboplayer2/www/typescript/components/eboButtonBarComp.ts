import {EboComponent} from "./EboComponent";
import {TrackModel, TrackType} from "../modelTypes";

export class EboButtonBar extends EboComponent {
    private _track: TrackModel;
    get track(): TrackModel {
        return this._track;
    }
    set track(value: TrackModel) {
        this._track = value;
        this.update();
    }
    static readonly tagName=  "ebo-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["playing", "img", "track_title", "show_info"];
    private playing: boolean = false;
    private show_info: boolean = false;
    private track_title: string = "";
    private img: string;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 2em;
                height: 2em;
                margin-right: 1em;
            }
        
            .playing {
                background-color: rgba(184, 134, 11, 0.53);
            }
        </style>
    `;
    //todo: make a html (or style) template literal function to inject opacity and such.
    // > This function does NOT return a string, but the list of string fragments and placeholders.
    // > The template is rendered later with `this` as the context.

    static htmlText = `
        <div id="wrapper">
            <img id="buttonBarImg" src="images/default_cover.png" alt="Album cover"/>
            <div id="buttonBar">
                <button id="btnPrev" title="Previous"><i class="fa fa-fast-backward"></i></button>
                <button id="btnPlay" title="Play"><i class="fa fa-play"></i></button>
                <button id="btnNext" title="Next"><i class="fa fa-fast-forward"></i></button>
                <input id="volumeslider" data-highlight="true" name="volumeslider" data-mini="true" type="range" min="0" value="0" max="100"/>
                <button id="btnMore" style="margin-left: 1em;" title="Next"><i class="fa fa-ellipsis-h"></i></button>
            </div>
        </div>
        `;

    constructor() {
        super(EboButtonBar.styleText, EboButtonBar.htmlText);
        this.render();
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "img":
            case "track_title":
                this[name] = newValue;
                break;
            case "playing":
            case "show_info":
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
    }

    updateWhenConnected() {
        if(this.playing) {
            if(!this.track)
                return;
            if(this.track.type == TrackType.Stream)
                this.setPlayButton('Pause', ['fa-play'], 'fa-stop');
            else
                this.setPlayButton('Pause', ['fa-play'], 'fa-pause');

        } else {
                this.setPlayButton('Play', ['fa-pause', 'fa-stop'], 'fa-play');
        }
        let opacity = this.track.type == TrackType.File ? "1" : "0.5";
        this.shadow.getElementById("btnNext").style.opacity = opacity;
        this.shadow.getElementById("btnPrev").style.opacity = opacity;
        let img = this.shadow.querySelector("img") as HTMLElement;
        img.style.visibility = this.show_info ? "visible" : "hidden";
    }

    private setPlayButton(title: string, removeClasses: string[], addClass: string) {
        let btnPlayIcon = this.shadow.getElementById('btnPlay').querySelector('i');
        btnPlayIcon.classList.remove(...removeClasses);
        btnPlayIcon.classList.add(addClass);
        btnPlayIcon.setAttribute('title', title);
    }
}