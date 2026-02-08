import {ComponentView} from "./view";
import {EboPlayerDataType} from "../modelTypes";
import {EboRememberedComp} from "../components/eboRememberedComp";
import {State} from "../playerState";

export class RememberedView extends ComponentView<EboRememberedComp>{
    constructor(state: State, component: EboRememberedComp) {
        super(state, component);
    }

    bind(): void {
        this.state.getModel().addEboEventListener("remembersChanged.eboplayer", async () => {
            this.component.rememberedList = await this.state.getController().getRemembersCached();
        });

    }

    getRequiredDataTypes(): EboPlayerDataType[] {
        return [];
    }
}