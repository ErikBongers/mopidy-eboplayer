import {ComponentView} from "./view";
import {EboSettingsComp} from "../components/eboSettingsComp";
import {State} from "../playerState";

export class SettingsView extends ComponentView<EboSettingsComp> {

    constructor(state: State, component: EboSettingsComp) {
        super(state, component);
    }

    bind() {
        this.state.getModel().on("scanStatusChanged.eboplayer", (ev) => {
            this.component.scanStatus = ev.detail.status;
        });
        this.state.getModel().on("scanFinished.eboplayer", () => {
            this.component.setAttribute("show_whats_new", "");
        });
        this.component.on("scanRequested.eboplayer", async () => {
            await this.state.getController().startScan();
        });
        this.component.on("whatsNewRequested.eboplayer", () => {
            window.location.hash = "#Browse.WhatsNew";
            window.location.reload();
        });
        this.component.on("mopidyConfigRequested.eboplayer", async () => {
            await this.state.getController().readMopidyConfig();
        });
        this.component.on("mopidyConfigAddExclExt.eboplayer", async (ev) => {
            await this.state.getController().addExclExtToMopidyConfig(ev.detail.extension);
        });
    }
}
