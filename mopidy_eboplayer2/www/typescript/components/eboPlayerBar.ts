import {EboComponent} from "./EboComponent";
import {inverseQuadratic100, quadratic100} from "../global";

export class EboPlayerBar extends EboComponent {
    static override readonly tagName=  "ebo-player-bar";
    // noinspection JSUnusedGlobalSymbols
    static observedAttributes = ["play_state", "image_url", "show_info", "volume", "allow_play", "allow_prev", "allow_next", "text", "stop_or_pause"];
    private play_state: string;
    private show_info: boolean = false;
    private isVolumeSliding: boolean = false;
    private volume: number = 0;
    private allow_play: boolean = true;
    private allow_prev: boolean = true;
    private allow_next: boolean = true;
    private text: string = "";
    private image_url: string = "";
    private stop_or_pause: string;

    // noinspection CssUnresolvedCustomProperty
    static styleText = `
        <style>
            img {
                width: 2em;
                height: 2em;
                margin-right: 1em;
            }
        
            .playing {
                background-color: var(--playing-background);
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
            #text {
                font-size: .7em;
                text-align: center;
                display: block;
            }
        </style>
    `;

    static htmlText = `
        <div id="wrapper">
            <div id="info">
                <span id="text" class="selectable">sdfsdf sdfsdf </span>
            </div>
            <div id="buttonBar">
                <img id="buttonBarImg" src="images/default_cover.png" alt="Album cover"/>
                <div id="buttonBar">
                    <button id="btnPrev" title="Previous"><i class="fa fa-fast-backward"></i></button>
                    <button id="btnPlay" title="Play"><i class="fa fa-play"></i></button>
                    <button id="btnNext" title="Next"><i class="fa fa-fast-forward"></i></button>
                    <input id="volumeSlider" data-highlight="true" name="volumeSlider" data-mini="true" type="range" min="0" value="0" max="100"/>
                    <ebo-dropdown id="btnRepeat" style="margin-left: 1em;">
                        <ebo-option value="justPlay"><i class="fa fa-ellipsis-h"></i></ebo-option>
                        <ebo-option value="repeat"><i class="fa fa-repeat"></i></ebo-option>
                    </ebo-dropdown>
                </div>
            </div>
        </div>
        `;

    constructor() {
        super(EboPlayerBar.styleText, EboPlayerBar.htmlText);
    }

    // noinspection JSUnusedGlobalSymbols
    attributeReallyChangedCallback(name: string, _oldValue: string, newValue: string) {
        switch (name) {
            case "image_url":
            case "text":
            case "play_state":
            case "stop_or_pause":
                this[name] = newValue;
                break;
            case "volume":
                this.volume = parseInt(newValue);
                break;
            case "show_info":
            case "allow_play":
            case "allow_prev":
            case "allow_next":
                this.updateBoolProperty(name, newValue);
                break;
        }
        this.requestUpdate();
        }

    override render(shadow:ShadowRoot) {
        let slider = shadow.getElementById("volumeSlider") as HTMLInputElement;
        slider.oninput = (ev) => {
            this.isVolumeSliding = true;
            this.volume = quadratic100(parseInt(slider.value));
            this.dispatchEboEvent("changingVolume.eboplayer", {volume: this.volume});
        };
        slider.onmousedown = slider.ontouchstart = () => { this.isVolumeSliding = true;};
        slider.onmouseup = slider.ontouchend = () => { this.isVolumeSliding = false;};

        let btnPlay = shadow.getElementById('btnPlay') as HTMLButtonElement;
        btnPlay.addEventListener("click", (ev) => {
            let title = btnPlay.querySelector('i')?.title as string;
            switch (title) {
                case "Play": this.dispatchEboEvent("playPressed.eboplayer", {}); break;
                case "Pause": this.dispatchEboEvent("pausePressed.eboplayer", {}); break;
                case "Stop": this.dispatchEboEvent("stopPressed.eboplayer", {}); break;
            }
        });
        let imgTag = shadow.getElementById("buttonBarImg") as HTMLImageElement;
        imgTag.addEventListener("click", (ev) => {
            this.dispatchEboEvent("buttonBarAlbumImgClicked.eboplayer", {});
        });
    }

    override update(shadow:ShadowRoot) {
        switch(this.play_state) {
            case "playing":
                if(this.stop_or_pause == "pause")
                    this.setPlayButton('Pause', 'fa-pause');
                else
                    this.setPlayButton('Stop', 'fa-stop');
                break;
            case "stopped":
            case "paused":
                this.setPlayButton('Play', 'fa-play');
                break;
        }
        // @ts-ignore
        shadow.getElementById("btnNext").style.opacity = this.allow_next ? "1" : "0.5" ;
        // @ts-ignore
        shadow.getElementById("btnPrev").style.opacity = this.allow_prev ? "1" : "0.5";
        // @ts-ignore
        shadow.getElementById("btnPlay").style.opacity = this.allow_play ? "1" : "0.5";

        let titleEl = shadow.getElementById("text") as HTMLElement;
        let img = shadow.querySelector("img") as HTMLImageElement;
        titleEl.style.display = this.show_info ? "" : "none";
        if(this.image_url) {
            img.style.visibility =  this.show_info ? "visible" : "hidden";
            img.setAttribute("src", this.image_url);
        }
        else
            img.style.visibility = "hidden";
        if(!this.isVolumeSliding) {
            let slider = shadow.getElementById("volumeSlider") as HTMLInputElement;
            let visualVolume = inverseQuadratic100(this.volume);
            slider.value = Math.floor(visualVolume).toString();
        }
        let wrapper = shadow.getElementById("wrapper") as HTMLElement;
        wrapper.classList.toggle("playing", this.play_state == "playing");
        titleEl.innerHTML = this.text.replaceAll("\n", "<br/>");
    }

    private setPlayButton(title: string, addClass: string) {
        let btnPlayIcon = this.getShadow().getElementById('btnPlay')?.querySelector('i') as HTMLElement;
        btnPlayIcon.classList.remove("fa-play", "fa-pause", "fa-stop" );
        btnPlayIcon.classList.add(addClass);
        btnPlayIcon.setAttribute('title', title);
    }
}