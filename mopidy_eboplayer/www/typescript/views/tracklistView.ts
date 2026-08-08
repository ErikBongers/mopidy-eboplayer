import {ComponentView} from "./view";
import {State} from "../playerState";
import {EboTracklistComp} from "../components/eboTracklistComp";

export class TracklistView extends ComponentView<EboTracklistComp> {
    private clickedRow: HTMLTableRowElement | null = null;

    constructor(state: State, component: EboTracklistComp) {
        super(state, component);
    }

    bind() {
        this.state.getModel().on("trackListChanged.eboplayer", () => {
            this.rebuildTimeline().then(r => {});
        });
        this.state.getModel().on("currentTrackChanged.eboplayer", () => {
            this.onCurrentTrackChanged();
        });
        this.state.getModel().on("selectedTrackChanged.eboplayer", () => {
            this.onSelectedTrackChanged();
        });
    }

    private async rebuildTimeline() {
        this.component.tracklist = this.state.getModel().getTrackList();
    }

    private onCurrentTrackChanged() {
        this.component.requestUpdate();
    }

    private onSelectedTrackChanged() {
        this.component.requestUpdate();
    }

}
