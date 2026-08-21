import {ComponentView} from "./view";
import {State} from "../playerState";
import {EboGenresComp} from "../components/eboGenresComp";
import {AlbumUri} from "../modelTypes";

export class GenresView extends ComponentView<EboGenresComp>{
    constructor(state: State, component: EboGenresComp) {
        super(state, component);
    }

    bind(): void {
        this.state.getModel().on("genreDefsChanged.eboplayer", async () => {
            let genreDefs = await this.state.getCache().getGenreDefs();
            let genreReplacements = await this.state.getCache().getGenreReplacementsCached();
            this.component.genreDefs = genreDefs.map(genreDef => {
                return {genreDef, active: genreReplacements.has(genreDef.child ?? genreDef.name)};
            });
        });
        this.state.getModel().on("albumToViewChanged.eboplayer", async (ev) => {
            let album = await this.state.getController().getExpandedAlbumModel(ev.detail.uri as AlbumUri);
            let {genreDefs} = await album.getAllDetails();
            this.component.setAttribute("album_title", album.album.albumInfo?.name??"--no name--");
            this.component.setAttribute("album_genres", genreDefs.map(gd => gd.replacement??gd.ref.name??"???").join(", "));
        });
    }
}