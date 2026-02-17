import {ComponentView} from "./view";
import {State} from "../playerState";
import {EboGenresComp} from "../components/eboGenresComp";

export class GenresView extends ComponentView<EboGenresComp>{
    constructor(state: State, component: EboGenresComp) {
        super(state, component);
    }

    bind(): void {
        this.state.getModel().addEboEventListener("genreDefsChanged.eboplayer", async () => {
            let genreDefs = await this.state.getCache().getGenreDefs();
            let genreReplacements = await this.state.getCache().getGenreReplacementsCached();
            this.component.genreDefs = genreDefs.map(genreDef => {
                return {genreDef, active: genreReplacements.has(genreDef.child ?? genreDef.name)};
            });
            this.component.addEboEventListener("genreSelected.eboplayer", ev => {
            });
        });
    }
}