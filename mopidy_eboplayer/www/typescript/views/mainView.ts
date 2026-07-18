import {View} from "./view";
import {AllUris, Goto} from "../modelTypes";
import {State} from "../playerState";
import {addEboEventListener} from "../events";

export class MainView extends View {

    constructor(state: State) {
        super(state);
    }

    bind() {
        this.state.getModel().on("viewChanged.eboplayer", async () => {
            await this.setCurrentPage();
        });
        let layout = document.getElementById("layout") as HTMLElement;
        addEboEventListener(layout, "favoriteToggle.eboplayer", async (ev) => {
            await this.onToggleFavorite(ev.detail.uri);
        });
    }

    async setCurrentPage() {
        let page = this.state.getModel().getPage();
        await this.showPage(page);
    }

    private hashToViewId(hash: Goto): string {
        return hash
            .replace("#", "")
            .replace(".Favorites", "")
            .replace(".WhatsNew", "");
    }

    private async showPage(gotoPage: Goto) {
        let fullViews = document.querySelectorAll(".page");
        fullViews.forEach(v => v.classList.remove("shownPage"));
        let currentView = document.getElementById(this.hashToViewId(gotoPage)) as HTMLElement;
        currentView.classList.add("shownPage");
    }

    private async onToggleFavorite(uri: AllUris) {
        await this.state.getController().toggleFavorite(uri);
    }
}
