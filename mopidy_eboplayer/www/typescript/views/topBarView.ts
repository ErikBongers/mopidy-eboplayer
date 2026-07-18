import {ComponentView} from "./view";
import {EboTopBar} from "../components/eboTopBar";
import {State} from "../playerState";

export class TopBarView extends ComponentView<EboTopBar> {
    constructor(state: State, component: EboTopBar) {
        super(state, component);
    }

    bind() {
        this.on("gotoPage.eboplayer", (ev) => {
            this.state.getController().viewController.setView(ev.detail.page);
        });
        this.state.getModel().on("viewChanged.eboplayer", () => {
            this.component.page = this.state.getModel().getPage();
        });
        this.state.getModel().on("messageChanged.eboplayer", () => {
            this.component.message = this.state.getModel().getCurrentMessage();
        });
        this.state.getModel().on("tempMessageChanged.eboplayer", () => {
            this.component.message = this.state.getModel().getTempMessage();
        });

    }

}