import {Model} from "../model";
import {Commands} from "../commands";
import {Mopidy} from "../../js/mopidy";
import {MopidyProxy} from "../proxies/mopidyProxy";
import {LocalStorageProxy} from "../proxies/localStorageProxy";
import {getHostAndPort} from "../global";
import {AlbumUri, LastViewed, StreamUri, TrackUri, Pages} from "../modelTypes";
import {WebProxy} from "../proxies/webProxy";
import {PlayController} from "./playController";
import {RefArgs} from "../events";
import {CacheHandler} from "./cacheHandler";
import Controller from "./controller";

export class ViewController extends Commands {
    protected model: Model;
    public localStorageProxy: LocalStorageProxy;
    private controller: Controller;

    constructor(model: Model, mopidy: Mopidy, controller: Controller) {
        super(mopidy);
        this.model  = model;
        this.localStorageProxy = new LocalStorageProxy(model);
        this.controller = controller;
    }

    setInitialView () {
        let lastViewed = this.controller.localStorageProxy.getLastViewed();
        if (!lastViewed) {
            this.setView(Pages.NowPlaying);
            return;
        }
        switch (lastViewed.view) {
            case Pages.Album:
                if (location.hash == Pages.Album) {
                    this.gotoAlbum(lastViewed.uri as AlbumUri);
                    return;
                }
                break;
            case Pages.Radio:
                if (location.hash == Pages.Radio) {
                    this.gotoRadio(lastViewed.uri as StreamUri);
                    return;
                }
                break;
            default:
                this.setView((location.hash!="" ? location.hash : Pages.NowPlaying) as Pages);
                return;
        }
        this.setView(Pages.NowPlaying);
    }

    gotoAlbum(uri: AlbumUri) {
        this.controller.getExpandedAlbumModel(uri).then(() => { //fetch before changing view, to avoid flicker.
            this.showAlbum(uri, null);
        });
    }

    gotoRadio(uri: StreamUri) {
        this.controller.getExpandedTrackModel(uri).then(() => { //fetch before changing view, to avoid flicker.
            this.showRadio(uri);
        });
    }

    setView(view: Pages) {
        this.model.setPage(view);
    }

    showAlbum(albumUri: AlbumUri, selectedTrackUri: TrackUri | null) {
        this.localStorageProxy.setLastViewed(Pages.Album, albumUri);
        this.model.setAlbumToView(albumUri, selectedTrackUri);
        this.model.setPage(Pages.Album);
    }

    showRadio(radioUri: StreamUri) {
        this.localStorageProxy.setLastViewed(Pages.Radio, radioUri);
        this.model.setRadioToView(radioUri);
        this.model.setPage(Pages.Radio);
    }

    async browseToArtist(args: RefArgs) {
        await this.controller.clearBreadCrumbs();
        await this.controller.diveIntoBrowseResult(args.name, args.uri, args.type, false);
        this.setView(Pages.Browse);
    }
}
