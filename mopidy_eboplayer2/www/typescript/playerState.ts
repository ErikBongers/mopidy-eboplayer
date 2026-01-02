import {Mopidy} from "../js/mopidy";
import {ViewModel} from "./model";
import {EboPlayerDataType, View} from "./views/view";
import {Controller} from "./controllers/controller";
import {DeepReadonly} from "./modelTypes";
import {PlayController} from "./controllers/playController";

export class State {
    mopidy: Mopidy;

    // values for controls
    play: boolean = false;
    random: boolean = false;
    repeat: boolean = false;

    // array of cached playlists (not only user-playlists, also search, artist, album-playlists)

    private readonly model: ViewModel;
    private readonly controller: Controller;
    private readonly player: PlayController;

    constructor(mopidy: Mopidy, model: ViewModel, controller: Controller, player: PlayController) {
        this.mopidy = mopidy;
        this.model = model;
        this.controller = controller;
        this.player = player;
    }
    views: View[] = [];
    getModel = (): DeepReadonly<ViewModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;

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
            await this.controller.fetchRequiredData(dataType);
            await this.controller.webProxy.fetchRequiredData(dataType);
        }

        await this.controller.fetchAllAlbums();
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