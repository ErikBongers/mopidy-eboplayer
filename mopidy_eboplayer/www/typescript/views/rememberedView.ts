import {ComponentView} from "./view";
import {EboRememberedComp} from "../components/eboRememberedComp";
import {App} from "../app";

export class RememberedView extends ComponentView<EboRememberedComp>{
    constructor(state: App, component: EboRememberedComp) {
        super(state, component);
    }

    bind(): void {
        this.state.getModel().on("remembersChanged.eboplayer", async () => {
            this.component.rememberedList = await this.state.getController().cache.getRemembersCached();
        });
        this.component.on("deleteRemember.eboplayer", async (ev) => {
            await this.state.getController().deleteRemember(ev.detail.id);
        });

    }
}