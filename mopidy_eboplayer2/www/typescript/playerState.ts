import models, {Mopidy} from "../js/mopidy";
import {SyncedProgressTimer} from "./synced_timer";
import {ViewModel} from "./model";
import {EboPlayerDataType, View} from "./views/view";
import {Controller} from "./controller";

import {DeepReadonly} from "./modelTypes";

export class State {
    mopidy: Mopidy;
    syncedProgressTimer: SyncedProgressTimer;

    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;
    consume: boolean = false;
    single: boolean = false;
    mute: boolean = false;
    positionChanging: boolean = false;
    popupData = {};  // TODO: Refactor into one shared cache,
    songlength: number = 0;

    streamUris = {}; //TODO: EBO added this to make gui.ts compile.

    // array of cached playlists (not only user-playlists, also search, artist, album-playlists)
    playlists = {};  // TODO: Refactor into one shared cache,
    customTracklists =  [];  // TODO: Refactor into one shared cache,

    private readonly model: ViewModel;
    private readonly controller: Controller;

    constructor(mopidy: Mopidy, syncedProgressTimer: SyncedProgressTimer, model: ViewModel, controller: Controller) {
        this.mopidy = mopidy;
        this.syncedProgressTimer = syncedProgressTimer;
        this.model = model;
        this.controller = controller;
    }
    views: View[] = [];
    getModel = (): DeepReadonly<ViewModel> => this.model;
    getController = () => this.controller;

    addViews(...views:View[]) {
        this.views.push(...views);
        views.forEach(v => v.bindRecursive());
    }

    async getRequiredData()  {
        let requiredData = new Set<EboPlayerDataType>();
        this.views.forEach(v => {
            v.getRequiredDataTypesRecursive().forEach((dataType: EboPlayerDataType) => requiredData.add(dataType));
        });
        this.controller.getRequiredDataTypesRecursive().forEach((dataType => requiredData.add(dataType)));

        for (const dataType of requiredData) {
            await this.controller.mopidyProxy.fetchRequiredData(dataType);
            await this.controller.webProxy.fetchRequiredData(dataType);
        }

        this.controller.localStorageProxy.loadCurrentBrowseFilter();
        this.controller.localStorageProxy.loadBrowseFiltersBreadCrumbs();
        this.controller.fetchRefsForCurrentBreadCrumbs().then(() => {
            this.controller.filterBrowseResults();
        });
    }
}

let state: State = undefined; //todo: assuming here that all calls to getState() will receive a valid state object.

export function setState(newState: State) { state = newState; }
const getState = () => state;

export default getState;