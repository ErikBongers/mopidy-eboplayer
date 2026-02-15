import {Mopidy} from "../js/mopidy";
import {ViewModel} from "./model";
import {View} from "./views/view";
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
    getModel = (): DeepReadonly<ViewModel> => this.model;
    getController = () => this.controller;
    getPlayer = () => this.player;

}
