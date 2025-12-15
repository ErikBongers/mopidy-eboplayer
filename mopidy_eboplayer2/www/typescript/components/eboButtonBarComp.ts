import {EboComponent} from "./EboComponent";
import {EboplayerEvents, TrackModel, ItemType} from "../modelTypes";
import {console_yellow, inverseQuadratic100, quadratic100} from "../global";

export class EboButtonBar extends EboComponent {
    set streamLines(value: string) {
        this._streamLines = value;
        this.update();
    }
    private _track: TrackModel;
    private _streamLines: string;
    get track(): TrackModel {
        return this._track;
    }
    set track(value: TrackModel) {
        this._track = value;
        this.update();
    }
    static readonly tagName=  "ebo-button-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["playing", "img", "show_info", "volume"];
    private playing: boolean = false;
    private show_info: boolean = false;
    private img: string;
    private isVolumeSliding: boolean = false;
    private volume: number = 0;

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
            #buttonBar  {
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
                align-items: center;
                align-content: center;
            
                & button {
                    padding-left: .5ch;
                    padding-right: .5ch;
                }
            }
            #buttonBar {
                display: flex;
                justify-content: center;
                align-items: center;
            }
            #volumeSlider {
                width: 100px;
            }
            input[type='range'] {
                & {
                    margin: 10px 5px;
                    height: 2px;
                    background-color: gray;
                    -webkit-appearance: none;
                }
            
                &::-webkit-slider-thumb {
                    padding: 0;
            
                    width: 7px;
                    appearance: none;
                    height: 7px;
                    background: white;
                    color: white;
                    border-color: white;
                    border-style: solid;
                    border-width:7px;
                    border-radius: 7px;
                }
            }
            #wrapper {
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding-top: .5em;
                padding-bottom: .5em;
            }
            #title {
                font-size: .7em;
                text-align: center;
                display: block;
            }
        </style>
    `;
    //todo: make a html (or style) template literal function to inject opacity and such.
    // > This function does NOT return a string, but the list of string fragments and placeholders.
    // > The template is rendered later with `this` as the context.

    static htmlText = `
        <div id="wrapper">
            <div id="info">
                <span id="title">sdfsdf sdfsdf </span>
            </div>
            <div id="buttonBar">
                <img id="buttonBarImg" src="images/default_cover.png" alt="Album cover"/>
                <div id="buttonBar">
                    <button id="btnPrev" title="Previous"><i class="fa fa-fast-backward"></i></button>
                    <button id="btnPlay" title="Play"><i class="fa fa-play"></i></button>
                    <button id="btnNext" title="Next"><i class="fa fa-fast-forward"></i></button>
                    <input id="volumeSlider" data-highlight="true" name="volumeSlider" data-mini="true" type="range" min="0" value="0" max="100"/>
                    <button id="btnMore" style="margin-left: 1em;" title="Next"><i class="fa fa-ellipsis-h"></i></button>
                </div>
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
                this[name] = newValue;
                break;
            case "volume":
                this.volume = parseInt(newValue);
                console_yellow(`eboButtonBarComp: attributeReallyChangedCallback: volume: ${this.volume}`);
                break;
            case "playing":
            case "show_info":
                if (!["true", "false"].includes(newValue))
                    throw `"${name}" attribute should be "true" or "false". Current value: "${newValue}"`;
                this[name] = newValue == "true";
                break;
        }
        this.update();
        }

    renderPrepared() {
        this.shadow.appendChild(this.styleTemplate.content.cloneNode(true));
        let fragment = this.divTemplate.content.cloneNode(true) as DocumentFragment;
        this.shadow.appendChild(fragment);
        let slider = this.shadow.getElementById("volumeSlider") as HTMLInputElement;
        slider.oninput = (ev) => {
            this.isVolumeSliding = true;
            this.volume = quadratic100(parseInt(slider.value));
            console_yellow(`eboButtonBarComp: slider.oninput: slider.value: ${slider.value}, this.volume: ${this.volume}`);
            this.dispatchEvent(new CustomEvent(EboplayerEvents.changingVolume, {bubbles: true, composed: true, detail: {volume: this.volume}}));
        };
        slider.onmousedown = slider.ontouchstart = () => { this.isVolumeSliding = true;};
        slider.onmouseup = slider.ontouchend = () => { this.isVolumeSliding = false;};

        let btnPlay = this.shadow.getElementById('btnPlay');
        btnPlay.addEventListener("click", (ev) => {
            let title = btnPlay.querySelector('i').title;
            let eventName: EboplayerEvents;
            switch (title) {
                case "Play": eventName = EboplayerEvents.playPressed; break;
                case "Pause": eventName = EboplayerEvents.pausePressed; break;
                case "Stop": eventName = EboplayerEvents.stopPressed; break;
            }
            this.dispatchEvent(new CustomEvent(eventName, {bubbles: true, composed: true}));
        });
        let imgTag = this.shadow.getElementById("buttonBarImg") as HTMLImageElement;
        imgTag.addEventListener("click", (ev) => {
            this.dispatchEvent(new Event(EboplayerEvents.albumClicked));
        });
    }

    updateWhenConnected() {
        if(!this.track)
            return;
        if(this.playing) {
            if(this.track.type == ItemType.Stream)
                this.setPlayButton('Stop', 'fa-stop');
            else
                this.setPlayButton('Pause', 'fa-pause');

        } else {
                this.setPlayButton('Play', 'fa-play');
        }
        let opacity = this.track.type == ItemType.File ? "1" : "0.5";
        this.shadow.getElementById("btnNext").style.opacity = opacity;
        this.shadow.getElementById("btnPrev").style.opacity = opacity;
        let img = this.shadow.querySelector("img") as HTMLElement;
        img.style.visibility = this.show_info ? "visible" : "hidden";
        if(!this.isVolumeSliding) {
            let slider = this.shadow.getElementById("volumeSlider") as HTMLInputElement;
            console_yellow(`eboButtonBarComp.update: this.volume: ${this.volume}`);
            let visualVolume = inverseQuadratic100(this.volume);
            console_yellow(`eboButtonBarComp.update: visualVolume: ${visualVolume}`);
            slider.value = Math.floor(visualVolume).toString();
            console_yellow(`eboButtonBarComp.update: slider.value: ${slider.value}, this.volume: ${this.volume}`);
        }
        let wrapper = this.shadow.getElementById("wrapper");
        wrapper.classList.toggle("playing", this.playing);
        let titleEl = this.shadow.getElementById("title");
        titleEl.textContent = "";
        if(this.show_info) {
            let title: string;
            if (this.track) {
                if (this.track.type == ItemType.Stream)
                    title = this._streamLines ?? this.track.name;
                else if (this.track.type == ItemType.File)
                    title = this.track.title;
                titleEl.innerHTML = title;
            }
        }
    }

    private setPlayButton(title: string, addClass: string) {
        let btnPlayIcon = this.shadow.getElementById('btnPlay').querySelector('i');
        btnPlayIcon.classList.remove("fa-play", "fa-pause", "fa-stop" );
        btnPlayIcon.classList.add(addClass);
        btnPlayIcon.setAttribute('title', title);
    }
}