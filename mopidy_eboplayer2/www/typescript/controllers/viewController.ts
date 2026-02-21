import {Model} from "../model";
import {Commands} from "../commands";
import {Mopidy} from "../../js/mopidy";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort} from "../global";
import {AlbumUri, LastViewed, StreamUri, TrackUri, Views} from "../modelTypes";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import {RefArgs} from "../events";
import {CacheHandler} from "./cacheHandler";
import Controller from "./controller";

//The controller updates the model and has functions called by the views.
//The controller does not update the views directly.
//The controller should not listen to model events, to avoid circular updates (dead loops).
export class ViewController extends Commands {
    protected model: Model;
    public localStorageProxy: LocalStorageProxy;
    lastViewed: LastViewed | null = null;
    private controller: Controller;

    constructor(model: Model, mopidy: Mopidy, controller: Controller) {
        super(mopidy);
        this.model  = model;
        this.localStorageProxy = new LocalStorageProxy(model);
        this.controller = controller;
    }

    initialize() {
        if(location.hash == Views.Album) {
            let lastViewed = this.controller.localStorageProxy.getLastViewed();
            if(lastViewed)
                this.lastViewed = lastViewed;
            else
                this.setView(Views.NowPlaying);
        }
        else
            this.setView((location.hash!="" ? location.hash : Views.NowPlaying) as Views);
    }

    setInitialView () {
        this.initialize();
        if(this.lastViewed) {
            if(this.lastViewed.view == Views.Album) {
                this.gotoAlbum(this.lastViewed.uri as AlbumUri);
                this.lastViewed = null;
            }
        }
    }

    gotoAlbum(uri: AlbumUri) {
        this.controller.getExpandedAlbumModel(uri).then(() => { //fetch before changing view, to avoid flicker.
            this.showAlbum(uri, null);
        });
    }

    setView(view: Views) {
        this.model.setView(view);
    }

    showAlbum(albumUri: AlbumUri, selectedTrackUri: TrackUri | null) {
        this.localStorageProxy.setLastViewed(Views.Album, albumUri);
        this.model.setAlbumToView(albumUri, selectedTrackUri);
        this.model.setView(Views.Album);
    }

    showRadio(radioUri: StreamUri) {
        this.model.setRadioToView(radioUri);
        this.model.setView(Views.Radio);
    }

    async browseToArtist(args: RefArgs) {
        await this.controller.clearBreadCrumbs();
        await this.controller.diveIntoBrowseResult(args.name, args.uri, args.type, false);
        this.setView(Views.Browse);
    }
}
